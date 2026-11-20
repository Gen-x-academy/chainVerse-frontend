# ChainVerse Frontend (v2)

The Next.js 16 frontend for **ChainVerse Academy** — a Web3 education platform
built on the Stellar blockchain. This app provides course browsing, enrollment,
instructor dashboards, Stellar wallet integration, NFT certificates, and a
DAO-governed reward system.

---

## Prerequisites

| Tool   | Version | Notes                                |
| ------ | ------- | ------------------------------------ |
| Node.js | **20.x** (LTS) | The CI workflow runs on Node 20. Newer majors (22, 24) work locally but CI is pinned. |
| npm    | 10+     | Bundled with Node 20. Yarn / pnpm may work but are untested in CI. |
| Backend | running | The API server (`mockup-backend`) must be reachable at the URL configured in `NEXT_PUBLIC_API_BASE_URL`. Default is `http://localhost:3001/api/v1`. |

---

## Quick start

```bash
# 1. Install dependencies
cd frontend-v2
npm install

# 2. Configure environment variables
cp .env.example .env.local
# then edit .env.local with your values

# 3. Start the dev server
npm run dev
# → http://localhost:3000
```

The first run takes ~30 s; subsequent runs are instant thanks to Next's
turbopack cache.

---

## Environment variables

All variables are prefixed with `NEXT_PUBLIC_` so Next.js inlines them into the
client bundle at build time. Do **not** put secrets in this file — use server
runtime config instead.

| Variable                              | Required | Example                                          | Description                                       |
| ------------------------------------- | -------- | ------------------------------------------------ | ------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL`            | ✅        | `http://localhost:3001/api/v1`                   | Base URL for all API requests. The `/health` endpoint is reached by stripping the trailing path segment (e.g. `http://localhost:3001/api/v1/health`). |
| `NEXT_PUBLIC_STELLAR_NETWORK`         | ✅        | `testnet`                                        | One of `testnet` or `mainnet`. Switches Horizon & Soroban URLs. |
| `NEXT_PUBLIC_HORIZON_URL`             | ✅        | `https://horizon-testnet.stellar.org`            | Stellar Horizon endpoint for balance/account queries. |
| `NEXT_PUBLIC_STELLAR_RPC_URL`         | ✅        | `https://soroban-testnet.stellar.org`            | Soroban RPC endpoint for contract calls.          |
| `NEXT_PUBLIC_STELLAR_PASSPHRASE`      | ✅        | `Test SDF Network ; September 2015`              | Network passphrase matching `STELLAR_NETWORK`.    |
| `NEXT_PUBLIC_CONTRACT_CERTIFICATES`   | ◻️       | (Soroban contract ID)                            | Address of the certificates contract.            |
| `NEXT_PUBLIC_CONTRACT_REWARD`         | ◻️       | (Soroban contract ID)                            | Address of the rewards contract.                 |
| `NEXT_PUBLIC_CONTRACT_CHV_TOKEN`      | ◻️       | (Soroban contract ID)                            | Address of the CHV token contract.                |
| `NEXT_PUBLIC_CONTRACT_COURSE_REGISTRY`| ◻️       | (Soroban contract ID)                            | Address of the course registry contract.          |
| `NEXT_PUBLIC_CONTRACT_ESCROW`         | ◻️       | (Soroban contract ID)                            | Address of the escrow contract for paid courses.  |
| `NEXT_PUBLIC_SENTRY_DSN`              | ◻️       | `https://...@sentry.io/...`                      | Optional Sentry DSN for client-side error reporting. |
| `NEXT_PUBLIC_PRIVACY_POLICY_URL`      | ◻️       | `/privacy`                                       | Privacy Policy link used by the footer newsletter consent copy. |
| `NEXT_PUBLIC_NEWSLETTER_UNSUBSCRIBE_URL` | ◻️    | `/unsubscribe`                                   | Unsubscribe link shown in newsletter success/consent UI. |

### Newsletter subscription

The footer newsletter posts to `POST {NEXT_PUBLIC_API_BASE_URL}/newsletter/subscribe` with
`{ email, consent: true, consentedAt, source: "footer" }`. The UI requires an explicit consent
checkbox, validates email client-side, throttles rapid resubmits (30s), and surfaces API
`409` (duplicate) and `429` (rate limit) responses.

See [`.env.example`](.env.example) for a complete template.

