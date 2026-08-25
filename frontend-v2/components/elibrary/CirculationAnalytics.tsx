export type CirculationMetric = {
  label: 'Loans' | 'Returns' | 'Renewals' | 'Holds' | 'Overdue rate';
  value: number;
  unit?: '%' | 'count';
};

interface CirculationAnalyticsProps {
  metrics: CirculationMetric[];
  periodLabel: string;
}

/** Accessible table of circulation metrics with a tabular alternative to charts. */
export function CirculationAnalytics({ metrics, periodLabel }: CirculationAnalyticsProps) {
  if (metrics.length === 0) {
    return <p className="text-sm text-muted-foreground">No circulation data for {periodLabel}.</p>;
  }

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Circulation — {periodLabel}</h3>
      <table className="w-full text-sm" aria-label={`Circulation metrics for ${periodLabel}`}>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1">Metric</th>
            <th className="text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.label} className="border-t">
              <td className="py-1">{m.label}</td>
              <td className="text-right">
                {m.value}
                {m.unit === '%' ? '%' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
