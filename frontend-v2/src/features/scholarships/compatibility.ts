/**
 * Scholarship contract & schema compatibility gate.
 *
 * Pure, dependency-free logic used by both the UI and the CI gate workflow:
 * it compares the *current* generated artifacts (typed API routes, emitted
 * events, database schema, and on-chain Stellar ABI) against an approved
 * baseline and classifies every difference as compatible, additive, or
 * breaking. Breaking changes are blocked until an explicit compatibility
 * approval exists (issue number / version bump), so incompatible API, event,
 * database, or on-chain ABI changes cannot merge unnoticed.
 */

export type ArtifactKind = 'api' | 'events' | 'db' | 'abi';
export type ChangeClass = 'compatible' | 'additive' | 'breaking';

// ─── Artifact shapes ──────────────────────────────────────────────────────────

export type ApiEndpoint = {
  route: string;
  method: string;
  requestFields?: string[];
  responseFields?: string[];
};
export type ApiArtifact = ApiEndpoint[];

export type EventField = { name: string; type: string; required?: boolean };
export type EventDefinition = { name: string; version: string; fields: EventField[] };
export type EventsArtifact = EventDefinition[];

export type DbColumn = { name: string; type: string; nullable?: boolean };
export type DbTable = { name: string; columns: DbColumn[] };
export type DbArtifact = DbTable[];

export type AbiInput = { name: string; type: string };
export type AbiEntry = {
  name: string;
  kind: 'function' | 'event';
  inputs?: AbiInput[];
  mutability?: string;
};
export type AbiArtifact = AbiEntry[];

export type Artifact = ApiArtifact | EventsArtifact | DbArtifact | AbiArtifact;

// ─── Change model ─────────────────────────────────────────────────────────────

export type ChangeReport = {
  artifact: ArtifactKind;
  entity: string;
  kind: 'added' | 'removed' | 'modified';
  changeClass: ChangeClass;
  reason: string;
  /** Stable key used to match an explicit compatibility approval. */
  approvalKey: string;
};

export type CompatibilityApproval = {
  approvalKey: string;
  /** Tracking issue that sanctioned the migration, when available. */
  issue?: string;
  version?: string;
  approvedBy: string;
  date: string;
};

export type ModulePair = { current: Artifact; baseline: Artifact };

