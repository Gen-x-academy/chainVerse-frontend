# Shared Capstone Work Items: CAPSTONE-105, 106, 109, and 114

This document specifies the frontend implementation, architecture, lifecycle models, privacy and security boundaries, role permissions, and cross-repository dependencies for four coordinated Capstone work items:

- **CAPSTONE-105 / Drips #1531**: Capstone consent ledger (Privacy track)
- **CAPSTONE-106 / Drips #1532**: Project field-level privacy controls (Privacy track)
- **CAPSTONE-109 / Drips #1535**: Project secrets and sensitive-field protection (Privacy track)
- **CAPSTONE-114 / Drips #1540**: Participant project dashboard (Operations track)

---

## 1. New Routes and Navigation Behavior

### 1.1 App Router Routes
- `/projects/dashboard`: Centralized participant project dashboard. Renders active projects, upcoming and overdue deadlines, pending invitations, assigned milestones, reviews, funding actions, and recent activity.
- `/projects/[projectId]/consent`: Purpose-specific capstone consent ledger for managing participant consent across 7 distinct purposes.
- `/projects/[projectId]/privacy`: Field-level privacy controls for managing audience visibility across 9 project field categories.
- `/projects/[projectId]/secrets`: Project secrets and sensitive-field protection panel with masking, rotation workflows, and ephemeral state.

### 1.2 Navigation Integration
- **Main Header (`Header.tsx`)**: Authenticated navigation includes a direct link to `Projects` (`/projects/dashboard`).
- **Workspace Navigation (`layout.tsx`)**: Integrated into the workspace subnav with role-aware capability guards:
  - `Participant Dashboard` (`projects.dashboard.read`)
  - `Timeline` (`projects.timeline.read`)
  - `Workspace` (`projects.workspace.read`)
  - `Resources` (`projects.resources.read`)
  - `Consent` (`projects.consent.read`)
  - `Privacy` (`projects.privacy.read`)
  - `Secrets` (`projects.secrets.read`)
- **Project Workspace Header (`workspace/page.tsx`)**: Quick-action links directly connect `Consent`, `Privacy`, and `Secrets` from within active project workspaces.
- **Main Dashboard (`dashboard/page.tsx`)**: Provides prominent contextual callout to the Participant Projects Dashboard.

---

## 2. CAPSTONE-105: Capstone Consent Ledger

### 2.1 Purpose Taxonomy
Consent is managed independently for seven distinct purposes without blanket bundling:

1. **`matching`**: Project and mentor recommendation algorithms based on participant profile and skills (Optional).
2. **`collaboration`**: Project workspace access, document editing, and team discussions (Required for active research).
3. **`provider_access`**: Certified external compute, model evaluation, and dataset hosting pipelines (Optional; consequential on withdrawal).
4. **`integrity_checks`**: Plagiarism, citation verification, and ethics screening (Required for active research; consequential on withdrawal).
5. **`analytics`**: De-identified program evaluation and aggregate learning analytics (Optional).
6. **`publication`**: Public showcase catalog and research repository listing (Optional).
7. **`credentials`**: Completion proof verification and decentralized credential minting (Optional).

### 2.2 Lifecycle and Transitions
- **States**: `pending`, `granted`, `withdrawn`, `expired`, `unavailable`.
- **Allowed Transitions**:
  - `pending` &rarr; `granted` or `withdrawn`
  - `granted` &rarr; `withdrawn` or `expired`
  - `withdrawn` &rarr; `granted` (re-grant)
  - `expired` &rarr; `granted` (renewal)
  - `unavailable` is a policy-locked terminal state.
- **Consequential Actions**: Withdrawing `collaboration`, `integrity_checks`, or `provider_access` triggers an accessible confirmation modal warning that active project evaluation and write permissions will be paused.
- **Idempotency & Concurrency**: Requests carry client-generated `requestId` to prevent duplicate submissions on retry, and require `expectedRevision` for optimistic concurrency.

