interface AccessEvent {
  id: string;
  itemTitle: string;
  action: "viewed" | "downloaded" | "license_denied";
  occurredAt: string;
  deviceLabel?: string;
}

interface DigitalAccessHistoryProps {
  events: AccessEvent[];
  isLibrarianView?: boolean;
}

function redact(value: string) {
  return value.length <= 4 ? "••••" : `${value.slice(0, 2)}••••${value.slice(-2)}`;
}

export function DigitalAccessHistory({ events, isLibrarianView = false }: DigitalAccessHistoryProps) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-500">No access history to show.</p>;
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b text-gray-500">
          <th className="py-1">Item</th>
          <th className="py-1">Action</th>
          <th className="py-1">Date</th>
          {isLibrarianView && <th className="py-1">Device</th>}
        </tr>
      </thead>
      <tbody>
        {events.map((event) => (
          <tr key={event.id} className="border-b">
            <td className="py-1">{event.itemTitle}</td>
            <td className="py-1">{event.action.replace("_", " ")}</td>
            <td className="py-1">{new Date(event.occurredAt).toLocaleString()}</td>
            {isLibrarianView && (
              <td className="py-1">{event.deviceLabel ? redact(event.deviceLabel) : "—"}</td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
