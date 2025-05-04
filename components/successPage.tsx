"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Wallet, Users, Check, ChartLine } from "lucide-react";
import { useFormContext } from "@/lib/form-context";

export default function SuccessPage() {
  const router = useRouter();


  return (
    <div className="max-w-3xl mx-auto px-4 pb-20">
      <BackButton href="/" label="Back toHome" />

      <div className="text-center my-10">
        <h1 className="text-3xl font-semibold">Become an Instructor</h1>
        <p className="text-muted-foreground mt-2 text-base">
          Share your blockchain expertise and earn cryptocurrency while teaching
          others
        </p>
      </div>

      <div className="bg-blue-50 rounded-xl border px-6 py-10 md:p-12 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center">
            <Check strokeWidth={2} size={28} className="text-white" />
          </div>
          <h2 className="text-xl md:text-2xl font-semibold">
            Application Submitted Successfully
          </h2>
          <p className="text-sm text-muted-foreground">
            Thank you for applying to become an instructor at ChainVerse
            Academy.
          </p>
          <p className="text-sm font-semibold max-w-xl my-10">
            Our team will have to review your application and get back to you
            within 5–7 business days. In the meantime, you can explore our
            platform for your teaching journey.
          </p>
        </div>

        <div className=" gap-8 mt-12 text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-12 text-center">
            {/* NFT Certificates */}
            <div className="flex flex-col items-center space-y-3 mb-10">
              <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded-md font-semibold">
                NFT
              </div>
              <h3 className="font-semibold text-base">NFT Certificates</h3>
              <p className="text-sm text-muted-foreground">
                Issue verifiable credentials
              </p>
            </div>

            {/* Crypto Payments */}
            <div className="flex flex-col items-center space-y-3">
              {/* <div className=" rounded-full"> */}
              <Wallet className=" w-6 text-blue-600" />
              {/* </div> */}
              <h3 className="font-semibold text-base">Crypto Payments</h3>
              <p className="text-sm text-muted-foreground">
                Earn XLM automatically
              </p>
            </div>

            {/* Global Audience */}
            <div className="flex flex-col items-center space-y-3">
              <div className=" p-3 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-base">Global Audience</h3>
              <p className="text-sm text-muted-foreground">
                Reach learners worldwide
              </p>
            </div>

            {/* Analytics Dashboard */}
            <div className="flex flex-col items-center space-y-3">
              <div className=" p-3 rounded-full">
                <ChartLine className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-base">Analytics Dashboard</h3>
              <p className="text-sm text-muted-foreground">
                Track students progress
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-12">
          <Button
            onClick={() => router.push("/")}
            // href="/"
            className="px-6 py-2 text-sm font-medium bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-md"
          >
            Return to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
