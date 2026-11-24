'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useParams, useRouter } from 'next/navigation';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type ResourceKind =
  | 'file'
  | 'dataset'
  | 'link'
  | 'citation'
  | 'license';

type AccessLevel = 'project_members' | 'project_admins' | 'restricted';

interface ResourceVersion {
  versionId: string;
  version: number;
  createdAt: string;
  createdBy: string;
  integrityHash: string;
  sizeBytes?: number;
  note?: string;
}

interface ResourceItem {
  resourceId: string;
  projectId: string;
  kind: ResourceKind;
  title: string;
  description?: string;
  // Sensitive fields are intentionally minimized: no raw URLs with tokens,
  // no storage credentials, no private payloads.
  citationText?: string;
  licenseId?: string;
  licenseName?: string;
  accessLevel: AccessLevel;
  currentVersion: number;
  integrityHash: string;
  versions: ResourceVersion[];
  updatedAt: string;
  approved: boolean;
  expectedVersion: number;
}

interface ResourceListResponse {
  items: ResourceItem[];
  nextCursor?: string | null;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';
type SubmitState = 'idle' | 'submitting' | 'success' | 'error' | 'conflict';

interface ApiError {
  code: string;
  message: string;
  status: number;
}

/* -------------------------------------------------------------------------- */
/* Analytics (privacy-safe)                                                   */
/* -------------------------------------------------------------------------- */

function trackEvent(
  event: string,
  props: { projectId: string; resourceKind?: ResourceKind },
): void {
  // Privacy-safe: only project id + resource kind. No titles, URLs, hashes,
  // citations, or any private payloads are emitted.
  try {
    const payload = {
      event,
      projectId: props.projectId,
      resourceKind: props.resourceKind ?? null,
      ts: Date.now(),
    };
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.debug('[analytics]', payload);
    }
  } catch {
    /* analytics must never break the UI */
  }
}

/* -------------------------------------------------------------------------- */
/* API helpers                                                                */
/* -------------------------------------------------------------------------- */

async function parseError(res: Response): Promise<ApiError> {
  let code = 'unknown_error';
  let message = 'Something went wrong. Please try again.';
  try {
    const body = await res.json();
    if (body && typeof body === 'object') {
      code = typeof body.code === 'string' ? body.code : code;
      message = typeof body.message === 'string' ? body.message : message;
    }
  } catch {
    /* ignore parse errors */
  }
  return { code, message, status: res.status };
}

function makeIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* -------------------------------------------------------------------------- */
/* Small presentational helpers                                               */
/* -------------------------------------------------------------------------- */

const KIND_LABELS: Record<ResourceKind, string> = {
  file: 'File',
  dataset: 'Dataset',
  link: 'Link',
  citation: 'Citation',
  license: 'License',
};

const ACCESS_LABELS: Record<AccessLevel, string> = {
  project_members: 'Project members',
  project_admins: 'Project admins',
  restricted: 'Restricted',
};