export type CompatibilityGateResult = {
  ok: boolean;
  blocking: ChangeReport[];
  additive: ChangeReport[];
  compatible: ChangeReport[];
  blockedArtifacts: ArtifactKind[];
  consumers: Record<string, string[]>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function breaking(artifact: ArtifactKind, entity: string, kind: ChangeReport['kind'], reason: string): ChangeReport {
  return { artifact, entity, kind, changeClass: 'breaking', reason, approvalKey: `${artifact}:${entity}:${reason}` };
}

function additive(artifact: ArtifactKind, entity: string, kind: ChangeReport['kind'], reason: string): ChangeReport {
  return { artifact, entity, kind, changeClass: 'additive', reason, approvalKey: `${artifact}:${entity}:${reason}` };
}

function compatible(artifact: ArtifactKind, entity: string, kind: ChangeReport['kind'], reason: string): ChangeReport {
  return { artifact, entity, kind, changeClass: 'compatible', reason, approvalKey: `${artifact}:${entity}:${reason}` };
}

// ─── Per-artifact comparison ──────────────────────────────────────────────────

export function compareApiEndpoints(current: ApiArtifact, baseline: ApiArtifact): ChangeReport[] {
  const changes: ChangeReport[] = [];
  const currentByKey = new Map(current.map((endpoint) => [`${endpoint.method}:${endpoint.route}`, endpoint]));
  const baselineByKey = new Map(baseline.map((endpoint) => [`${endpoint.method}:${endpoint.route}`, endpoint]));

  const requestRemoved = (from: string[], to: string[]) => from.filter((field) => !to.includes(field));
  const responseRemoved = (from: string[], to: string[]) => from.filter((field) => !to.includes(field));
  const requestAdded = (from: string[], to: string[]) => to.filter((field) => !from.includes(field));

  for (const [key, endpoint] of currentByKey) {
    if (!baselineByKey.has(key)) {
      changes.push(additive('api', `${endpoint.method} ${endpoint.route}`, 'added', 'new-endpoint'));
      continue;
    }
    const before = baselineByKey.get(key)!;
    if (requestRemoved(before.requestFields ?? [], endpoint.requestFields ?? []).length > 0) {
      changes.push(breaking('api', `${endpoint.method} ${endpoint.route}`, 'modified', 'request-field-removed'));
    }
    if (responseRemoved(before.responseFields ?? [], endpoint.responseFields ?? []).length > 0) {
      changes.push(breaking('api', `${endpoint.method} ${endpoint.route}`, 'modified', 'response-field-removed'));
    }
    if (requestAdded(before.requestFields ?? [], endpoint.requestFields ?? []).length > 0) {
      changes.push(additive('api', `${endpoint.method} ${endpoint.route}`, 'modified', 'request-field-added'));
    }
  }

  for (const [key, endpoint] of baselineByKey) {
    if (!currentByKey.has(key)) {
      changes.push(breaking('api', `${endpoint.method} ${endpoint.route}`, 'removed', 'endpoint-removed'));
    }
  }

  return changes;
}

export function compareEvents(current: EventsArtifact, baseline: EventsArtifact): ChangeReport[] {
  const changes: ChangeReport[] = [];
  const currentByKey = new Map(current.map((event) => [event.name, event]));
  const baselineByKey = new Map(baseline.map((event) => [event.name, event]));

  for (const [name, event] of currentByKey) {
    if (!baselineByKey.has(name)) {
      changes.push(additive('events', name, 'added', 'event-added'));
      continue;
    }
    const before = baselineByKey.get(name)!;
    const beforeFields = new Map(before.fields.map((field) => [field.name, field]));
    const currentFields = new Map(event.fields.map((field) => [field.name, field]));

    for (const [fieldName, field] of beforeFields) {
      const next = currentFields.get(fieldName);
      if (!next) {
        changes.push(breaking('events', `${name}.${fieldName}`, 'modified', 'event-field-removed'));
        continue;
      }
      if (next.type !== field.type) {
        changes.push(breaking('events', `${name}.${fieldName}`, 'modified', 'event-field-type-changed'));
        continue;
      }
      if ((field.required || false) && next.required === false) {
        changes.push(compatible('events', `${name}.${fieldName}`, 'modified', 'event-field-relaxed'));
      }
      if (!(field.required || false) && next.required === true) {
        changes.push(breaking('events', `${name}.${fieldName}`, 'modified', 'event-field-made-required'));
      }
    }
    for (const [fieldName, field] of currentFields) {
      if (!beforeFields.has(fieldName)) {
        changes.push(additive('events', `${name}.${fieldName}`, 'modified', 'event-field-added'));
      }
    }
  }

  for (const name of baselineByKey.keys()) {
    if (!currentByKey.has(name)) {
      changes.push(breaking('events', name, 'removed', 'event-removed'));
    }
  }

  return changes;
}

export function compareDbSchemas(current: DbArtifact, baseline: DbArtifact): ChangeReport[] {
  const changes: ChangeReport[] = [];
  const currentTables = new Map(current.map((table) => [table.name, table]));
  const baselineTables = new Map(baseline.map((table) => [table.name, table]));

  for (const [tableName, table] of currentTables) {
    if (!baselineTables.has(tableName)) {
      changes.push(additive('db', tableName, 'added', 'table-added'));
      continue;
    }
    const before = baselineTables.get(tableName)!;
    const beforeColumns = new Map(before.columns.map((column) => [column.name, column]));
    const currentColumns = new Map(table.columns.map((column) => [column.name, column]));

    for (const [columnName, column] of beforeColumns) {
      const next = currentColumns.get(columnName);
      if (!next) {
        changes.push(breaking('db', `${tableName}.${columnName}`, 'modified', 'column-removed'));
        continue;
      }
      if (next.type !== column.type) {
        changes.push(breaking('db', `${tableName}.${columnName}`, 'modified', 'column-type-changed'));
        continue;
      }
      if ((column.nullable ?? true) && next.nullable === false) {
        changes.push(breaking('db', `${tableName}.${columnName}`, 'modified', 'column-made-not-null'));
      }
      if (column.nullable === false && (next.nullable ?? true)) {
        changes.push(compatible('db', `${tableName}.${columnName}`, 'modified', 'column-made-nullable'));
      }
    }
    for (const [columnName] of currentColumns) {
      if (!beforeColumns.has(columnName)) {
        changes.push(additive('db', `${tableName}.${columnName}`, 'modified', 'column-added'));
      }
    }
  }

  for (const tableName of baselineTables.keys()) {
    if (!currentTables.has(tableName)) {
      changes.push(breaking('db', tableName, 'removed', 'table-removed'));
    }
  }

  return changes;
}

export function compareAbis(current: AbiArtifact, baseline: AbiArtifact): ChangeReport[] {
  const changes: ChangeReport[] = [];
  const kindName = (entry: AbiEntry) => `${entry.kind}:${entry.name}`;
  const abiKey = (entry: AbiEntry) =>
    `${entry.kind}:${entry.name}(${(entry.inputs ?? []).map((input) => input.type).join(',')})`;
  const currentByKey = new Map(current.map((entry) => [abiKey(entry), entry]));
  const baselineByKey = new Map(baseline.map((entry) => [abiKey(entry), entry]));
  const currentByName = new Map(current.map((entry) => [kindName(entry), entry]));
  const baselineByName = new Map(baseline.map((entry) => [kindName(entry), entry]));

  for (const [key, entry] of currentByKey) {
    if (!baselineByKey.has(key)) {
      if (baselineByName.has(kindName(entry))) {
        changes.push(breaking('abi', `${entry.kind}:${entry.name}`, 'modified', 'abi-signature-changed'));
      } else {
        changes.push(additive('abi', key, 'added', 'abi-entry-added'));
      }
    }
  }
  for (const [kindNameKey, entry] of baselineByName) {
    if (!currentByName.has(kindNameKey)) {
      changes.push(breaking('abi', `${entry.kind}:${entry.name}`, 'removed', 'abi-entry-removed'));
    }
  }

  return changes;
}

export function compareArtifacts(kind: ArtifactKind, pair: ModulePair): ChangeReport[] {
  switch (kind) {
    case 'api':
      return compareApiEndpoints(pair.current as ApiArtifact, pair.baseline as ApiArtifact);
    case 'events':
      return compareEvents(pair.current as EventsArtifact, pair.baseline as EventsArtifact);
    case 'db':
      return compareDbSchemas(pair.current as DbArtifact, pair.baseline as DbArtifact);
    case 'abi':
      return compareAbis(pair.current as AbiArtifact, pair.baseline as AbiArtifact);
  }
}

// ─── Consumer mapping ─────────────────────────────────────────────────────────

/**
 * Consumers are named UI surfaces / modules that depend on a given artifact
 * entity. The map keys use the same shape as `ChangeReport.approvalKey` entity
 * segments (e.g. `api:POST /scholarships/applications`) so reports can be
 * joined to the consumers they break.
 */
export type ConsumerMap = Record<string, string[]>;

export function identifyConsumers(changes: ChangeReport[], consumers: ConsumerMap): Record<string, string[]> {
  const affected: Record<string, string[]> = {};
  for (const change of changes) {
    if (!change.changeClass) continue;
    const entity = `${change.artifact}:${entityOf(change)}`;
    const direct = consumers[change.approvalKey] ?? consumers[entity] ?? [];
    affected[change.approvalKey] = Array.from(new Set(direct));
  }
  return affected;
}

function entityOf(change: ChangeReport): string {
  return change.entity;
}

// ─── Gate evaluation ──────────────────────────────────────────────────────────

export function isApproved(change: ChangeReport, approvals: CompatibilityApproval[]): boolean {
  return approvals.some((approval) => approval.approvalKey === change.approvalKey);
}

export function evaluateCompatibilityGate(
  modules: Record<ArtifactKind, ModulePair>,
  approvals: CompatibilityApproval[],
  consumers?: ConsumerMap
): CompatibilityGateResult {
  const all: ChangeReport[] = [];
  for (const kind of Object.keys(modules) as ArtifactKind[]) {
    all.push(...compareArtifacts(kind, modules[kind]));
  }

  const blocking = all.filter((change) => change.changeClass === 'breaking' && !isApproved(change, approvals));
  const additiveChanges = all.filter((change) => change.changeClass === 'additive');
  const compatibleChanges = all.filter((change) => change.changeClass === 'compatible');
  const blockedArtifacts = Array.from(new Set(blocking.map((change) => change.artifact)));

  return {
    ok: blocking.length === 0,
    blocking,
    additive: additiveChanges,
    compatible: compatibleChanges,
    blockedArtifacts,
    consumers: consumers ? identifyConsumers(blocking, consumers) : {},
  };
}