### 2.3 Privacy & Audit Boundaries
- **Zero Private Payloads**: Consent records and audit entries contain ONLY metadata: `recordId`, `purpose`, `state`, `fromState`, `toState`, `revision`, `timestamp`, and `organizationId`.
- **No Ledger Leakage**: Proposal text, research findings, participant contact info, and credentials are never placed in consent records or emitted to audit events.

---

## 3. CAPSTONE-106: Project Field-Level Privacy Controls

### 3.1 Field Categories and Audiences
Supports nine field categories:
1. `profiles`: Participant bios, affiliations, and profiles.
2. `proposals`: Problem statement, hypothesis, and research methodology.
3. `membership`: Contributor roster, workload allocations, and roles.
4. `notes`: Working discussion notes and collaborative deliberations.
5. `progress`: Milestone status, blockers, and sprint logs.
6. `outputs`: Submitted manuscripts, source code, and deliverables.
7. `locations`: Precise GPS coordinates and field research sites.
8. `funding`: Pledged budgets, expense records, and disbursements.
9. `achievements`: Verified milestone badges and minted credentials.

Supported audiences in ascending hierarchy:
- `owner`: Project creator/owner only.
- `members`: Accepted team contributors and supervisors.
- `collaborators`: Invited external collaborators.
- `providers`: Authorized verification and computational service providers.
- `organization_admin`: Sponsoring university or organization staff.
- `public`: Worldwide web users (unauthenticated).

### 3.2 Policy Locking & Consequential Warnings
- **Policy-Locked Fields**: Fields such as `locations` (field site safety) and `funding` (financial compliance) can be policy-locked by organizational compliance rules.
- **Public Visibility Confirmation**: Transitions to `public` visibility require explicit confirmation, warning the user that information will become accessible to anyone on the internet.
- **Data Filtering**: `filterProjectFieldsByAudience` guarantees that restricted fields are completely omitted from response representations before reaching unauthorized viewers.

---

## 4. CAPSTONE-109: Project Secrets and Sensitive-Field Protection

### 4.1 Sensitive Data Categories
1. `provider_tokens`: External API keys and computational tokens (`secret`).
2. `private_notes`: Sensitive supervisor feedback and ethics notes (`restricted`).
3. `precise_locations`: Exact latitude/longitude of field sites (`restricted`).
4. `unpublished_ip`: Patent drafts and proprietary trade secrets (`confidential`).
5. `evidence_keys`: Cryptographic keys used to sign provenance bundles (`secret`).
6. `datasets`: Regulated research survey datasets (`confidential`).
7. `payout_references`: Bank routing and escrow disbursement IDs (`secret`).

### 4.2 Security Boundaries & Key Rotation
- **Authoritative Encryption**: Encryption at rest and KMS key management are strictly server-side responsibilities. The frontend does not invent superficial client-side encryption or embed master keys.
- **Masking by Default**: Sensitive fields are masked with `••••••••••••`. Plaintext is never requested simply to render placeholders.
- **Ephemeral State**: Unmasked values and edit inputs are cleared from memory immediately upon form close, submission, or component unmount.
- **Key Rotation**: Supported for `provider_tokens` and `evidence_keys`. Rotation workflows require operational impact confirmation, utilize idempotency keys, increment `keyVersion`, and never expose the new or old secret in notifications or toasts.
- **Telemetry Sanitization**: `sanitizeTelemetryPayload` scrubs all tokens, keys, passwords, and private notes from analytics and client-side error reporting.

---

## 5. CAPSTONE-114: Participant Project Dashboard

### 5.1 Dashboard Information Sections
1. **Deadlines**: Chronological upcoming and overdue milestone and review deadlines.
2. **Invitations**: Pending project invitations with explicit `accept` and `decline` actions.
3. **Active Projects**: Active research projects with progress percentages, roles, and contextual links to Workspace, Consent, Privacy, and Secrets.
4. **Milestones**: Milestone progress and status tracking.
5. **Reviews**: Peer and supervisor reviews awaiting participant feedback.
6. **Funding**: Authorized funding awards and reimbursement claim links.
7. **Alerts**: Priority project notifications and integrity updates.
8. **Recent Activity**: Audit-derived activity timeline.

