"use client";

import type React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@/components/ui/sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaticImageData } from "next/image";
import logo from "../../../public/logo.png";

export type RouteType = {
  name: string;
  icon: ComponentType;
  route: string;
  isActive?: boolean; // Make this optional since we'll calculate it
};

export type SidebarSectionType = {
  title?: string;
  routes: RouteType[];
};

interface SidebarComponentProps {
  logo?: StaticImageData;
  title?: string;
  sections: SidebarSectionType[];
  className?: string;
}

export function SidebarComponent({
  title,
  sections,
  className
}: SidebarComponentProps) {
  const { isMobile, toggleSidebar } = useSidebar();
  const pathname = usePathname();

  // Function to determine if a route is active
  const isRouteActive = (route: string) => {
    return pathname === route;
  };

  return (
    <>
      {/* Mobile Hamburger Menu - Fixed z-index issue */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-4 left-4 z-[60] md:hidden bg-white shadow-md hover:bg-gray-50"
          onClick={toggleSidebar}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      )}

      <Sidebar
        className={cn(
          "border-r transition-transform duration-300 ease-in-out",
          className
        )}
      >
        <SidebarHeader className="p-6">
          <div className="flex items-center gap-2">
            <Image
              src={logo}
              alt="Logo"
              className="md:h-4 md:w-4 lg:h-6 lg:w-6"
              width={24}
              height={24}
            />
            {title && <span className="text-lg font-semibold">{title}</span>}
          </div>
        </SidebarHeader>

        <SidebarContent className="px-4">
          {sections.map((section, index) => (
            <div key={index} className="mb-6">
              {section.title && (
                <div className="mb-2">
                  <p className="px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {section.title}
                  </p>
                </div>
              )}
              <SidebarMenu>
                {section.routes.map((item) => {
                  const Icon = item.icon;
                  const isActive = isRouteActive(item.route);
                  return (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={cn(
                          "w-full justify-start gap-3 px-3 py-2 text-sm font-medium",
                          isActive
                            ? "bg-blue-600 text-white hover:bg-blue-700"
                            : "text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        <a
                          href={item.route}
                          className="py-5 flex items-center "
                        >
                          <span className="h-4 w-4 pb-4">
                            <Icon />
                          </span>
                          <span>{item.name}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </div>
          ))}

          <small className="text-[10px] fixed bottom-2">
            © 2025 ChainVerse Academy. All rights reserved.
          </small>
        </SidebarContent>
      </Sidebar>
    </>
  );
}
