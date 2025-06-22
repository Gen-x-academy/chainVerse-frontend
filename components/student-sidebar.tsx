'use client';

import {
  BookOpen,
  LayoutDashboard,
  Award,
  CreditCard,
  User,
  Settings,
  Home,
  LogOut,
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
    route: '/students/courses',
  },
  {
    name: 'Certificates',
    icon: Award,
    route: '/students/certificates',
  },
  {
    name: 'Transactions',
    icon: CreditCard,
    route: '/students/transactions',
  },
];

const accountItems: RouteType[] = [
  {
    name: 'Profile',
    icon: User,
    route: '/students/profile',
  },
  {
    name: 'Settings',
    icon: Settings,
    route: '/students/settings',
  },
  {
    name: 'Back to Home',
    icon: Home,
    route: '/',
  },
  {
    name: 'Disconnect Wallet',
    icon: LogOut,
    route: '/students/disconnect',
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