### 5.2 Partial API Failure Resilience
Each section is isolated in state management (`status`: `idle` | `loading` | `ready` | `empty` | `error`). If an individual backend service (e.g. funding or reviews) fails or times out, an inline retry banner renders for that section while the rest of the dashboard remains interactive.

### 5.3 Role-Aware Authorization
Student participants see participant-scoped views and cannot trigger admin-only funding approvals. Project owners and supervisors receive expanded privacy and secrets management controls.

---

## 6. Frontend Dependencies & Backend API Contracts

### Required Backend Endpoints

#### Consent (CAPSTONE-105)
- `GET /api/v1/capstone/projects/:projectId/consent`: Retrieve purpose consent records for participant.
- `POST /api/v1/capstone/projects/:projectId/consent/grant`: Grant consent for specific purpose (`idempotencyKey`, `expectedRevision`).
- `POST /api/v1/capstone/projects/:projectId/consent/withdraw`: Withdraw consent for specific purpose (`idempotencyKey`, `expectedRevision`).

#### Privacy Controls (CAPSTONE-106)
- `GET /api/v1/capstone/projects/:projectId/privacy`: Retrieve project field privacy policy.
- `PUT /api/v1/capstone/projects/:projectId/privacy`: Update field privacy settings (`If-Match: <revision>`, `idempotencyKey`).

#### Secrets & Sensitive Fields (CAPSTONE-109)
- `GET /api/v1/capstone/projects/:projectId/secrets`: Retrieve masked secret metadata.
- `POST /api/v1/capstone/projects/:projectId/secrets/:secretId/rotate`: Rotate provider secret or evidence key (`idempotencyKey`, `expectedRevision`).

#### Participant Dashboard (CAPSTONE-114)
- `GET /api/v1/capstone/participants/me/dashboard`: Consolidated or multi-endpoint dashboard snapshot.
- `POST /api/v1/capstone/invitations/:invitationId/respond`: Accept or decline invitation (`idempotencyKey`, `expectedRevision`).

---

## 7. Cross-Repository CAPSTONE Alignment

| Work Item | Drips Issue | This Repository (`frontend-v2`) | Related Backend Repositories |
|---|---|---|---|
| **CAPSTONE-105** | #1531 | Consent domain (`consent-ledger.ts`), UI (`ConsentLedgerPanel.tsx`), route (`/projects/[projectId]/consent`) | Capstone core consent ledger service, tamper-evident audit storage |
| **CAPSTONE-106** | #1532 | Field privacy domain (`field-privacy.ts`), UI (`ProjectPrivacyControlsPanel.tsx`), route (`/projects/[projectId]/privacy`) | Policy evaluation engine, API field-level authorization gateway |
| **CAPSTONE-109** | #1535 | Secrets protection domain (`secrets-protection.ts`), UI (`ProjectSecretsPanel.tsx`), route (`/projects/[projectId]/secrets`) | Vault/KMS integration, key rotation daemon, encrypted storage at rest |
| **CAPSTONE-114** | #1540 | Dashboard domain (`participant-dashboard.ts`), UI (`ParticipantDashboardView.tsx`), route (`/projects/dashboard`) | Participant aggregation service, invitation state machine, deadline scheduler |

---

## 8. Rollout, Rollback, and Known Limitations

### Rollout Plan
1. Ship domain modules and UI components behind capability permissions (`projects.consent.read`, `projects.privacy.read`, `projects.secrets.read`, `projects.dashboard.read`).
2. Deploy backend service updates exposing typed endpoints.
3. Enable navigation items progressively per tenant cohort.

### Rollback Plan
- Navigation links and pages respect deny-by-default capabilities. Revoking capabilities or removing layout navigation items disables user access without database rollback.
- Data structures are append-only / versioned, ensuring rollbacks do not cause data corruption.

### Known Limitations
- When running in an environment where the backend is not running live, initial states fall back to client-initialized defaults. Full production delivery requires live backend API integration.
