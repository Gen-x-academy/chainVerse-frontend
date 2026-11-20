/**
 * Reproducible research package export (CAPSTONE-096 / issue #1522).
 *
 * Packages only permitted, public outputs together with metadata, citations,
 * dependency manifest, checksums, licenses and reproduction steps. Private
 * participant/research content never enters a package or its audit record.
 * Deterministic, tenant-scoped and idempotent on `requestId`.
 */
import { canonicalize, sha256Hex } from "./portfolio-export";

export const PACKAGE_SCHEMA_VERSION = 1;
export const EXPORT_ROLES = ["supervisor", "organization_staff", "administrator"] as const;
export type ExportRole = (typeof EXPORT_ROLES)[number];

export interface PackageActor {
  id: string;
  role: string;
  organizationId: string;
}

export interface PackageResource {
  projectId: string;
  organizationId: string;
  /** Only completed work may be packaged. */
  projectState: string;
  revision: number;
  assignedIds?: readonly string[];
  /** Never exported; present so private fields can be explicitly stripped. */
  privatePayloads?: unknown;
}

export interface PackageOutput {
  id: string;
  projectId: string;
  /** Only `public` outputs can leave the tenant boundary. */
  visibility: "public" | "team" | "restricted";
  path: string;
  title: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  license: string;
  citation?: { title: string; year: number; authors?: readonly string[] };
  dependsOn?: readonly string[];
}

export interface ExportRequest {
  requestId: string;
  actor: PackageActor;
  resource: PackageResource;
  outputIds: readonly string[];
  sharing: { audience: "recipient_only" | "link_holders" | "public"; expiresAt: string };
  now: string;
}

export type ExportErrorCode =
  | "UNKNOWN_ROLE"
  | "NOT_PERMITTED"
  | "TENANT_MISMATCH"
  | "STALE_REVISION"
  | "NOT_EXPORTABLE"
  | "INVALID_EXPIRY"
  | "EMPTY_PACKAGE"
  | "INVALID_CHECKSUM";

export type ExportResult =
  | { ok: true; package: ResearchPackage; skipped: Array<{ id: string; reason: string }>; replayed: boolean }
  | { ok: false; code: ExportErrorCode; message: string };

export type ExportLedger = Map<string, ExportResult>;

export interface ResearchPackage {
  schemaVersion: 1;
  kind: "research-package";
  projectId: string;
  exportedAt: string;
  sharing: ExportRequest["sharing"];
  outputs: Array<Omit<PackageOutput, "visibility" | "projectId">>;
  manifest: { dependencyIds: string[]; checksums: Array<{ id: string; sha256: string }> };
  citations: Array<{ outputId: string; title: string; year: number; authors?: readonly string[] }>;
  licenses: Array<{ outputId: string; license: string }>;
  reproducibility: readonly string[];
  integrity: { algorithm: "SHA-256"; digest: string; outputCount: number };
}

const COMPLETED_STATES = ["completed", "published", "archived"];
const REPRODUCIBILITY_STEPS = [
  "Fetch the listed outputs by id and verify each SHA-256 checksum before use.",
  "Resolve the dependency manifest in declaration order; confirm each license permits reuse.",
  "Record the exportedAt timestamp and sharing expiry with any derived result.",
] as const;

export function isValidChecksum(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

export async function buildResearchPackage(
  request: ExportRequest,
  outputs: readonly PackageOutput[],
  ledger: ExportLedger = new Map(),
): Promise<ExportResult> {
  const earlier = ledger.get(request.requestId);
  if (earlier) return earlier.ok ? { ...earlier, replayed: true } : earlier;
  const record = (result: ExportResult): ExportResult => {
    ledger.set(request.requestId, result);
    return result;
  };
  const fail = (code: ExportErrorCode, message: string) => record({ ok: false, code, message });

  // Deny by default: unknown roles, wrong tenant and unassigned projects reveal nothing.
  if (!(EXPORT_ROLES as readonly string[]).includes(request.actor.role)) return fail("UNKNOWN_ROLE", "This role cannot export research packages.");
  if (request.actor.organizationId !== request.resource.organizationId) return fail("TENANT_MISMATCH", "The package belongs to another organization.");
  if (request.actor.role === "supervisor" && !request.resource.assignedIds?.includes(request.actor.id)) {
    return fail("NOT_PERMITTED", "You are not assigned to this project.");
  }
  if (request.resource.revision <= 0) return fail("STALE_REVISION", "Reload the project before exporting.");
  if (!COMPLETED_STATES.includes(request.resource.projectState)) return fail("NOT_EXPORTABLE", "Only completed projects can be exported.");
  const expires = Date.parse(request.sharing.expiresAt);
  if (!request.requestId.trim() || !Number.isFinite(expires) || expires <= Date.parse(request.now)) {
    return fail("INVALID_EXPIRY", "Access expiry must be a future timestamp.");
  }

  const byId = new Map(outputs.map((o) => [o.id, o]));
  const skipped: Array<{ id: string; reason: string }> = [];
  const selected: PackageOutput[] = [];
  for (const id of [...new Set(request.outputIds)]) {
    const output = byId.get(id);
    if (!output || output.projectId !== request.resource.projectId) skipped.push({ id, reason: "NOT_FOUND" });
    else if (output.visibility !== "public") skipped.push({ id, reason: "NOT_PERMITTED" });
    else if (!isValidChecksum(output.sha256)) return fail("INVALID_CHECKSUM", `Output ${id} has an invalid checksum.`);
    else selected.push(output);
  }
  if (selected.length === 0) return fail("EMPTY_PACKAGE", "No permitted outputs were selected.");

  selected.sort((a, b) => a.id.localeCompare(b.id));
  const body = {
    schemaVersion: PACKAGE_SCHEMA_VERSION as const,
    kind: "research-package" as const,
    projectId: request.resource.projectId,
    exportedAt: request.now,
    sharing: request.sharing,
    outputs: selected.map(({ visibility: _visibility, projectId: _projectId, ...rest }) => rest),
    manifest: {
      dependencyIds: [...new Set(selected.flatMap((o) => o.dependsOn ?? []))].sort(),
      checksums: selected.map((o) => ({ id: o.id, sha256: o.sha256 })),
    },
    citations: selected.flatMap((o) => o.citation ? [{ outputId: o.id, ...o.citation }] : []),
    licenses: selected.map((o) => ({ outputId: o.id, license: o.license })),
    reproducibility: REPRODUCIBILITY_STEPS,
  };
  const digest = await sha256Hex(canonicalize(body));
  return record({
    ok: true,
    package: { ...body, integrity: { algorithm: "SHA-256", digest, outputCount: selected.length } },
    skipped,
    replayed: false,
  });
}

/** Recompute a received package's digest; never reads participant data. */
export async function verifyPackageIntegrity(pkg: ResearchPackage): Promise<boolean> {
  const { integrity, ...body } = pkg;
  if (integrity.algorithm !== "SHA-256" || integrity.outputCount !== pkg.outputs.length) return false;
  return (await sha256Hex(canonicalize(body))) === integrity.digest;
}

/** Privacy-safe audit entry: no titles, citations, payloads or private fields. */
export function exportAuditRecord(result: ExportResult): Record<string, string | number | boolean> {
  if (!result.ok) return { outcome: "denied", code: result.code };
  return {
    outcome: "exported",
    projectId: result.package.projectId,
    outputCount: result.package.integrity.outputCount,
    replayed: result.replayed,
    expiresAt: result.package.sharing.expiresAt,
  };
}
