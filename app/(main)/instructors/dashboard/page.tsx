"use client";

import InstructorSidebar from "@/components/instructors/dashboard/sidebar";
import React, { useEffect, useState } from "react";
import InstructorDashboardHeader from "@/components/instructors/dashboard/header";
import { usePathname } from "next/navigation";
import Main from "../../../../components/instructors/dashboard/main";
import NotificationBar from "@/components/instructors/dashboard/notification-bar";
import { cn } from "@/lib/utils";
import { instructorRoutes } from "@/lib/mock-data/instructorsData";
import { instructor } from "@/lib/mock-data/instructorsData";
import OverviewCards from "@/components/Instructor-dashboard/Overview";
import ChartsSection from "@/components/Instructor-dashboard/ChartSection";
const InstructorDashboard = () => {
  const pathname = usePathname();
  const [showNotification, setShowNotification] = useState(false);

  const handleNotificationToggle = () => {
    setShowNotification((prev) => !prev);
  };

  // THIS TOGGLES THE ACTIVE STATE OF EACH LINK ON THE SIDEBAR BASED ON THE URL ON EACH REFRESH OR NAVIGATION
  // useEffect(() => {
  //   instructorRoutes.forEach((menu) =>
  //     pathname.includes(menu.route)
  //       ? (menu.isActive = true)
  //       : (menu.isActive = false)
  //   );
  // }, []);

  return (
    <div className="grid grid-cols-6">
      <InstructorSidebar routes={instructorRoutes} />

      <div
        className={
          (cn(),
          showNotification
            ? "col-span-6  md:col-span-4 "
            : "col-span-6  md:col-span-5")
        }
      >
        <InstructorDashboardHeader
          user={instructor}
          handleNotificationToggle={handleNotificationToggle}
        />

        {/* THIS MAIN COMPONENT DISPLAYS THE GREETING WITH A MOCK USER NAME  */}
        <Main user={instructor} />
        <div className="p-4">
          <OverviewCards />
          <ChartsSection />
        </div>
      </div>

      {showNotification && (
        <div className="hidden md:block md:col-span-1">
          <NotificationBar />
        </div>
      )}
    </div>
  );
};

export default InstructorDashboard;
