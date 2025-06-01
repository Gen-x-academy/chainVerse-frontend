"use client"

import { BookOpen, Award, Coins, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

const summaryData = [
  {
    title: "Courses Enrolled",
    value: "4",
    subtitle: "+1 from last month",
    icon: BookOpen,
  },
  {
    title: "Certificates Earned",
    value: "1",
    subtitle: "Stellar Blockchain Fundamentals",
    icon: Award,
  },
  {
    title: "XLM Balance",
    value: "250 XLM",
    subtitle: "≈ $50.00 USD",
    icon: Coins,
  },
  {
    title: "Overall Progress",
    value: "42%",
    subtitle: "",
    icon: TrendingUp,
    showProgress: true,
  },
]

export function DashboardContent() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white px-6 py-4 relative">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900 ml-12 md:ml-0">Dashboard</h1>
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gray-200 text-sm">S</AvatarFallback>
            </Avatar>
            <span className="text-sm text-gray-600">stella...x8j2</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome back, Student</h2>
            <p className="text-gray-600">{"Here's an overview of your learning progress and activities."}</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {summaryData.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.title} className="bg-white">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-gray-600">{item.title}</CardTitle>
                    <Icon className="h-5 w-5 text-gray-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-900 mb-1">{item.value}</div>
                    {item.subtitle && <p className="text-sm text-gray-500 mb-2">{item.subtitle}</p>}
                    {item.showProgress && (
                      <div className="mt-3">
                        <Progress value={42} className="h-2" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
