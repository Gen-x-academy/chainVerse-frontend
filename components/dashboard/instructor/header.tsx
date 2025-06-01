"use client";

import React, { useState } from "react";
import Searchbar from "./searchbar";
import HeaderBadge from "./header-badge";
import { InstructorProps } from "@/types";

type InstructorDashboardHeaderProps = {
  user: InstructorProps;
  handleNotificationToggle: () => void;
};

const InstructorDashboardHeader = ({
  user,
  handleNotificationToggle
}: InstructorDashboardHeaderProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <header className={`shadow-md  bg-white h-18 px-4 w-full  pt-6 pb-3`}>
      <nav className=" flex justify-between items-center h-full w-full ">
        <Searchbar />

        <div className="flex items-center gap-3">
          <HeaderBadge instructor={user} />
          <button
            className="notification-icon cursor-pointer bg-gray-100 rounded-full p-1"
            onClick={handleNotificationToggle}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M16.1168 12.0748L15.2834 10.6915C15.1084 10.3832 14.9501 9.79984 14.9501 9.45817V7.34984C14.9501 5.3915 13.8001 3.69984 12.1418 2.90817C11.7084 2.1415 10.9084 1.6665 9.99178 1.6665C9.08345 1.6665 8.26678 2.15817 7.83345 2.93317C6.20845 3.7415 5.08345 5.4165 5.08345 7.34984V9.45817C5.08345 9.79984 4.92512 10.3832 4.75012 10.6832L3.90845 12.0748C3.57512 12.6332 3.50012 13.2498 3.70845 13.8165C3.90845 14.3748 4.38345 14.8082 5.00012 15.0165C6.61678 15.5665 8.31678 15.8332 10.0168 15.8332C11.7168 15.8332 13.4168 15.5665 15.0335 15.0248C15.6168 14.8332 16.0668 14.3915 16.2835 13.8165C16.5001 13.2415 16.4418 12.6082 16.1168 12.0748Z"
                fill="#4D4D4D"
              />
              <path
                d="M12.3582 16.6748C12.0082 17.6415 11.0832 18.3332 9.9999 18.3332C9.34157 18.3332 8.69157 18.0665 8.23324 17.5915C7.96657 17.3415 7.76657 17.0082 7.6499 16.6665C7.75824 16.6832 7.86657 16.6915 7.98324 16.7082C8.1749 16.7332 8.3749 16.7582 8.5749 16.7748C9.0499 16.8165 9.53324 16.8415 10.0166 16.8415C10.4916 16.8415 10.9666 16.8165 11.4332 16.7748C11.6082 16.7582 11.7832 16.7498 11.9499 16.7248C12.0832 16.7082 12.2166 16.6915 12.3582 16.6748Z"
                fill="#4D4D4D"
              />
            </svg>
          </button>
        </div>
      </nav>
    </header>
  );
};

export default InstructorDashboardHeader;
