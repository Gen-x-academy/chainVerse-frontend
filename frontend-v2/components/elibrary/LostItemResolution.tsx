"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type LostItemStatus = "found" | "paid" | "replaced" | "waived" | "disputed";

interface LostItemResolutionProps {
  itemTitle: string;
  replacementCost: number;
  status: LostItemStatus;
  onResolve: (status: LostItemStatus) => void;
}

/** #976: Show a lost item's replacement charge and let librarians pick a resolution. */
export function LostItemResolution({
  itemTitle,
  replacementCost,
  status,
  onResolve,
}: LostItemResolutionProps) {
  const options: LostItemStatus[] = ["found", "paid", "replaced", "waived", "disputed"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{itemTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm">Replacement cost: ${replacementCost.toFixed(2)}</p>
        <p className="text-sm capitalize">Current status: {status}</p>
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <Button
              key={option}
              variant={option === status ? "default" : "outline"}
              size="sm"
              onClick={() => onResolve(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
