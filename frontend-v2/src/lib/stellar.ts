import { StellarWalletsKit, Networks } from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo';
import { HanaModule } from '@creit.tech/stellar-wallets-kit/modules/hana';
import { RabetModule } from '@creit.tech/stellar-wallets-kit/modules/rabet';

export const STELLAR_NETWORK: Networks =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

export const CONTRACT_ADDRESSES = {
  certificates: process.env.NEXT_PUBLIC_CONTRACT_CERTIFICATES ?? '',
  reward: process.env.NEXT_PUBLIC_CONTRACT_REWARD ?? '',
  chvToken: process.env.NEXT_PUBLIC_CONTRACT_CHV_TOKEN ?? '',
  courseRegistry: process.env.NEXT_PUBLIC_CONTRACT_COURSE_REGISTRY ?? '',
  escrow: process.env.NEXT_PUBLIC_CONTRACT_ESCROW ?? '',
};

export function initStellarWalletsKit() {
  StellarWalletsKit.init({
    network: STELLAR_NETWORK,
    modules: [
      new FreighterModule(),
      new AlbedoModule(),
      new HanaModule(),
      new RabetModule(),
    ],
  });
}
