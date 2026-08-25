"use client";

import { useState } from "react";

interface LicenseSeatStatusProps {
  totalSeats: number;
  occupiedSeats: number;
  isLoading?: boolean;
  onRequestHold: () => Promise<void>;
}

export function LicenseSeatStatus({
  totalSeats,
  occupiedSeats,
  isLoading,
  onRequestHold,
}: LicenseSeatStatusProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-gray-500">Checking availability…</p>;

  const available = Math.max(totalSeats - occupiedSeats, 0);
  const isExhausted = available === 0;

  const handleHold = async () => {
    setIsRequesting(true);
    setError(null);
    try {
      await onRequestHold();
    } catch {
      setError("Could not place a hold. Please try again.");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium">
        {available} of {totalSeats} seats available
      </p>
      {isExhausted && (
        <button
          onClick={handleHold}
          disabled={isRequesting}
          className="mt-2 rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {isRequesting ? "Requesting…" : "Join wait list"}
        </button>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
