"use client";

import { Badge, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { FaWallet, FaGlobe, FaCog } from "react-icons/fa";

const Footer = () => {
  return (
    <footer className=" text-gray-700 py-8 px-4 md:px-12 text-center md:text-left">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        {/* Earn Crypto */}
        <div className="flex flex-col items-center px-8">
          <div className="border rounded-full  p-4 bg-[#80A5F566] ">
            <Wallet
              size={24}
              strokeWidth={1}
              className="text-[#053CB5] "
              // style={{color: acce}}
            />
          </div>
          <h3 className="font-semibold text-lg">Crypto Payments</h3>
          <p className="text-sm">
            Get paid directly in XLM for each student enrollment
          </p>
        </div>

        {/* Global Reach */}
        <div className="flex flex-col items-center px-10">
          <div className="border rounded-full  p-4 bg-[#80A5F566] ">
            <Users size={24} strokeWidth={1} className="text-[#053CB5]" />
          </div>
          <h3 className="font-semibold text-lg">Global Reach</h3>
          <p className="text-sm">Connect with students from around the world</p>
        </div>

        {/* Build Authority */}
        <div className="flex flex-col items-center px-8">
          <div className="border rounded-full  p-4 bg-[#80A5F566] ">
            <Badge size={28} strokeWidth={1} className="text-[#053CB5]" />
          </div>
          <h3 className="font-semibold text-lg">Build Authority</h3>
          <p className="text-sm">
            Establish yourself as a thought leader in blockchain
          </p>
        </div>
      </div>

      <div className="border-t border-gray-300 mt-8 pt-4 text-center text-sm">
        <p>&copy; 2025 ChainVerse Academy. All rights reserved.</p>
        <div className="mt-2 space-x-4">
          <Link href="/terms" className="text-blue-500 hover:underline">
            Terms
          </Link>
          <Link href="/privacy" className="text-blue-500 hover:underline">
            Privacy
          </Link>
          <Link href="/faq" className="text-blue-500 hover:underline">
            FAQ
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
