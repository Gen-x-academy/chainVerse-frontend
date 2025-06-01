import React from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { RouteType } from "@/types";
import { cn } from "@/lib/utils";
import Image from "next/image";
import logo from "../../../public/logo.png";

const MobileMenuPopup = ({ routes }: { routes: RouteType[] }) => {
  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger className=" md:hidden">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-menu"
          >
            <line x1="4" x2="20" y1="12" y2="12"></line>
            <line x1="4" x2="20" y1="6" y2="6"></line>
            <line x1="4" x2="20" y1="18" y2="18"></line>
          </svg>
          <span className="sr-only">Toggle navigation menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col py-4 md:hidden">
          <SheetTitle className="pl-2">
            <div className="flex items-center gap-1 pb-4">
              <Image
                src={logo}
                alt="Logo"
                className="md:h-4 md:w-4 lg:h-6 lg:w-6"
                width={24}
                height={24}
              />
              <span className="font-semibold tracking-[-0.8px] md:text-base lg:text-xl">
                ChainVerse Academy
              </span>
            </div>
          </SheetTitle>

          <div>
            <small className="text-gray-500 pl-2 -mb-10">Dashboard</small>
            <nav className="grid gap-2 text-lg font-medium mt-3 overflow-y-scroll">
              {routes.map((route) => (
                <Link
                  key={route.name}
                  href={route.route}
                  className={cn(
                    "flex items-center gap-1.5 py-2 font-medium pl-3",
                    route.isActive && "bg-gray-200 "
                  )}
                >
                  <span className="h-5 w-5"> {route.icon}</span>
                  <span className="route-name text-sm">{route.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MobileMenuPopup;
