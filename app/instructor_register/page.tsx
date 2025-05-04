"use client";
// import { InstructorRegistrationForm } from "@/components/instructor-registration-form";
import { Header } from "@/components/header";
import { InstructorRegistrationForm } from "@/components/instructor-registeration-form";
import Footer from "@/components/ui/Footer";

export default function InstructorRegisterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAF8]">
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <InstructorRegistrationForm />
        </div>
      </main>
    </div>
  );
}
