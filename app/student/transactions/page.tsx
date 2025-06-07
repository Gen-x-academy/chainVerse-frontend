import React from "react";
import Link from "next/link";
import { SortDesc } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowUpFromLineIcon } from "lucide-react";
import { Search } from "lucide-react";
import { Filter } from "lucide-react";
import { walletData } from "@/lib/mock-data/transaction";
import TransactionsHeader from "@/components/dashboard/student/TransactionHistory/TransactionsHeader";
import StudentWalletBalance from "@/components/dashboard/student/TransactionHistory/WalletBalance";
import TransactionHistoryTable from "@/components/dashboard/student/TransactionHistory/TransactionHistoryTable";

const page = () => {
  return (
    <div className="-mt-25 w-full bg-[#FCFAF8]">
      <TransactionsHeader />

      <div className="p-4 pt-6 pb-8">
        <div className="w-full">
          <div className="pb-4">
            <h1 className="text-xl font-medium">Transaction History</h1>
            <p className="text-[#808080] text-[15px]">
              View and manage your payment history and course purchases
            </p>
          </div>
          <div className=" flex flex-wrap justify-between gap-4 w-full">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 border border-[#CBC7C7] bg-white px-1 max-w-[19rem]  sm:px-2 rounded-sm w-[8rem] sm:w-[20rem]">
                <Search className="text-[#CBC7C7] " size={20} />

                <Input
                  type="text"
                  placeholder="Search courses..."
                  className="border-none w-full pl-0 focus-visible:ring-0 text-[13px] p-1 sm:text-[15px]"
                />
              </div>
              <div className="flex border border-[#CBC7C7] bg-white items-center px-2 rounded-sm">
                <Filter size={20} className="text-[#CBC7C7]" />
                <select
                  name=""
                  id=""
                  className="px-2 py-1.5  active:ring-0 focus:outline-0 focus: border-0"
                ></select>
              </div>
            </div>
            <div className="flex gap-4 md:gap-6">
              <div className="flex items-center gap-1 border border-[#CBC7C7] max-w-[15rem] bg-white px-1 py-1 sm:px-2 rounded-sm w-[8rem] sm:w-[20rem]">
                <SortDesc className="text-[#808080]" size={20} />

                <select
                  name="sort transactions"
                  id="sort-transactions"
                  className="text-gray-500 flex-1 text-[13px] sm:text-[15px]  active:ring-0 focus:outline-0 focus: border-0"
                >
                  <option value="all">Sort by: Recent</option>
                </select>
              </div>

              <Button className="border border-[#808080] cursor-pointer bg-white hover:bg-gray-200  text-[#808080]">
                <ArrowUpFromLineIcon size={16} /> Export
              </Button>
            </div>
          </div>

          <StudentWalletBalance walBalance={walletData.walletBalance} />
          <TransactionHistoryTable transactions={walletData.transactions} />
        </div>
      </div>

      <div className="flex gap-6 md:gap-16 justify-end pb-2 pr-30">
        {[
          { title: "Terms", href: "" },
          { title: "Privacy", href: "" },
          { title: "FAQ", href: "" }
        ].map(({ title, href }) => (
          <Link href={href} key={title} className="text-[10px]">
            {title}
          </Link>
        ))}
      </div>
    </div>
  );
};

export default page;