---

## Scripts

| Command              | What it does                                                                 |
| -------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`        | Starts the Next.js dev server with hot reload (turbopack).                   |
| `npm run build`      | Produces an optimized production build in `.next/`.                         |
| `npm run start`      | Serves the production build (run `build` first).                             |
| `npm run lint`       | Runs ESLint with the `eslint-config-next` ruleset.                            |
| `npm run analyze`    | Production build with `@next/bundle-analyzer` enabled (opens bundle map).    |
| `npm test`           | Runs the Vitest unit-test suite once and exits.                              |
| `npm run test:watch` | Runs Vitest in interactive watch mode.                                       |
| `npm run test:e2e`   | Runs the Playwright end-to-end tests (starts/reuses the dev server).          |
| `npm run test:e2e:visual` | Runs visual regression screenshots for critical journeys.                 |
| `npm run test:e2e:visual:update` | Regenerates screenshot baselines after intentional UI changes.   |

A typical validation loop before opening a PR:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

---

## Project structure

```
frontend-v2/
├── app/                       # Next.js App Router (root route group)
│   ├── layout.tsx             # Root <html>/<body>, mounts Providers
│   ├── page.tsx               # Landing page
│   ├── (main)/                # Routes wrapped with Header + Footer
│   │   ├── layout.tsx
│   │   └── ...
│   └── dashboard/             # Authenticated dashboard routes
├── src/
│   ├── components/            # Cross-cutting UI (Header, Footer, modals, layouts)
│   ├── features/              # Domain modules
│   │   ├── auth/              #   – login, register, password reset
│   │   ├── courses/           #   – browsing, detail, enrollment
│   │   ├── instructors/       #   – instructor dashboard & course CRUD
│   │   ├── students/          #   – student dashboard, wallet, certificates
│   │   └── notifications/     #   – in-app notification bell
│   ├── context/               # React context providers (Wallet, Toast, Wishlist)
│   ├── store/                 # Zustand stores (auth, cart, settings)
│   ├── lib/                   # Core utilities
│   │   ├── api-client.ts      #   – centralised fetch wrapper with refresh-token
│   │   ├── stellar.ts         #   – Stellar SDK + wallet-kit bootstrap
│   │   └── contracts.ts       #   – Soroban contract bindings
│   ├── shared/                # Generic, reusable components & utilities
│   ├── middleware.ts          # Edge middleware (auth guard)
│   └── pages/                 # Legacy page-style components
├── services/                  # Feature-agnostic API helpers
├── test/                      # Cross-cutting vitest specs
├── e2e/                       # Playwright specs
├── public/                    # Static assets served at /
├── next.config.ts             # Next.js config (security headers, images, bundle analyzer)
├── tsconfig.json              # TypeScript config (`@/*` and `@/src/*` path aliases)
├── eslint.config.mjs          # Flat ESLint config
└── vitest.config.ts           # Vitest config (jsdom env, jsx support)
```

### Path aliases

| Alias       | Resolves to              |
| ----------- | ------------------------ |
| `@/*`       | `frontend-v2/*`           |
| `@/src/*`   | `frontend-v2/src/*`       |

Use `@/src/...` for first-party imports and `@/...` for project-root files
like `next.config.ts` consumers.

---

## Architecture notes

### State management

* **Auth state** — Zustand store with `persist` middleware (`src/store/authStore.ts`). Survives full page refreshes.
* **Wallet state** — React context (`src/context/WalletContext.tsx`). Backed by `@creit.tech/stellar-wallets-kit`.
* **Server data** — TanStack Query v5 with the client in `src/lib/query-client.ts`. Default `staleTime` is 5 minutes; mutations surface errors via a global handler.

### API client

`src/lib/api-client.ts` is the single source of truth for HTTP. It:

1. Reads the access token from `localStorage` on every request.
2. On `401`, attempts a one-shot refresh via `POST /student/refresh-token`.
3. Falls back to `authService.logout()` + redirect to `/login?reason=session_expired` if the refresh fails.
4. Enforces a 10-second `AbortController` timeout per request.

Always import from `@/src/lib/api-client` rather than calling `fetch` directly.

### Authentication flow

1. `middleware.ts` checks for the `session` cookie on every protected route and redirects to `/auth/login?redirect=...` if missing.
2. `authService` (in `src/features/auth/services/auth.service.ts`) wraps `apiClient` for login/register/logout and exposes `isAuthenticated()` for client guards.
3. `RequireAuth` (in `src/features/auth/components/RequireAuth.tsx`) wraps client components that should only render for logged-in users.

### Wallet integration

The header surfaces a `ConnectWalletButton` for authenticated users. The button uses `WalletContext`, which:

1. Lazy-initializes `StellarWalletsKit` with the Freighter / Albedo / Hana / Rabet modules on first render.
2. Subscribes to `STATE_UPDATED` and `DISCONNECT` events to keep the React state in sync.
3. Pulls XLM & CHV balances from Horizon whenever the public key changes.

The public key is also surfaced through `useWallet().publicKey` so enrolment flows can attach it to a backend payment request.

---

## Testing

### Unit tests (Vitest)

```bash
npm test                 # one-off run
npm run test:watch       # watch mode
```

Tests live next to the code they exercise (`__tests__/` directories) and in
the top-level `test/` directory.

### End-to-end (Playwright)

```bash
npm run test:e2e
```

Playwright specs live in `e2e/`. The config starts (or reuses) the Next.js
dev server on port 3000.

### Visual regression (Playwright screenshots)

Critical journeys — landing, auth, catalog, course detail, dashboards, wallet,
checkout/payment, loading, and error states — are covered at desktop (`1280×720`)
and mobile (`390×844`) widths, including light/dark theme variants where theming
applies.

```bash
npm run test:e2e:visual          # compare against committed baselines
npm run test:e2e:visual:update   # refresh baselines after intentional UI changes
```

Helpers live in `e2e/helpers/visual.ts` (API mocks, session cookie, theme, motion
freeze). Baselines are stored next to the spec under
`e2e/visual-regression.spec.ts-snapshots/`. Screenshot pixels are
platform-sensitive (fonts); prefer regenerating on Linux/CI when baselines drift
without a real layout change.

**Checkout page** — `app/(main)/checkout/page.tsx` is the cart → pay destination
used by `CartModal`. An empty cart renders a stable payment empty-state for
visual coverage.

---

## Workspace: capstone & research projects

The workspace track adds capstone and research-project collaboration on top of
the existing course experience. The frontend pieces are documented in
[`docs/workspace-capstone.md`](docs/workspace-capstone.md), which covers:

* **CAPSTONE-070** — recording project decisions (statement, context,
  alternatives, approvers, effective date, linked evidence, superseding
  decisions).
* **CAPSTONE-071** — source-control references (repositories, branches, commits,
  releases, contribution metadata) via revocable provider connections and safe
  webhooks.
* **CAPSTONE-073** — proposal review queues (assignment, expertise fit, priority,
  conflict declaration, due date, workload).
* **CAPSTONE-075** — independent proposal reviews (criterion scores, comments,
  confidence, recommendation, conflicts, immutable submission-version linkage).

That document also records the tenant/role model, privacy boundaries, the
idempotency and optimistic-concurrency strategy, rollout/rollback notes, the
privacy-safe analytics event catalogue, and cross-repo coordination with the
backend and contract repositories.

### Project timeline, workspace & resources (CAPSTONE-063 / 065 / 068)

Each active project gets a scoped, permission-aware home under
`app/(main)/projects/[projectId]/`:

| Route | Work item | Purpose |
| ----- | --------- | ------- |
| `/projects/[projectId]/timeline` | CAPSTONE-063 | Stable, permission-aware timeline of objectives, tasks, milestones, decisions, reviews, funding, and charter changes. |
| `/projects/[projectId]/workspace` | CAPSTONE-065 | Project collaboration home: overview, members, objectives, milestones, resources, activity, and next actions. |
| `/projects/[projectId]/resources` | CAPSTONE-068 | Resource library: approved files, datasets, links, citations, licenses, versions, integrity metadata, and access policy. |

All three routes share the project layout (`app/(main)/projects/[projectId]/layout.tsx`),
which resolves the project, enforces tenant scoping, and renders role-aware
navigation (tabs the viewer cannot access are not rendered). Every route
implements explicit **loading**, **empty**, **error**, **conflict**, and
**success** states; invalid or stale lifecycle transitions surface a stable,
actionable error rather than a generic failure.

#### Typed service dependencies

Data access goes through typed services in `src/features/projects/services/`
(`project.service.ts`, `timeline.service.ts`, `workspace.service.ts`,
`resources.service.ts`), which wrap `@/src/lib/api-client` and TanStack Query
hooks in `src/features/projects/hooks/`. Response and request types live in
`src/features/projects/types/`. Never call `fetch` directly from these routes.

#### Authorization & tenant boundaries

* **Deny-by-default capabilities** — the UI renders actions only when the
  server-issued capability set for the project grants them; absence of a
  capability hides the action and the API rejects it regardless.
* **Tenant boundaries** — every request is scoped by `projectId`; the layout
  rejects projects outside the caller's tenant and never leaks cross-tenant
  identifiers in URLs, errors, or analytics.
* **Sensitive field minimization** — list and timeline payloads omit private
  proposal, research, identity, safety, and financial fields; detail views
  request only the fields the viewer is entitled to.

#### Privacy boundaries

Private proposal, research, identity, safety, and financial content must never
be written to logs, analytics, error reports, or public ledgers. Analytics
events carry only opaque project/entity IDs, capability names, and outcome
codes — never titles, member identities, amounts, or file contents.

#### Idempotency & optimistic concurrency

Mutations (membership, reservations, decisions, resource versions, and other
side-effecting actions) send an `Idempotency-Key` so retries and concurrent
requests cannot duplicate side effects. Updates send the entity's version /
`If-Match` token; a stale write returns `409` and the UI shows a conflict state
with a refresh-and-retry path instead of silently overwriting.

#### Deterministic fixtures & tests

Fixtures in `src/features/projects/__tests__/fixtures/` are deterministic
(fixed IDs, timestamps, and capability sets) and shared by component and
user-journey tests. Coverage includes keyboard navigation, screen-reader
labels/landmarks, responsive layouts (desktop and mobile), and the
loading/empty/error/conflict/success states.

```bash
npm test                                   # unit + component tests
npx vitest run src/features/projects        # project workspace tests only
npm run test:e2e                           # user-journey specs in e2e/
npm run test:e2e:visual                    # responsive visual checks
```

#### Rollout & rollback

Ship behind the `projects_workspace` feature flag so the routes can be enabled
per tenant. Rollout order: backend read endpoints → frontend read-only views →
mutations. Rollback is disabling the flag (routes fall back to a "not
available" state) — no data migration is required, and idempotency keys make
re-enabling safe.

#### Cross-repo coordination

| Work item | Frontend (this repo) | Backend | Contracts |
| --------- | -------------------- | ------- | --------- |
| CAPSTONE-063 | Timeline route, typed timeline service, capability-aware rendering | Timeline read model + lifecycle transition validation | — |
| CAPSTONE-065 | Workspace route, members/objectives/milestones/activity, idempotent membership mutations | Project workspace API, tenant scoping, capability issuance | — |
| CAPSTONE-068 | Resource library route, versions/integrity metadata/access policy | Resource metadata & access-policy API, signed upload/download | Integrity/version anchoring where applicable |

Coordinate API contracts and capability names with the backend and contract
repositories before enabling the flag.

---

## Contributing

1. Create a feature branch from `main`: `git checkout -b fix/<scope>-<issue-number>-<slug>`
2. Make focused commits. Run `npm run lint && npx tsc --noEmit && npm test` before pushing.
3. Push your branch and open a PR against `Gen-x-academy/chainVerse-frontend:main`.
4. Reference the issue your PR closes with `Closes #NNN` so the issue is auto-closed on merge.
5. The PR template (`.github/PULL_REQUEST_TEMPLATE.md`) is enforced — fill in the Description, Changes Made, and How to Test sections.

---

## Troubleshooting

**`NEXT_PUBLIC_API_BASE_URL is not configured`** — you forgot to copy `.env.example` to `.env.local`. Stop the dev server, create the file, and restart.

**Wallet modal opens but no extension is detected** — make sure the Freighter (or Albedo/Hana/Rabet) browser extension is installed and unlocked. The `StellarWalletsKit` falls back to a list of supported wallets if none are installed.

**Hydration mismatch warnings** — almost always caused by reading `localStorage` or `window` during render. Wrap such reads in `useEffect` or gate them with `typeof window !== 'undefined'`.

**Tests time out** — Vitest is configured with the jsdom environment. If a test tries to import a real network module, mock it with `vi.mock`.

---

## License

See [`LICENSE`](../LICENSE) in the repository root.
