export type InventoryRow = {
  itemId: string;
  title: string;
  condition: 'good' | 'worn' | 'damaged' | 'lost';
  location: string;
  lastSeen: string;
};

interface InventoryReportProps {
  rows: InventoryRow[];
  generatedAt: string;
}

const CONDITION_LABEL: Record<InventoryRow['condition'], string> = {
  good: 'Good', worn: 'Worn', damaged: 'Damaged', lost: 'Lost / discrepancy',
};

/** Simple collection/inventory report table with a data-freshness timestamp. */
export function InventoryReport({ rows, generatedAt }: InventoryReportProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No inventory rows to show.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Report generated {generatedAt}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1">Item</th><th>Condition</th><th>Location</th><th>Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.itemId} className="border-t">
              <td className="py-1">{row.title}</td>
              <td>{CONDITION_LABEL[row.condition]}</td>
              <td>{row.location}</td>
              <td>{row.lastSeen}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
