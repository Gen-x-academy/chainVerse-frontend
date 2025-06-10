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
  SidebarProvider
} from "@/components/ui/sidebar";
import Image from "next/image";
import logo from "../../../public/logo.png";
import { cn } from "@/lib/utils";

export default function InstructorSidebar({ routes }: { routes: RouteType[] }) {
  return (
    <SidebarProvider className="w-full md:w-56">
      <Sidebar className="w-full md:w-56">
        <SidebarContent className="py-4 pl-2 pr-4 w-full">
          <div className="flex items-center gap-1 pb-4">
            <Image
              src={logo}
              alt="Logo"
              className="md:h-4 md:w-4 lg:h-6 lg:w-6"
              width={24}
              height={24}
            />
            <span className="font-semibold tracking-[-0.8px] md:text-[20px]">
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
                        "flex items-center py-5 font-medium ",
                        route.isActive && "bg-gray-200 "
                      )}
                    >
                      <span className="h-5 w-5"> {route.icon}</span>
                      <span className="route-name">{route.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
