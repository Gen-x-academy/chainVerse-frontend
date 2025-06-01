"use client";

import InstructorSidebar from "@/components/dashboard/instructor/sidebar";
import React, { useEffect, useState } from "react";
import InstructorDashboardHeader from "@/components/dashboard/instructor/header";
import { usePathname } from "next/navigation";
import Main from "./main";
import NotificationBar from "@/components/dashboard/instructor/notification-bar";
import { cn } from "@/lib/utils";
import { instructorRoutes } from "@/lib/mock-data/instructorsData";
import { instructor } from "@/lib/mock-data/instructorsData";

const InstructorDashboard = () => {
  const pathname = usePathname();
  const [showNotification, setShowNotification] = useState(false);

  const handleNotificationToggle = () => {
    setShowNotification((prev) => !prev);
  };

  // THIS TOGGLES THE ACTIVE STATE OF EACH LINK ON THE SIDEBAR BASED ON THE URL ON EACH REFREASH OR NAVIGATION
  useEffect(() => {
    instructorRoutes.forEach((menu) =>
      pathname.includes(menu.route)
        ? (menu.isActive = true)
        : (menu.isActive = false)
    );
  }, []);

  return (
    <div className="grid grid-cols-5">
      <InstructorSidebar routes={instructorRoutes} />

      <div className={(cn(), showNotification ? "col-span-3" : "col-span-4")}>
        <InstructorDashboardHeader
          user={instructor}
          handleNotificationToggle={handleNotificationToggle}
        />

        {/* THIS MAIN COMPONENT DISPLAYS THE GREETING WITH A MOCK USER NAME  */}
        <Main user={instructor} />
      </div>

      {""}
      {showNotification && (
        <div className="col-span-1">
          <NotificationBar />
        </div>
      )}
    </div>
  );
};

export default InstructorDashboard;
