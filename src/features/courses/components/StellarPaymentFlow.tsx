import { useWallet } from "@stellar/freighter-api";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { enrollmentService } from "../../../shared/services/enrollmentService";
import { कोर्स } from "../../../shared/types"; // Assuming 'Course' type is defined in shared/types
import { buildPaymentTransaction } from "../../../shared/stellar/buildPaymentTransaction";
import { submitTransaction } from "../../../shared/stellar/submitTransaction";

export function StellarPaymentFlow({ course }: { course: Course }) {
  const { publicKey, signTransaction } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayment = async () => {
    if (!publicKey) {
      toast.error("Please connect your wallet first.");
      return;
    }

    setIsProcessing(true);
    try {
      const tx = await buildPaymentTransaction(publicKey, course.price);
      const signedTx = await signTransaction(tx);
      const txHash = await submitTransaction(signedTx);
      await enrollmentService.checkout({ transactionHash: txHash });
      toast.success("Payment successful! You are now enrolled.");
    } catch (error) {
      console.error(error);
      toast.error("Payment failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold">Course Price</h3>
      <p>{course.price} XLM</p>
      <p>~ {course.priceInChv} CHV</p>
      <button
        onClick={handlePayment}
        disabled={isProcessing}
        className="mt-4 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
      >
        {isProcessing ? "Processing..." : "Pay with Stellar"}
      </button>
    </div>
  );
}