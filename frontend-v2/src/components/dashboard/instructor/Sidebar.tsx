"use client";

import React, { ComponentType } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type routeType = {
    name: string;
    icon: ComponentType<{ className?: string }>;
    route: string;
    isActive: boolean;
};

interface SidebarProps {
    routes: routeType[];
    isOpen?: boolean;
    onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ routes, isOpen, onClose }) => {
    return (
        <aside className={cn(
            "fixed left-0 top-0 z-40 h-screen w-64 border-r bg-white transition-all duration-300 overflow-y-auto lg:translate-x-0 lg:shadow-none",
            isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        )}>
            <div className="flex h-full flex-col px-4 py-6">
                {/* Logo */}
                <Link href="/" className="mb-10 flex items-center gap-2 px-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">C</span>
                    </div>
                    <span className="font-bold text-xl text-gray-900">ChainVerse</span>
                </Link>

                {/* Navigation */}
                <nav className="flex-1 space-y-2">
                    {routes.map((route) => (
                        <Link
                            key={route.name}
                            href={route.route}
                            onClick={onClose}
                            className={cn(
                                "flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                                route.isActive
                                    ? "bg-indigo-50 text-indigo-600 shadow-sm"
                                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                            )}
                        >
                            <route.icon
                                className={cn(
                                    "mr-3 h-5 w-5",
                                    route.isActive ? "text-indigo-600" : "text-gray-400"
                                )}
                            />
                            {route.name}
                        </Link>
                    ))}
                </nav>

                {/* Bottom Section (Optional) */}
                <div className="mt-auto pt-6 border-t border-gray-100">
                    <p className="text-xs text-center text-gray-400">© 2026 ChainVerse</p>
                </div>
            </div>
        </aside>
    );
};
