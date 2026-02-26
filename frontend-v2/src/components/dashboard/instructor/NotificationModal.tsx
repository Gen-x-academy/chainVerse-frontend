import React from "react";
import { X, Info, Check } from "lucide-react";

interface Notification {
    id: string;
    message: string;
    time: string;
    isRead: boolean;
}

interface NotificationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
    isOpen,
    onClose,
}) => {
    if (!isOpen) return null;

    const notifications: Notification[] = [
        {
            id: "1",
            message: "New student enrolled in 'Blockchain Fundamentals'",
            time: "2 mins ago",
            isRead: false,
        },
        {
            id: "2",
            message: "Course update pending for 'React Masterclass'",
            time: "1 hour ago",
            isRead: false,
        },
        {
            id: "3",
            message: "Your monthly report is ready for download",
            time: "5 hours ago",
            isRead: true,
        },
    ];

    return (
        <>
            {/* Backdrop for clicking outside */}
            <div
                className="fixed inset-0 z-40 bg-transparent"
                onClick={onClose}
            />

            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden transform transition-all animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-gray-200 text-gray-400 transition"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length > 0 ? (
                        notifications.map((notif) => (
                            <div
                                key={notif.id}
                                className="p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition cursor-pointer group"
                            >
                                <div className="flex gap-3">
                                    <div className="mt-1 w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0 group-hover:bg-indigo-100 transition">
                                        <Info size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-800 leading-snug font-medium">
                                            {notif.message}
                                        </p>
                                        <span className="text-[11px] text-gray-400 mt-1 block">
                                            {notif.time}
                                        </span>
                                    </div>
                                    {!notif.isRead && (
                                        <div className="mt-2 w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0" />
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-10 text-center">
                            <p className="text-sm text-gray-400">No new notifications</p>
                        </div>
                    )}
                </div>

                <div className="p-3 bg-gray-50 text-center border-t border-gray-100">
                    <button className="flex items-center justify-center gap-2 w-full text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition">
                        <Check size={14} />
                        Mark all as read
                    </button>
                </div>
            </div>
        </>
    );
};
