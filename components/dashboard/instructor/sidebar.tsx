"use client";

import Link from "next/link";
import { RouteType } from "@/types";
import {
  Sidebar,
  SidebarContent,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from "@/components/ui/sidebar";
import Image from "next/image";
import logo from "../../../public/logo.png";
import { cn } from "@/lib/utils";

export default function InstructorSidebar({ routes }: { routes: RouteType[] }) {
  return (
    <>
      <SidebarProvider>
        <Sidebar className="w-1/5">
          <SidebarContent className="py-4 pl-2 pr-4 w-full">
            <div className="flex items-center gap-1 pb-4">
              <Image
                src={logo}
                alt="Logo"
                className="h-6 w-6"
                width={24}
                height={24}
              />
              <span className="font-semibold tracking-[-0.8px] text-xl">
                ChainVerse Academy
              </span>
            </div>
            <SidebarGroupLabel className="-mb-3 font-normal tracking-[0%]">
              Dashboard
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="grid gap-1">
                {routes.map((route) => (
                  <SidebarMenuItem key={route.name}>
                    <SidebarMenuButton asChild>
                      <Link
                        key={route.name}
                        href={route.route}
                        className={cn(
                          "flex items-center py-5 font-medium",
                          route.isActive && "bg-gray-200 "
                        )}
                      >
                        <span className="h-5 w-5"> {route.icon}</span>
                        <span>{route.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                {/* <SidebarTrigger /> */}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </>
  );
}
