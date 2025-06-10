"use client";
import { useState } from "react";
import InstructorSidebar from "./sidebar";
import InstructorDashboardHeader from "./header";
import NotificationBar from "./notification-bar";
import { instructorRoutes, instructor } from "@/lib/mock-data/instructorsData";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [showNotification, setShowNotification] = useState(false);
  const handleNotificationToggle = () => setShowNotification((prev) => !prev);

  return (
    <div className="grid grid-cols-6 min-h-screen">
      {/* Sidebar */}
      <div className="col-span-6 md:col-span-1">
        <InstructorSidebar routes={instructorRoutes} />
      </div>
      {/* Contenido principal */}
      <div className={showNotification ? "col-span-6 md:col-span-4" : "col-span-6 md:col-span-5"}>
        <InstructorDashboardHeader
          user={instructor}
          handleNotificationToggle={handleNotificationToggle}
        />
        <main className="p-4">{children}</main>
      </div>
      {/* Notificación */}
      {showNotification && (
        <div className="hidden md:block md:col-span-1">
          <NotificationBar />
        </div>
      )}
    </div>
  );
} 