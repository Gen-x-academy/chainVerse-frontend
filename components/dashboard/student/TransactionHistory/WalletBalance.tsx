import React from "react";
import { WalletBalance } from "@/lib/types";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

const StudentWalletBalance = ({
  walBalance
}: {
  walBalance: WalletBalance;
}) => {
  const getUSDAmount = (val: number) => val / 5;

  return (
    <div className="bg-white p-2 md:p-4 grid gap-4 border border-[#D9D9D9] pb-10 mt-8 mb-6 rounded-[15px]">
      <h2 className="text-xl md:text-3xl font-medium text-center md:text-left">
        Wallet Balance
      </h2>

      <div className="flex flex-wrap gap-6 justify-between px-0 md:pr-24 md:pl-4 text-center">
        <div className="grid md:gap-1 ">
          <p className="text-gray-400 text-[13px] md:text-[15px] ">
            XLM Balance
          </p>
          <h6 className="text-[18px] md:text-2xl font-medium">
            {walBalance.xlmBalance} XLM
          </h6>
          <p className=" text-[15px] md:text-[18px] text-gray-400">
            = ${getUSDAmount(walBalance.xlmBalance)}.00 USD
          </p>
        </div>
        <div className="grid gap-1">
          <p className="text-gray-400 text-[13px] md:text-[15px] ">
            Total Spent
          </p>
          <h6 className="text-[18px] md:text-2xl font-medium">
            {walBalance.totalSpent} XLM
          </h6>
          <p className="text-[15px] md:text-[18px] text-gray-400">
            = ${getUSDAmount(walBalance.totalSpent)}.00 USD
          </p>
        </div>
        <div className="grid gap-1">
          <p className="text-gray-400 text-[13px] md:text-[15px] ">
            Pending Rewards
          </p>
          <h6 className="text-[18px] md:text-2xl font-medium">
            {walBalance.pendingRewards} XLM
          </h6>
          <p className="text-[15px] md:text-[18px] text-gray-400">
            = ${getUSDAmount(walBalance.pendingRewards)}.00 USD
          </p>
        </div>
        <div className="grid gap-1">
          <p className="text-gray-400 text-[13px] md:text-[15px] ">
            Wallet Address
          </p>
          <h6 className="text-[13px] md:text-base">
            {walBalance.walletAddress.slice(0, 6)}...
            {walBalance.walletAddress.slice(
              walBalance.walletAddress.length - 4
            )}
          </h6>
          <Link
            href=""
            className="flex gap-1 items-center text-[11.5px] md:text-[13px] text-[#4361EE]"
          >
            View on Explorer <ExternalLink size={16} className="" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default StudentWalletBalance;
