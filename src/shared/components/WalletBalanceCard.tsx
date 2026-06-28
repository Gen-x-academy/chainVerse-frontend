export function WalletBalanceCard() {
  const { publicKey, xlmBalance, chvBalance } = useWallet();
  if (!publicKey) return null;
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-gray-500">XLM Balance</p>
      <p className="text-2xl font-bold">{xlmBalance}</p>
      <p className="text-sm text-gray-500 mt-2">CHV Balance</p>
      <p className="text-2xl font-bold">{chvBalance}</p>
    </div>
  );
}