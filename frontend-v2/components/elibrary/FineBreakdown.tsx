export type FineLine = {
  loanId: string;
  rule: string;
  dateRange: string;
  amount: number;
  waived?: boolean;
  disputed?: boolean;
};

interface FineBreakdownProps {
  lines: FineLine[];
  currency?: string;
}

/** Simple breakdown of assessed fine amounts per loan/rule. */
export function FineBreakdown({ lines, currency = 'USD' }: FineBreakdownProps) {
  const outstanding = lines.filter((l) => !l.waived).reduce((sum, l) => sum + l.amount, 0);
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">No fines assessed.</p>;
  }
  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1">Loan</th><th>Rule</th><th>Range</th><th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={`${l.loanId}-${l.rule}`} className="border-t">
              <td className="py-1">{l.loanId}</td>
              <td>{l.rule}</td>
              <td>{l.dateRange}</td>
              <td className={`text-right ${l.waived ? 'text-muted-foreground line-through' : ''}`}>
                {currency} {l.amount.toFixed(2)}{l.disputed && ' (disputed)'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-right text-sm font-medium">Outstanding: {currency} {outstanding.toFixed(2)}</p>
    </div>
  );
}
