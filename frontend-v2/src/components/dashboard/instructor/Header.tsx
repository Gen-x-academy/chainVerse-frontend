"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { Search, Bell, Copy, ChevronDown, Menu, Settings, User } from "lucide-react";
import { NotificationModal } from "./NotificationModal";
import { LogoutButton } from "@/src/features/auth/components/LogoutButton";

interface HeaderProps {
    onMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    const instructor = {
        name: "Smith",
        fullName: "Professor Smith",
        wallet: "0xdf287d3a0c12b9a56",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Smith"
    };

    const truncatedWallet = `${instructor.wallet.slice(0, 5)}...${instructor.wallet.slice(-4)}`;

    // Close profile dropdown when clicking outside — O(1) handler
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleProfile = useCallback(() => setIsProfileOpen((prev) => !prev), []);
    const closeNotif    = useCallback(() => setIsNotifOpen(false), []);
    const toggleNotif   = useCallback(() => setIsNotifOpen((prev) => !prev), []);

    return (
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
            {/* Mobile hamburger */}
            {onMenuToggle && (
                <button
                    onClick={onMenuToggle}
                    className="mr-3 p-2 rounded-xl border border-gray-100 hover:bg-gray-50 lg:hidden"
                    aria-label="Toggle sidebar"
                >
                    <Menu size={20} className="text-gray-500" />
                </button>
            )}
            <div className="flex-1 max-w-xl">
                <h1 className="text-xl font-bold text-gray-900 mb-1 leading-tight">
                    Good day, {instructor.name}
                </h1>
                <p className="text-xs text-gray-400 font-medium tracking-wide">Welcome back to your dashboard</p>
            </div>

            <div className="flex items-center gap-8">
                {/* Search Bar */}
                <div className="relative hidden lg:block group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search everything..."
                        className="pl-12 pr-4 py-2.5 w-72 rounded-xl border border-gray-100 bg-gray-50/50 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white transition-all duration-300"
                    />
                </div>

                <div className="flex items-center gap-6 border-l border-gray-100 pl-8">
                    {/* Wallet Address */}
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50/50 border border-indigo-100 text-[11px] font-mono font-bold text-indigo-600 hover:bg-indigo-100 transition-colors duration-200 group">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse ring-4 ring-green-500/20" />
                        {truncatedWallet}
                        <Copy size={12} className="ml-1 opacity-60 group-hover:opacity-100 transition-opacity" />
                    </button>

                    {/* Notification Bell */}
                    <div className="relative">
                        <button
                            onClick={toggleNotif}
                            className={`p-2.5 rounded-xl border transition-all duration-200 relative group ${isNotifOpen
                                ? 'bg-indigo-50 border-indigo-200'
                                : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                                }`}
                        >
                            <Bell
                                size={20}
                                className={isNotifOpen ? 'text-indigo-600' : 'text-gray-500 group-hover:text-indigo-600'}
                            />
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                        </button>
                        <NotificationModal isOpen={isNotifOpen} onClose={closeNotif} />
                    </div>

                    {/* Profile + Dropdown */}
                    <div className="relative" ref={profileRef}>
                        <button
                            id="profile-menu-button"
                            onClick={toggleProfile}
                            className="flex items-center gap-3 cursor-pointer group focus:outline-none"
                            aria-haspopup="true"
                            aria-expanded={isProfileOpen}
                            aria-label="Open profile menu"
                        >
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-bold text-gray-900 leading-tight group-hover:text-indigo-600 transition-colors">
                                    {instructor.fullName}
                                </p>
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mt-0.5">Instructor</p>
                            </div>
                            <div className="relative">
                                <Image
                                    src={instructor.avatar}
                                    alt={instructor.fullName}
                                    width={44}
                                    height={44}
                                    className="rounded-xl border-2 border-transparent group-hover:border-indigo-500 p-0.5 transition-all duration-300"
                                />
                                <div className="absolute -bottom-1 -right-1 p-0.5 bg-white rounded-full shadow-sm border border-gray-100">
                                    <ChevronDown
                                        size={10}
                                        className={`transition-all duration-200 ${isProfileOpen ? 'rotate-180 text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600'}`}
                                    />
                                </div>
                            </div>
                        </button>

                        {/* Dropdown menu */}
                        {isProfileOpen && (
                            <div
                                role="menu"
                                aria-labelledby="profile-menu-button"
                                className="absolute right-0 top-full mt-3 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                            >
                                {/* User info */}
                                <div className="px-4 py-3 border-b border-gray-50">
                                    <p className="text-sm font-bold text-gray-900 truncate">{instructor.fullName}</p>
                                    <p className="text-xs text-gray-400 truncate font-mono mt-0.5">{truncatedWallet}</p>
                                </div>

                                {/* Menu items */}
                                <div className="py-1">
                                    <button
                                        role="menuitem"
                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                                    >
                                        <User size={15} className="text-gray-400" aria-hidden="true" />
                                        Profile
                                    </button>
                                    <button
                                        role="menuitem"
                                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-150"
                                    >
                                        <Settings size={15} className="text-gray-400" aria-hidden="true" />
                                        Settings
                                    </button>
                                </div>

                                {/* Sign out */}
                                <div className="border-t border-gray-50 py-1">
                                    <LogoutButton variant="menu-item" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

