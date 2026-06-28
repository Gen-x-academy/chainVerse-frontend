import { CONTRACT_ADDRESSES } from './stellar';

export async function getCertificate(wallet: string, courseId: string) {
  // Build and simulate a Soroban transaction calling certificates.get_certificate
}

export async function getChvBalance(publicKey: string): Promise<bigint> {
  // Call chv_token.balance
}

export async function claimReward(courseId: string, signer: WalletSigner): Promise<string> {
  // Build, sign, and submit a reward claim transaction
  // Returns transaction hash
}