function formatBytes(bytes?: number): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function shortHash(hash: string): string {
  if (!hash) return '—';
  return hash.length > 16 ? `${hash.slice(0, 12)}…` : hash;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function ProjectResourcesPage(): JSX.Element {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params?.projectId ?? '';

  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [resources, setResources] = useState<ResourceItem[]>([]);

  const [kindFilter, setKindFilter] = useState<ResourceKind | 'all'>('all');
  const [query, setQuery] = useState('');

  const [selected, setSelected] = useState<ResourceItem | null>(null);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [policyEditing, setPolicyEditing] = useState(false);
  const [policyValue, setPolicyValue] = useState<AccessLevel>('project_members');
  const [policyState, setPolicyState] = useState<SubmitState>('idle');
  const [policyError, setPolicyError] = useState<ApiError | null>(null);

  const idempotencyRef = useRef<string>(makeIdempotencyKey());
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  /* ------------------------------ Load list ------------------------------ */

  const loadResources = useCallback(async () => {
    if (!projectId) return;
    setLoadState('loading');
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/resources`,
        { headers: { Accept: 'application/json' }, credentials: 'same-origin' },
      );
      if (res.status === 401 || res.status === 403) {
        setLoadError({
          code: 'forbidden',
          message: 'You do not have access to this project’s resources.',
          status: res.status,
        });
        setLoadState('error');
        return;
      }
      if (!res.ok) {
        setLoadError(await parseError(res));
        setLoadState('error');
        return;
      }
      const data = (await res.json()) as ResourceListResponse;
      const items = Array.isArray(data.items) ? data.items : [];
      setResources(items);
      setLoadState(items.length === 0 ? 'empty' : 'ready');
      trackEvent('resources_viewed', { projectId });
    } catch {
      setLoadError({
        code: 'network_error',
        message: 'Could not load resources. Check your connection and retry.',
        status: 0,
      });
      setLoadState('error');
    }
  }, [projectId]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  /* ------------------------------ Filtering ------------------------------ */

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((r) => {
      if (kindFilter !== 'all' && r.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        (r.citationText ?? '').toLowerCase().includes(q) ||
        (r.licenseName ?? '').toLowerCase().includes(q)
      );
    });
  }, [resources, kindFilter, query]);

  /* ------------------------------ Register ------------------------------- */

  const handleRegister = useCallback(
    async (form: {
      kind: ResourceKind;
      title: string;
      description: string;
      citationText: string;
      licenseName: string;
      accessLevel: AccessLevel;
    }) => {
      if (!projectId) return;
      setSubmitState('submitting');
      setSubmitError(null);
      setSuccessMessage(null);
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/resources`,
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'Idempotency-Key': idempotencyRef.current,
            },
            body: JSON.stringify({
              kind: form.kind,
              title: form.title.trim(),
              description: form.description.trim() || undefined,
              citationText: form.citationText.trim() || undefined,
              licenseName: form.licenseName.trim() || undefined,
              accessLevel: form.accessLevel,
            }),
          },
        );

        if (res.status === 409) {
          setSubmitError(await parseError(res));
          setSubmitState('conflict');
          return;
        }
        if (res.status === 401 || res.status === 403) {
          setSubmitError({
            code: 'forbidden',
            message: 'You are not allowed to register resources in this project.',
            status: res.status,
          });
          setSubmitState('error');
          return;
        }
        if (!res.ok) {
          setSubmitError(await parseError(res));
          setSubmitState('error');
          return;
        }

        const created = (await res.json()) as ResourceItem;
        setResources((prev) => {
          const withoutDup = prev.filter(
            (r) => r.resourceId !== created.resourceId,
          );
          return [created, ...withoutDup];
        });
        setLoadState('ready');
        setSubmitState('success');
        setSuccessMessage(`“${created.title}” was registered.`);
        setRegisterOpen(false);
        // Rotate idempotency key after a successful create so retries of a
        // *new* resource are not deduped against the previous one.
        idempotencyRef.current = makeIdempotencyKey();
        trackEvent('resource_registered', {
          projectId,
          resourceKind: created.kind,
        });
      } catch {
        setSubmitError({
          code: 'network_error',
          message: 'Could not register resource. Please retry.',
          status: 0,
        });
        setSubmitState('error');
      }
    },
    [projectId],
  );

  /* --------------------------- Policy editing ---------------------------- */

  const openPolicyEditor = useCallback((item: ResourceItem) => {
    setSelected(item);
    setPolicyValue(item.accessLevel);
    setPolicyError(null);
    setPolicyState('idle');
    setPolicyEditing(true);
  }, []);

  const handlePolicySave = useCallback(async () => {
    if (!selected || !projectId) return;
    setPolicyState('submitting');
    setPolicyError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/resources/${encodeURIComponent(
          selected.resourceId,
        )}/access-policy`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Idempotency-Key': makeIdempotencyKey(),
          },
          body: JSON.stringify({
            accessLevel: policyValue,
            expectedVersion: selected.expectedVersion,
          }),
        },
      );

      if (res.status === 409) {
        setPolicyError(await parseError(res));
        setPolicyState('conflict');
        return;
      }
      if (res.status === 401 || res.status === 403) {
        setPolicyError({
          code: 'forbidden',
          message: 'You are not allowed to change access policy.',
          status: res.status,
        });
        setPolicyState('error');
        return;
      }
      if (!res.ok) {
        setPolicyError(await parseError(res));
        setPolicyState('error');
        return;
      }

      const updated = (await res.json()) as ResourceItem;
      setResources((prev) =>
        prev.map((r) => (r.resourceId === updated.resourceId ? updated : r)),
      );
      setSelected(updated);
      setPolicyState('success');
      setPolicyEditing(false);
      setSuccessMessage('Access policy updated.');
      trackEvent('resource_policy_updated', {
        projectId,
        resourceKind: updated.kind,
      });
    } catch {
      setPolicyError({
        code: 'network_error',
        message: 'Could not update access policy. Please retry.',
        status: 0,
      });
      setPolicyState('error');
    }
  }, [selected, projectId, policyValue]);

  /* ------------------------------ Renderers ------------------------------ */

  const renderStateBanner = () => {
    if (loadState === 'loading') {
      return (
        <div role="status" aria-live="polite" className="rv-banner rv-banner--info">
          Loading resources…
        </div>
      );
    }
    if (loadState === 'error' && loadError) {
      return (
        <div role="alert" className="rv-banner rv-banner--error">
          <span>{loadError.message}</span>
          <button type="button" className="rv-btn rv-btn--sm" onClick={() => void loadResources()}>
            Retry
          </button>
        </div>
      );
    }
    if (loadState === 'empty') {
      return (
        <div role="status" className="rv-banner rv-banner--empty">
          No resources yet. Register the first approved file, dataset, link,
          citation, or license for this project.
        </div>
      );
    }
    return null;
  };

  return (
    <main className="rv-resources" aria-labelledby="rv-resources-title">
      <header className="rv-resources__header">
        <div>
          <h1 id="rv-resources-title" className="rv-resources__title">
            Project resource library
          </h1>
          <p className="rv-resources__subtitle">
            Approved files, datasets, links, citations, and licenses with
            versions, integrity metadata, and access policy.
          </p>
        </div>
        <button
          type="button"
          className="rv-btn rv-btn--primary"
          onClick={() => {
            setSubmitState('idle');
            setSubmitError(null);
            setRegisterOpen(true);
          }}
          aria-haspopup="dialog"
        >
          Register resource
        </button>
      </header>

      {/* Live region for screen readers */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="rv-sr-only"
      >
        {successMessage ?? ''}
      </div>

      {successMessage && (
        <div role="status" className="rv-banner rv-banner--success">
          {successMessage}
        </div>
      )}

      {renderStateBanner()}

      {/* Filters */}
      <section aria-label="Filters" className="rv-filters">
        <div className="rv-field">
          <label htmlFor="rv-filter-kind" className="rv-label">
            Kind
          </label>
          <select
            id="rv-filter-kind"
            className="rv-input"
            value={kindFilter}
            onChange={(e) =>
              setKindFilter(e.target.value as ResourceKind | 'all')
            }
          >
            <option value="all">All kinds</option>
            {(Object.keys(KIND_LABELS) as ResourceKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="rv-field rv-field--grow">
          <label htmlFor="rv-filter-query" className="rv-label">
            Search
          </label>
          <input
            id="rv-filter-query"
            type="search"
            className="rv-input"
            placeholder="Search title, description, citation, license"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </section>

      {/* List */}
      {loadState === 'ready' && filtered.length === 0 && (
        <div role="status" className="rv-banner rv-banner--empty">
          No resources match the current filters.
        </div>
      )}

      {filtered.length > 0 && (
        <ul className="rv-resource-list" aria-label="Project resources">
          {filtered.map((item) => (
            <li key={item.resourceId} className="rv-resource-card">
              <div className="rv-resource-card__head">
                <span className="rv-badge">{KIND_LABELS[item.kind]}</span>
                <h2 className="rv-resource-card__title">{item.title}</h2>
                {item.approved ? (
                  <span className="rv-badge rv-badge--ok">Approved</span>
                ) : (
                  <span className="rv-badge rv-badge--warn">Pending</span>
                )}
              </div>

              {item.description && (
                <p className="rv-resource-card__desc">{item.description}</p>
              )}

              <dl className="rv-meta">
                <div>
                  <dt>Access</dt>
                  <dd>{ACCESS_LABELS[item.accessLevel]}</dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>v{item.currentVersion}</dd>
                </div>
                <div>
                  <dt>Integrity</dt>
                  <dd>
                    <code title={item.integrityHash}>
                      {shortHash(item.integrityHash)}
                    </code>
                  </dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDate(item.updatedAt)}</dd>
                </div>
                {item.licenseName && (
                  <div>
                    <dt>License</dt>
                    <dd>{item.licenseName}</dd>
                  </div>
                )}
              </dl>

              {item.citationText && (
                <blockquote className="rv-citation">
                  {item.citationText}
                </blockquote>
              )}

              <div className="rv-resource-card__actions">
                <button
                  type="button"
                  className="rv-btn rv-btn--sm"
                  onClick={() => setSelected(item)}
                  aria-label={`View details and versions for ${item.title}`}
                >
                  Details &amp; versions
                </button>
                <button
                  type="button"
                  className="rv-btn rv-btn--sm"
                  onClick={() => openPolicyEditor(item)}
                  aria-label={`Edit access policy for ${item.title}`}
                >
                  Edit access policy
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Details / version history */}
      {selected && !policyEditing && (
        <section
          className="rv-panel"
          aria-labelledby="rv-details-title"
          role="region"
        >
          <div className="rv-panel__head">
            <h2 id="rv-details-title">{selected.title}</h2>
            <button
              type="button"
              className="rv-btn rv-btn--sm"
              onClick={() => setSelected(null)}
              aria-label="Close details"
            >
              Close
            </button>
          </div>
          <p>
            <strong>Kind:</strong> {KIND_LABELS[selected.kind]} &nbsp;|&nbsp;{' '}
            <strong>Access:</strong> {ACCESS_LABELS[selected.accessLevel]}
          </p>
          <h3>Version history</h3>
          {selected.versions.length === 0 ? (
            <p className="rv-muted">No version history available.</p>
          ) : (
            <ol className="rv-versions">
              {selected.versions.map((v) => (
                <li key={v.versionId} className="rv-version">
                  <span className="rv-version__num">v{v.version}</span>
                  <span className="rv-version__meta">
                    {formatDate(v.createdAt)} · {v.createdBy} ·{' '}
                    {formatBytes(v.sizeBytes)} ·{' '}
                    <code title={v.integrityHash}>
                      {shortHash(v.integrityHash)}
                    </code>
                  </span>
                  {v.note && <span className="rv-version__note">{v.note}</span>}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {/* Access policy editor */}
      {policyEditing && selected && (
        <section
          className="rv-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rv-policy-title"
        >
          <div className="rv-panel__head">
            <h2 id="rv-policy-title">Edit access policy</h2>
            <button
              type="button"
              className="rv-btn rv-btn--sm"
              onClick={() => setPolicyEditing(false)}
              aria-label="Cancel access policy editing"
            >
              Cancel
            </button>
          </div>
          <p className="rv-muted">
            Resource: {selected.title} (v{selected.currentVersion})
          </p>
          <div className="rv-field">
            <label htmlFor="rv-policy-level" className="rv-label">
              Access level
            </label>
            <select
              id="rv-policy-level"
              className="rv-input"
              value={policyValue}
              onChange={(e) => setPolicyValue(e.target.value as AccessLevel)}
            >
              {(Object.keys(ACCESS_LABELS) as AccessLevel[]).map((a) => (
                <option key={a} value={a}>
                  {ACCESS_LABELS[a]}
                </option>
              ))}
            </select>
          </div>

          {policyState === 'conflict' && policyError && (
            <div role="alert" className="rv-banner rv-banner--error">
              <span>
                This resource changed since you opened it ({policyError.message}).
                Reload to get the latest version before retrying.
              </span>
              <button
                type="button"
                className="rv-btn rv-btn--sm"
                onClick={() => void loadResources()}
              >
                Reload
              </button>
            </div>
          )}
          {policyState === 'error' && policyError && (
            <div role="alert" className="rv-banner rv-banner--error">
              {policyError.message}
            </div>
          )}

          <div className="rv-panel__actions">
            <button
              type="button"
              className="rv-btn rv-btn--primary"
              onClick={() => void handlePolicySave()}
              disabled={policyState === 'submitting'}
            >
              {policyState === 'submitting' ? 'Saving…' : 'Save policy'}
            </button>
          </div>
        </section>
      )}

      {/* Register dialog */}
      {registerOpen && (
        <RegisterDialog
          submitState={submitState}
          submitError={submitError}
          onCancel={() => setRegisterOpen(false)}
          onSubmit={handleRegister}
        />
      )}

      <style jsx>{`
        .rv-resources {
          max-width: 960px;
          margin: 0 auto;
          padding: 1.5rem 1rem 3rem;
        }
        .rv-resources__header {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        .rv-resources__title {
          font-size: 1.5rem;
          margin: 0 0 0.25rem;
        }
        .rv-resources__subtitle {
          margin: 0;
          color: #555;
          max-width: 42rem;
        }
        .rv-banner {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          margin: 0.75rem 0;
          font-size: 0.95rem;
        }
        .rv-banner--info {
          background: #eef4ff;
          color: #1a3d7c;
        }
        .rv-banner--error {
          background: #fdecec;
          color: #8a1c1c;
        }
        .rv-banner--empty {
          background: #f5f5f5;
          color: #444;
        }
        .rv-banner--success {
          background: #e9f7ee;
          color: #1c6b3a;
        }
        .rv-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin: 1rem 0;
        }
        .rv-field {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .rv-field--grow {
          flex: 1 1 16rem;
        }
        .rv-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: #333;
        }
        .rv-input {
          padding: 0.5rem 0.6rem;
          border: 1px solid #c9c9c9;
          border-radius: 6px;
          font-size: 0.95rem;
          min-width: 10rem;
        }
        .rv-input:focus-visible,
        .rv-btn:focus-visible {
          outline: 2px solid #2b6cb0;
          outline-offset: 2px;
        }
        .rv-btn {
          cursor: pointer;
          border: 1px solid #c9c9c9;
          background: #fff;
          border-radius: 6px;
          padding: 0.5rem 0.9rem;
          font-size: 0.95rem;
        }
        .rv-btn--sm {
          padding: 0.35rem 0.6rem;
          font-size: 0.85rem;
        }
        .rv-btn--primary {
          background: #2b6cb0;
          border-color: #2b6cb0;
          color: #fff;
        }
        .rv-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .rv-resource-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 1rem;
        }
        .rv-resource-card {
          border: 1px solid #e2e2e2;
          border-radius: 10px;
          padding: 1rem;
          background: #fff;
        }
        .rv-resource-card__head {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }
        .rv-resource-card__title {
          font-size: 1.1rem;
          margin: 0;
          flex: 1 1 auto;
        }
        .rv-resource-card__desc {
          margin: 0.5rem 0;
          color: #444;
        }
        .rv-badge {
          font-size: 0.75rem;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
          background: #eef1f5;
          color: #333;
        }
        .rv-badge--ok {
          background: #e9f7ee;
          color: #1c6b3a;
        }
        .rv-badge--warn {
          background: #fff4e0;
          color: #8a5a00;
        }
        .rv-meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
          gap: 0.5rem 1rem;
          margin: 0.75rem 0;
        }
        .rv-meta dt {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: #777;
        }
        .rv-meta dd {
          margin: 0;
          font-size: 0.9rem;
        }
        .rv-citation {
          border-left: 3px solid #d0d7e2;
          margin: 0.5rem 0;
          padding: 0.25rem 0.75rem;
          color: #333;
          font-size: 0.9rem;
        }
        .rv-resource-card__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        .rv-panel {
          border: 1px solid #e2e2e2;
          border-radius: 10px;
          padding: 1rem;
          margin-top: 1.5rem;
          background: #fafafa;
        }
        .rv-panel__head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
        }
        .rv-panel__actions {
          margin-top: 1rem;
        }
        .rv-versions {
          padding-left: 1.25rem;
          margin: 0.5rem 0;
        }
        .rv-version {
          margin-bottom: 0.5rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: baseline;
        }
        .rv-version__num {
          font-weight: 600;
        }
        .rv-version__meta {
          font-size: 0.85rem;
          color: #555;
        }
        .rv-version__note {
          font-size: 0.85rem;
          color: #333;
        }
        .rv-muted {
          color: #777;
          font-size: 0.9rem;
        }
        .rv-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        @media (max-width: 600px) {
          .rv-resources__header {
            flex-direction: column;
          }
          .rv-resource-card__actions {
            flex-direction: column;
          }
          .rv-resource-card__actions .rv-btn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Register dialog                                                            */
/* -------------------------------------------------------------------------- */

interface RegisterDialogProps {
  submitState: SubmitState;
  submitError: ApiError | null;
  onCancel: () => void;
  onSubmit: (form: {
    kind: ResourceKind;
    title: string;
    description: string;
    citationText: string;
    licenseName: string;
    accessLevel: AccessLevel;
  }) => void;
}

function RegisterDialog({
  submitState,
  submitError,
  onCancel,
  onSubmit,
}: RegisterDialogProps): JSX.Element {
  const [kind, setKind] = useState<ResourceKind>('file');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [citationText, setCitationText] = useState('');
  const [licenseName, setLicenseName] = useState('');
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('project_members');
  const [touched, setTouched] = useState(false);

  const titleError = touched && title.trim().length === 0;
  const submitting = submitState === 'submitting';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (title.trim().length === 0) return;
    onSubmit({
      kind,
      title,
      description,
      citationText,
      licenseName,
      accessLevel,
    });
  };

  return (
    <div
      className="rv-dialog-backdrop"
      role="presentation"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !submitting) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rv-register-title"
        className="rv-dialog"
      >
        <h2 id="rv-register-title">Register resource</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className="rv-field">
            <label htmlFor="rv-reg-kind" className="rv-label">
              Kind
            </label>
            <select
              id="rv-reg-kind"
              className="rv-input"
              value={kind}
              onChange={(e) => setKind(e.target.value as ResourceKind)}
              disabled={submitting}
            >
              {(Object.keys(KIND_LABELS) as ResourceKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <div className="rv-field">
            <label htmlFor="rv-reg-title" className="rv-label">
              Title <span aria-hidden="true">*</span>
            </label>
            <input
              id="rv-reg-title"
              className="rv-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-required="true"
              aria-invalid={titleError || undefined}
              aria-describedby={titleError ? 'rv-reg-title-err' : undefined}
              disabled={submitting}
            />
            {titleError && (
              <span id="rv-reg-title-err" className="rv-error" role="alert">
                Title is required.
              </span>
            )}
          </div>

          <div className="rv-field">
            <label htmlFor="rv-reg-desc" className="rv-label">
              Description
            </label>
            <textarea
              id="rv-reg-desc"
              className="rv-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              disabled={submitting}
            />
          </div>

          {(kind === 'citation' || kind === 'link') && (
            <div className="rv-field">
              <label htmlFor="rv-reg-citation" className="rv-label">
                Citation / reference
              </label>
              <textarea
                id="rv-reg-citation"
                className="rv-input"
                value={citationText}
                onChange={(e) => setCitationText(e.target.value)}
                rows={2}
                disabled={submitting}
              />
            </div>
          )}

          {kind === 'license' && (
            <div className="rv-field">
              <label htmlFor="rv-reg-license" className="rv-label">
                License name
              </label>
              <input
                id="rv-reg-license"
                className="rv-input"
                value={licenseName}
                onChange={(e) => setLicenseName(e.target.value)}
                disabled={submitting}
              />
            </div>
          )}

          <div className="rv-field">
            <label htmlFor="rv-reg-access" className="rv-label">
              Access level
            </label>
            <select
              id="rv-reg-access"
              className="rv-input"
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}
              disabled={submitting}
            >
              {(Object.keys(ACCESS_LABELS) as AccessLevel[]).map((a) => (
                <option key={a} value={a}>
                  {ACCESS_LABELS[a]}
                </option>
              ))}
            </select>
          </div>

          {submitState === 'conflict' && submitError && (
            <div role="alert" className="rv-banner rv-banner--error">
              {submitError.message}
            </div>
          )}
          {submitState === 'error' && submitError && (
            <div role="alert" className="rv-banner rv-banner--error">
              {submitError.message}
            </div>
          )}

          <div className="rv-dialog__actions">
            <button
              type="button"
              className="rv-btn"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rv-btn rv-btn--primary"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}