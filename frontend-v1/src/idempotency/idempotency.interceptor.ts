import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, switchMap, tap } from 'rxjs';
import { IdempotencyService } from './idempotency.service';

/**
 * IdempotencyInterceptor
 *
 * Attach to any mutating endpoint (POST, PUT, PATCH) that requires
 * exactly-once semantics.
 *
 * Flow:
 *  1. Read `Idempotency-Key` header and authenticated userId from request.
 *  2. Call IdempotencyService.check():
 *     - No record      → proceed, then save the response.
 *     - Same path hit  → replay the cached response immediately (short-circuit).
 *     - Different path → 400 Bad Request (key reuse across endpoints).
 *  3. After a fresh response is produced, persist it via IdempotencyService.save().
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const idempotencyKey: string | undefined =
      request.headers['idempotency-key'];

    // Skip if no key provided — endpoint remains non-idempotent
    if (!idempotencyKey) {
      return next.handle();
    }

    const userId: string = request.user?.id ?? request.user?.sub ?? 'anonymous';
    const currentPath: string = request.path;

    return from(
      this.idempotencyService.check(idempotencyKey, userId, currentPath),
    ).pipe(
      switchMap((result) => {
        if (result.cached) {
          // Replay the original response — do NOT call the handler again
          response.status(result.statusCode ?? 200);
          return from(Promise.resolve(result.responseBody));
        }

        // Fresh request — execute handler then persist the response
        return next.handle().pipe(
          tap(async (responseBody: Record<string, unknown>) => {
            await this.idempotencyService.save(
              idempotencyKey,
              userId,
              currentPath,
              response.statusCode,
              responseBody,
            );
          }),
        );
      }),
    );
  }
}
