"use client";
import React, { useState } from "react";
import { User, Wallet, Bell } from "lucide-react";
import NotificationTab from "@/components/profile/notificationTab";
import WalletTab from "@/components/profile/walletTab";
import { NotificationData, UserData, WalletData } from "@/lib/types";
import PersonalInfoTab from "@/components/profile/personalInfoTab";
import SideProfile from "@/components/profile/sideProfile";

// Main UserProfile Component
const UserProfile: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "personal" | "wallet" | "notifications"
  >("personal");

  // Sample data
  const userData: UserData = {
    name: "Alex Johnson",
    email: "alex.johnson@example.com",
    phone: "+1 (555) 123-4567",
    bio: "Full-stack developer passionate about creating amazing user experiences. Love working with React, TypeScript, and modern web technologies.",
    avatar:"https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face",
    role: 'Student',
    memberSince: 'January 2025',
    coursesCompleted: 1,
    certificatesEarned: 1,
    walletConnected: true
  };

  const walletData: WalletData = {
    balance: 12450.75,
    currency: "$",
    cards: [
      { id: "1", type: "Visa", last4: "1234", expiry: "12/25" },
      { id: "2", type: "Mastercard", last4: "5678", expiry: "08/26" },
    ],
    transactions: [
      {
        id: "1",
        amount: 250.0,
        description: "Online Purchase",
        date: "2 hours ago",
        type: "debit",
      },
      {
        id: "2",
        amount: 1200.0,
        description: "Salary Deposit",
        date: "1 day ago",
        type: "credit",
      },
      {
        id: "3",
        amount: 45.5,
        description: "Coffee Shop",
        date: "2 days ago",
        type: "debit",
      },
      {
        id: "4",
        amount: 89.99,
        description: "Subscription Renewal",
        date: "3 days ago",
        type: "debit",
      },
    ],
  };

  const notificationData: NotificationData = {
    preferences: {
      email: true,
      push: true,
      sms: false,
    },
    notifications: [
      {
        id: "1",
        title: "Payment Successful",
        message: "Your payment of $250.00 has been processed",
        time: "2 hours ago",
        read: false,
        type: "success",
      },
      {
        id: "2",
        title: "Security Alert",
        message: "New login detected from Chrome on Windows",
        time: "1 day ago",
        read: true,
        type: "warning",
      },
      {
        id: "3",
        title: "Profile Updated",
        message: "Your profile information has been successfully updated",
        time: "2 days ago",
        read: true,
        type: "info",
      },
      {
        id: "4",
        title: "Welcome!",
        message:
          "Welcome to your new dashboard. Explore all the features available.",
        time: "1 week ago",
        read: true,
        type: "info",
      },
    ],
  };

  const tabs = [
    { id: "personal" as const, label: "Personal Info", icon: User },
    { id: "wallet" as const, label: "Wallet", icon: Wallet },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
  ];

  return (
    <div className="min-h-screen w-full bg-gray-50 py-8">
      <div className="px-4 sm:px-6 lg:px-8 w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">User Profile</h1>
          <p className="text-gray-600 mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="flex flex-col md:flex-row  items-start w-full ">
          <SideProfile userData={userData}/>
          <div className="w-full mt-5  md:mt-0">
            {/* Tab Navigation */}
            <div className="bg-white rounded-xl shadow-sm border mb-6">
              <nav className="flex space-x-8 px-6 md:w-[50rem]" aria-label="Tabs">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                        activeTab === tab.id
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <Icon size={18} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
              {activeTab === "personal" && (
                <PersonalInfoTab userData={userData} />
              )}
              {activeTab === "wallet" && <WalletTab walletData={walletData} />}
              {activeTab === "notifications" && (
                <NotificationTab notificationData={notificationData} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
