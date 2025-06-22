'use client';
import { useState } from 'react';

import InstructorDashboardHeader from './header';
import NotificationBar from './notification-bar';
import { instructorRoutes, instructor } from '@/lib/mock-data/instructorsData';
import InstructorSidebar from '@/components/instructorSidebar';
import { activities, alerts } from '@/lib/mock-data/notification-data';

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showNotification, setShowNotification] = useState(false);
  const handleNotificationToggle = () => setShowNotification((prev) => !prev);

  return (
    <div className="grid grid-cols-6 min-h-screen">
      {/* Sidebar */}
      <div className="hidden lg:md:block col-span-1  ">
        <InstructorSidebar routes={instructorRoutes} />
      </div>
      {/* Contenido principal */}
      <div
        className={
          showNotification
            ? 'col-span-6 md:lg:col-span-5 '
            : 'col-span-6 md:lg:col-span-5'
        }
      >
        <InstructorDashboardHeader
          user={instructor}
          handleNotificationToggle={handleNotificationToggle}
        />
        <main className="p-4">{children}</main>
      </div>
      {/* Notificación */}
      {showNotification && (
        <div className="absolute z-50 right-2 top-2">
          <NotificationBar
            activities={activities}
            alerts={alerts}
            setShowNotification={() => setShowNotification(false)}
          />
        </div>
      )}
    </div>
  );
}
