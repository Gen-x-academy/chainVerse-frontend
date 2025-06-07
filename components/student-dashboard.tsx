"use client"
import { SidebarProvider } from "@/components/ui/sidebar"
import { StudentSidebar } from "./student-sidebar"
import { DashboardContent } from "./dashboard-content"
// import { DashboardContent } from "./dashboard-content"
// import { StudentSidebar } from "./student-sidebar"

export function StudentDashboard() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <StudentSidebar />
        <DashboardContent />
      </div>
    </SidebarProvider>
  )
}
