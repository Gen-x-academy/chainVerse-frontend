'use client';

import {
  BookOpen,
  LayoutDashboard,
  Award,
  CreditCard,
  User,
  Settings,
  LogOut,
  GraduationCap,
  FileText,
} from 'lucide-react';
import {
  type RouteType,
  SidebarComponent,
  type SidebarSectionType,
} from './dashboard/student/sidebar';

const navigationItems: RouteType[] = [
  {
    name: 'Dashboard',
    icon: LayoutDashboard,
    route: '/students/dashboard',
  },
  {
    name: 'My Courses',
    icon: BookOpen,
    route: '/students/dashboard/courses',
  },
  {
    name: 'Certificates',
    icon: Award,
    route: '/students/dashboard/certificates',
  },
  {
    name: 'Scholarships',
    icon: GraduationCap,
    route: '/students/dashboard/scholarships',
  },
  {
    name: 'My Applications',
    icon: FileText,
    route: '/students/dashboard/scholarships/my-applications',
  },
  {
    name: 'Transactions',
    icon: CreditCard,
    route: '/students/dashboard/transactions',
  },
];

const accountItems: RouteType[] = [
  {
    name: 'Profile',
    icon: User,
    route: '/students/dashboard/profile',
  },
  {
    name: 'Settings',
    icon: Settings,
    route: '/students/dashboard/settings',
  },
  {
    name: 'Disconnect Wallet',
    icon: LogOut,
    route: '/students/dashboard/disconnect',
  },
];

const sidebarSections: SidebarSectionType[] = [
  {
    routes: navigationItems,
  },
  {
    title: 'ACCOUNT',
    routes: accountItems,
  },
];

export function StudentSidebar() {
  const logo = (
    <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-600">
      <BookOpen className="h-4 w-4 text-white" />
    </div>
  );

  return (
    <SidebarComponent
      logo={logo}
      title="ChainVerse Academy"
      sections={sidebarSections}
    />
  );
}
