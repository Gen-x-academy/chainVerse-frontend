# Deployment

## Platform

The app is deployed on [Render](https://render.com). A preview deployment is created for every pull request; the production deployment is updated on every push to `main`.

## Required Environment Variables

Set these in the Render dashboard under **Environment**:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` or `pubnet` |
| `NEXT_PUBLIC_HORIZON_URL` | Stellar Horizon RPC URL |
| `NEXT_PUBLIC_STELLAR_RPC_URL` | Soroban RPC URL |
| `NEXT_PUBLIC_STELLAR_PASSPHRASE` | Network passphrase |
| `NEXT_PUBLIC_CONTRACT_CERTIFICATES` | Certificates contract address |
| `NEXT_PUBLIC_CONTRACT_REWARD` | Reward contract address |
| `NEXT_PUBLIC_CONTRACT_CHV_TOKEN` | CHV token contract address |
| `NEXT_PUBLIC_CONTRACT_COURSE_REGISTRY` | Course registry contract address |
| `NEXT_PUBLIC_CONTRACT_ESCROW` | Escrow contract address |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error tracking |

## Updating Contract Addresses

After a testnet deployment of `chainVerse-onchain`:

1. Copy the new addresses from `chainVerse-onchain/deployments/testnet.json`
2. Update the corresponding `NEXT_PUBLIC_CONTRACT_*` variables in the Render dashboard
3. Trigger a new deployment from the Render dashboard or push a commit to `main`

## Preview Deployments

Render automatically creates preview deployments for each PR branch. The preview URL is posted as a check on the PR.

## Local Development

```bash
cp .env.example .env.local
npm install
npm run dev
```
