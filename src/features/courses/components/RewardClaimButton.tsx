import { useState } from "react";
import { useWallet } from "@stellar/freighter-api";
import { toast } from "react-hot-toast";
import { contracts } from "../../../shared/contracts";

export function RewardClaimButton({ courseId }: { courseId: string }) {
  const { publicKey, signTransaction } = useWallet();
  const [claiming, setClaiming] = useState(false);
  const handleClaim = async () => {
    setClaiming(true);
    try {
      const txHash = await contracts.claimReward(courseId, publicKey, signTransaction);
      toast.success(`Reward claimed! Tx: ${txHash}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to claim reward.");
    } finally {
      setClaiming(false);
    }
  };
  return <button onClick={handleClaim} disabled={claiming}>Claim CHV Reward</button>;
}