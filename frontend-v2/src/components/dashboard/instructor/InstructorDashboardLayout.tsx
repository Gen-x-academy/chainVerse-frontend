"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Sidebar, routeType } from "./Sidebar";
import { Header } from "./Header";
import {
    LayoutDashboard,
    UserCircle,
    BookOpen,
    Calendar
} from "lucide-react";
import { usePathname } from "next/navigation";

interface InstructorDashboardLayoutProps {
    children: React.ReactNode;
}

export const InstructorDashboardLayout: React.FC<InstructorDashboardLayoutProps> = ({ children }) => {
    const pathname = usePathname();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const routes: routeType[] = useMemo(() => [
        {
            name: "Overview",
            icon: LayoutDashboard,
            route: "/student/dashboard",
            isActive: pathname === "/student/dashboard",
        },
        {
            name: "Account",
            icon: UserCircle,
            route: "/student/dashboard/account",
            isActive: pathname === "/student/dashboard/account",
        },
        {
            name: "Course Management",
            icon: BookOpen,
            route: "/student/dashboard/courses",
            isActive: pathname.includes("/courses"),
        },
        {
            name: "Sessions",
            icon: Calendar,
            route: "/student/dashboard/sessions",
            isActive: pathname === "/student/dashboard/sessions",
        },
    ], [pathname]);

    const handleSidebarClose = useCallback(() => setIsSidebarOpen(false), []);
    const handleMenuToggle = useCallback(() => setIsSidebarOpen((prev: boolean) => !prev), []);

    return (
        <div className="min-h-screen bg-gray-50/50 flex overflow-hidden">
            {/* Mobile sidebar backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden transition-all duration-300"
                    onClick={handleSidebarClose}
                    aria-hidden="true"
                />
            )}
            <Sidebar routes={routes} isOpen={isSidebarOpen} onClose={handleSidebarClose} />
            <div className="flex-1 lg:ml-64 flex flex-col min-h-screen min-w-0">
                <Header onMenuToggle={handleMenuToggle} />
                <main className="flex-1 p-8">
                    <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};
