"use client";
import { alerts } from "@/lib/mock-data/notification-data";
import { activities } from "@/lib/mock-data/notification-data";
import Image from "next/image";

const NotificationBar = () => {
  return (
    <>
      <div className="pl-4 pr-2 pt-7 bg-background shadow-sm h-screen overflow-y-scroll">
        <h3 className="text-xl pb-5 font-medium">Notification</h3>

        <div className="grid gap-7">
          <div className="grid gap-3">
            <label htmlFor="alerts" className="text-gray-500 text-[13px]">
              Alerts
            </label>
            <div className="grid gap-3">
              {alerts.map((alert, index) => (
                <div className="grid" key={index}>
                  <h6 className="text-[12px] text-gray-800 font-medium tracking-[-0.19px]">
                    {alert.title}
                  </h6>
                  <small className="text-[9px] -mt-0.5 text-gray-400 tracking-[-0.17px]">
                    {alert.time}
                  </small>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            <label htmlFor="alerts" className="text-gray-500 text-[13px]">
              Activities
            </label>
            <div className="grid gap-3">
              {activities.map((alert, index) => (
                <div className="flex items-center gap-1.5" key={index}>
                  {alert.img && (
                    <span className="rounded-full">
                      <Image
                        src={alert.img}
                        alt={alert.title}
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                    </span>
                  )}
                  <div className="grid">
                    <h6 className="text-[12px] font-medium text-gray-800 tracking-[-0.19px]">
                      {alert.title}
                    </h6>
                    <small className="text-[9px] -mt-0.5 text-gray-400 tracking-[-0.17px]">
                      {alert.time}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotificationBar;
