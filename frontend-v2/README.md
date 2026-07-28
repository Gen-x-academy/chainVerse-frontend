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
