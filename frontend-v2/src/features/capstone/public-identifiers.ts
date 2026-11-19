/**
 * Stable public identifiers (CAPSTONE-004).
 *
 * Public ids are random (80 bits), non-sequential and carry no internal key.
 * They are generated from an injectable byte source so tests are deterministic
 * and production uses `crypto.getRandomValues`. Internal keys stay separate;
 * `PublicIdMap` keeps the two linked for traceability without exposing either
 * one through the other.
 */

export type ByteSource = (length: number) => Uint8Array;

export const cryptoBytes: ByteSource = (length) => {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

// Crockford base32 without I, L, O, U: unambiguous and URL safe.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ID_BYTES = 10; // 80 bits -> 16 characters

export type PublicIdKind = "call" | "project" | "proposal" | "team" | "milestone";

const PREFIX: Record<PublicIdKind, string> = { call: "cal", project: "prj", proposal: "prp", team: "tem", milestone: "mil" };

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function generatePublicId(kind: PublicIdKind, bytes: ByteSource = cryptoBytes): string {
  return `${PREFIX[kind]}_${base32(bytes(ID_BYTES))}`;
}

const PUBLIC_ID = /^(cal|prj|prp|tem|mil)_[0-9A-HJKMNP-TV-Z]{16}$/;
export function isPublicId(value: unknown, kind?: PublicIdKind): value is string {
  return typeof value === "string" && PUBLIC_ID.test(value) && (kind === undefined || value.startsWith(`${PREFIX[kind]}_`));
}

/** A correlation id ties together the requests of one user action; it is not an entity id. */
export function generateCorrelationId(bytes: ByteSource = cryptoBytes): string {
  return `cor_${base32(bytes(ID_BYTES))}`;
}

/** `prj_X@v3`: a reference to one version of a public entity. */
export function versionRef(publicId: string, version: number): string {
  if (!isPublicId(publicId)) throw new RangeError("versionRef needs a valid public id");
  if (!Number.isInteger(version) || version < 1) throw new RangeError("version must be a positive integer");
  return `${publicId}@v${version}`;
}

export function parseVersionRef(ref: string): { publicId: string; version: number } | null {
  const match = /^(.+)@v([1-9][0-9]*)$/.exec(ref);
  if (!match || !isPublicId(match[1])) return null;
  return { publicId: match[1], version: Number(match[2]) };
}

/**
 * Two-way link between internal keys and public ids. Allocation retries on the
 * (astronomically unlikely) collision so one public id never maps to two keys.
 */
export class PublicIdMap {
  private readonly byPublic = new Map<string, string>();
  private readonly byInternal = new Map<string, string>();

  constructor(private readonly bytes: ByteSource = cryptoBytes) {}

  /** The public id for an internal key; allocated once and then stable. */
  publicIdFor(kind: PublicIdKind, internalKey: string): string {
    const existing = this.byInternal.get(internalKey);
    if (existing) return existing;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = generatePublicId(kind, this.bytes);
      if (!this.byPublic.has(candidate)) {
        this.byPublic.set(candidate, internalKey);
        this.byInternal.set(internalKey, candidate);
        return candidate;
      }
    }
    throw new Error("could not allocate a unique public id");
  }

  internalKeyFor(publicId: string): string | undefined {
    return this.byPublic.get(publicId);
  }
}
