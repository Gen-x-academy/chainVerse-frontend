"use client";
import React from "react";
import TransactionsHeader from "@/components/dashboard/student/TransactionHistory/TransactionsHeader";
import TransactionHistoryContent from "@/components/dashboard/student/TransactionHistory/TransactionHistoryContent";
import { StudentSidebar } from "@/components/student-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

const page = () => {
  return (
    <SidebarProvider>
      <div className="flex w-full">
        <StudentSidebar />
        <div className=" w-full bg-[#FCFAF8]">
          <TransactionsHeader />
          <TransactionHistoryContent />
        </div>
      </div>
    </SidebarProvider>
  );
};

export default page;
