# ChainVerse Frontend v2

A Next.js 14 application for the ChainVerse learning platform.

## Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- Copy `.env.example` to `.env.local` and fill in the required values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL for the backend API |
| `NEXTAUTH_SECRET` | Secret for NextAuth session signing |
| `NEXTAUTH_URL` | Canonical URL of the app (e.g. `http://localhost:3000`) |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
frontend-v2/
├── app/              # Next.js App Router pages and layouts
├── src/
│   ├── components/   # Reusable UI components
│   ├── features/     # Feature-scoped modules
│   ├── store/        # Global state (Zustand)
│   ├── hooks/        # Custom React hooks
│   └── shared/       # Shared utilities and types
├── services/         # API service layer
├── utils/            # Helper functions and validators
└── e2e/              # Playwright end-to-end tests
```

## Running Tests

Unit tests (Vitest):

```bash
npm test
```

End-to-end tests (Playwright):

```bash
npm run test:e2e
```

## Building for Production

```bash
npm run build
npm start
```

Analyze bundle size:

```bash
ANALYZE=true npm run build
```
