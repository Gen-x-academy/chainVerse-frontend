'use client';
import { Button } from '@/components/ui/button';

import Image from 'next/image';

type NotificationBarProps = {
  activities: Array<{
    title: string;
    time: string;
    img?: string;
  }>;
  alerts: Array<{
    title: string;
    time: string;
  }>;
  setShowNotification?: () => void;
};

const NotificationBar = ({
  activities,
  setShowNotification,
  alerts,
}: NotificationBarProps) => {
  return (
    <>
      <div className="pl-4 pr-2 pt-7 bg-background shadow-sm h-fit pb-6 overflow-y-scroll">
        <div className="flex justify-between">
          <h3 className="text-xl pb-5 font-medium">Notification</h3>
          <Button onClick={setShowNotification}>X</Button>
        </div>

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
