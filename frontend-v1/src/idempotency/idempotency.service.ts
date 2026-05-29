import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  IdempotencyDocument,
  IdempotencyRecord,
} from './idempotency.schema';

export interface IdempotencyResult {
  cached: boolean;
  statusCode?: number;
  responseBody?: Record<string, unknown>;
}

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectModel(IdempotencyRecord.name)
    private readonly idempotencyModel: Model<IdempotencyDocument>,
  ) {}

  /**
   * Check whether a request with the given key + userId has been seen before.
   *
   * - If no record exists → returns { cached: false } so the caller can proceed.
   * - If a record exists for the same path → returns { cached: true, ...response }
   *   so the caller can replay the original response (idempotent replay).
   * - If a record exists but for a DIFFERENT path → throws 400 Bad Request.
   *   Reusing an Idempotency-Key across different endpoints is not allowed.
   */
  async check(
    key: string,
    userId: string,
    currentPath: string,
  ): Promise<IdempotencyResult> {
    const existing = await this.idempotencyModel
      .findOne({ key, userId })
      .lean()
      .exec();

    if (!existing) {
      return { cached: false };
    }

    // Path mismatch — key is being reused for a different endpoint
    if (existing.path !== currentPath) {
      throw new BadRequestException(
        `Idempotency-Key reuse for different endpoint: ` +
          `key "${key}" was originally used for "${existing.path}", ` +
          `but the current request targets "${currentPath}".`,
      );
    }

    // Same path — safe to replay the cached response
    return {
      cached: true,
      statusCode: existing.statusCode,
      responseBody: existing.responseBody,
    };
  }

  /**
   * Persist the response for a completed request.
   *
   * Uses $setOnInsert so that a race-condition retry that arrives while the
   * first request is still in-flight does not overwrite the result once saved.
   *
   * NOTE: Because $setOnInsert is used, a second call with the same key/userId
   * is silently ignored at the DB level. Path validation in `check()` above
   * ensures we never reach this point with a mismatched path.
   */
  async save(
    key: string,
    userId: string,
    path: string,
    statusCode: number,
    responseBody: Record<string, unknown>,
  ): Promise<void> {
    await this.idempotencyModel
      .findOneAndUpdate(
        { key, userId },
        {
          $setOnInsert: { key, userId, path, statusCode, responseBody },
        },
        { upsert: true, new: false },
      )
      .exec();
  }
}
