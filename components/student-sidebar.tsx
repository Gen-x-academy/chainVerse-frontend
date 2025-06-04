"use client";

import {
  BookOpen,
  LayoutDashboard,
  Award,
  CreditCard,
  User,
  Settings,
  Home,
  LogOut
} from "lucide-react";
import {
  type RouteType,
  SidebarComponent,
  type SidebarSectionType
} from "./dashboard/student/sidebar";
import logo from "../public/logo.png";

const navigationItems: RouteType[] = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    route: "/student/dashboard"
  },
  {
    name: "My Courses",
    icon: BookOpen,
    route: "/student/courses"
  },
  {
    name: "Certificates",
    icon: Award,
    route: "/student/certificates"
  },
  {
    name: "Transactions",
    icon: CreditCard,
    route: "/student/transactions"
  }
];

const accountItems: RouteType[] = [
  {
    name: "Profile",
    icon: User,
    route: "/student/profile"
  },
  {
    name: "Settings",
    icon: Settings,
    route: "/student/settings"
  },
  {
    name: "Back to Home",
    icon: Home,
    route: "/"
  },
  {
    name: "Disconnect Wallet",
    icon: LogOut,
    route: "/disconnect"
  }
];

const sidebarSections: SidebarSectionType[] = [
  {
    routes: navigationItems
  },
  {
    title: "ACCOUNT",
    routes: accountItems
  }
];

export function StudentSidebar() {
  return (
    <SidebarComponent title="ChainVerse Academy" sections={sidebarSections} />
  );
}
