"use client";

export type LibraryNotification = {
  id: string;
  type:
    | "checkout"
    | "due"
    | "overdue"
    | "hold"
    | "renewal"
    | "fine"
    | "payment"
    | "license"
    | "reading-list";
  message: string;
  href?: string;
  read: boolean;
};

// Renders library-related notifications inside the shared notification center.
export default function LibraryNotificationList({
  notifications,
  onOpen,
}: {
  notifications: LibraryNotification[];
  onOpen: (id: string) => void;
}) {
  if (notifications.length === 0) {
    return <p className="text-sm text-gray-500 p-4">No library notifications.</p>;
  }

  return (
    <ul className="divide-y">
      {notifications.map((n) => (
        <li key={n.id} className={n.read ? "opacity-60" : ""}>
          <a
            href={n.href ?? "#"}
            onClick={() => onOpen(n.id)}
            className="block p-3 text-sm hover:bg-gray-50"
          >
            <span className="text-xs uppercase text-gray-400 mr-2">{n.type}</span>
            {n.message}
          </a>
        </li>
      ))}
    </ul>
  );
}
