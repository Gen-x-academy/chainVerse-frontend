#!/usr/bin/env bash
# setup-workflows.sh
# Generates/updates .github/workflows/ files.
# Run from repo root: bash scripts/setup-workflows.sh
#
# This script exists because the classic PATs used for pushing PR branches
# lack the `workflow` scope, which GitHub requires for any push that touches
# .github/workflows/.  Run it locally or in CI to produce the desired files.

set -euo pipefail

CI_YAML=".github/workflows/ci.yml"
DEPLOY_YAML=".github/workflows/deploy.yml"
SYNC_YAML=".github/workflows/contract-sync.yml"

# ─── 1. Update CI with e2e contract env vars ───────────────────────────────
if [[ -f "$CI_YAML" ]]; then
  echo "Updating $CI_YAML …"
  # Use a heredoc to overwrite; adjust indentation to match the original.
  cat > "$CI_YAML" << 'CIEOF'
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend-v2

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend-v2/package-lock.json

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type-check
        run: npx tsc --noEmit

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: E2E Tests
        env:
          NEXT_PUBLIC_CONTRACT_CERTIFICATES: ${{ secrets.TESTNET_CONTRACT_CERTIFICATES }}
          NEXT_PUBLIC_CONTRACT_REWARD: ${{ secrets.TESTNET_CONTRACT_REWARD }}
          NEXT_PUBLIC_CONTRACT_CHV_TOKEN: ${{ secrets.TESTNET_CONTRACT_CHV_TOKEN }}
          NEXT_PUBLIC_CONTRACT_COURSE_REGISTRY: ${{ secrets.TESTNET_CONTRACT_COURSE_REGISTRY }}
          NEXT_PUBLIC_CONTRACT_ESCROW: ${{ secrets.TESTNET_CONTRACT_ESCROW }}
          NEXT_PUBLIC_STELLAR_NETWORK: testnet
        run: npm run test:e2e
CIEOF
  echo "  ✓ $CI_YAML updated"
fi

# ─── 2. Create deploy workflow ──────────────────────────────────────────────
echo "Creating $DEPLOY_YAML …"
cat > "$DEPLOY_YAML" << 'DEOF'
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend-v2

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend-v2/package-lock.json

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type-check
        run: npx tsc --noEmit

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy to Render
        env:
          RENDER_DEPLOY_HOOK_URL: ${{ secrets.RENDER_DEPLOY_HOOK_URL }}
        run: |
          curl -X POST "$RENDER_DEPLOY_HOOK_URL"
DEOF
echo "  ✓ $DEPLOY_YAML created"

# ─── 3. Create contract-sync (repository_dispatch) workflow ────────────────
echo "Creating $SYNC_YAML …"
cat > "$SYNC_YAML" << 'SYEOF'
name: Sync Contract Addresses

on:
  repository_dispatch:
    types: [contract-deployed]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Update environment variables
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          echo "Updating contract addresses from deployment event"
          for var in CERTIFICATES REWARD CHV_TOKEN COURSE_REGISTRY ESCROW; do
            value="${{ github.event.client_payload[var] }}"
            if [ -n "$value" ]; then
              vercel env add NEXT_PUBLIC_CONTRACT_$var production <<< "$value"
            fi
          done

      - name: Trigger redeployment
        run: vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
SYEOF
echo "  ✓ $SYNC_YAML created"

echo ""
echo "Done. Files under .github/workflows/ are ready. Commit them with a token"
echo "that has the 'workflow' scope, or open a PR and merge via the web UI."
