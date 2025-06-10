"use client";

import Certificate from "@/components/dashboard/student/certificates/Certificate";
import CertificateHeader from "@/components/dashboard/student/certificates/CertificateHeader";
import { StudentSidebar } from "@/components/student-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { student } from "@/lib/mock-data/studentCertificate";
import Link from "next/link";
import React from "react";

const Certificates = () => {
  return (
    <SidebarProvider>
      <StudentSidebar />
      <div className="w-full min-h-screen">
        <CertificateHeader />
        <div className="p-8">
          <Certificate student={student} />
        </div>
        <div className="flex gap-10 justify-end pb-2 pr-16 fixed bottom-2 right-4">
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
    </SidebarProvider>
  );
};

export default Certificates;
