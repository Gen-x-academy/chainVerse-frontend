/**
 * Portable project portfolio export (CAPSTONE-016).
 *
 * The participant selects what to include; only selected, shareable items are
 * exported. The bundle carries integrity metadata (a SHA-256 digest over a
 * canonical form of its content) so a recipient can verify it was not altered,
 * and user-controlled sharing settings that travel with it. Private or
 * restricted items can never be exported, even if selected.
 */

export type PortfolioItemKind = "role" | "output" | "attestation" | "publication" | "credential";

export interface PortfolioItem {
  id: string;
  kind: PortfolioItemKind;
  title: string;
  /** Short public description. */
  summary: string;
  /** Items marked restricted (e.g. contain private proposal content) are never exported. */
  restricted?: boolean;
  /** Reference to supporting evidence by digest, never its content. */
  evidenceSha256?: string;
}

export interface SharingSettings {
  audience: "recipient_only" | "link_holders" | "public";
  /** ISO date after which the recipient should treat the bundle as expired. */
  expiresOn?: string;
}

export interface PortfolioBundle {
  schemaVersion: 1;
  exportedAt: string;
  owner: { displayName: string };
  sharing: SharingSettings;
  items: Array<Omit<PortfolioItem, "restricted">>;
  integrity: { algorithm: "SHA-256"; digest: string; itemCount: number };
}

export interface ExportOutcome {
  bundle: PortfolioBundle;
  /** Selected ids that were not exported, with the reason. */
  skipped: Array<{ id: string; reason: "NOT_FOUND" | "RESTRICTED" }>;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** JSON with sorted keys, so the digest does not depend on property order. */
export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((k) => record[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalize(record[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function digestOf(bundle: Omit<PortfolioBundle, "integrity">): Promise<string> {
  return sha256Hex(canonicalize(bundle));
}

export async function buildPortfolioExport(
  all: readonly PortfolioItem[],
  selectedIds: readonly string[],
  options: { displayName: string; sharing: SharingSettings; now: Date },
): Promise<ExportOutcome> {
  const byId = new Map(all.map((i) => [i.id, i]));
  const skipped: ExportOutcome["skipped"] = [];
  const items: PortfolioBundle["items"] = [];

  for (const id of [...new Set(selectedIds)]) {
    const item = byId.get(id);
    if (!item) skipped.push({ id, reason: "NOT_FOUND" });
    else if (item.restricted) skipped.push({ id, reason: "RESTRICTED" });
    else {
      const { restricted: _restricted, ...shareable } = item;
      items.push(shareable);
    }
  }
  items.sort((a, b) => a.id.localeCompare(b.id));

  const body: Omit<PortfolioBundle, "integrity"> = {
    schemaVersion: 1,
    exportedAt: options.now.toISOString(),
    owner: { displayName: options.displayName },
    sharing: options.sharing,
    items,
  };
  return { bundle: { ...body, integrity: { algorithm: "SHA-256", digest: await digestOf(body), itemCount: items.length } }, skipped };
}

export type VerifyResult = { ok: true } | { ok: false; code: "DIGEST_MISMATCH" | "COUNT_MISMATCH" | "EXPIRED" | "UNSUPPORTED_VERSION" };

/** Check a received bundle's integrity and (optionally) its expiry. */
export async function verifyPortfolioExport(bundle: PortfolioBundle, today?: string): Promise<VerifyResult> {
  if (bundle.schemaVersion !== 1) return { ok: false, code: "UNSUPPORTED_VERSION" };
  const { integrity, ...body } = bundle;
  if (integrity.itemCount !== bundle.items.length) return { ok: false, code: "COUNT_MISMATCH" };
  if ((await digestOf(body)) !== integrity.digest) return { ok: false, code: "DIGEST_MISMATCH" };
  if (today && bundle.sharing.expiresOn && bundle.sharing.expiresOn < today) return { ok: false, code: "EXPIRED" };
  return { ok: true };
}
