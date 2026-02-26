import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, Clock, TrendingUp } from "lucide-react";

export default function InstructorDashboardPage() {
    const stats = [
        {
            title: "Total Students",
            value: "1,284",
            change: "+12.5%",
            icon: Users,
            color: "text-blue-600",
            bg: "bg-blue-50",
        },
        {
            title: "Active Courses",
            value: "12",
            change: "+2",
            icon: BookOpen,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
        },
        {
            title: "Total Hours",
            value: "456",
            change: "+48h",
            icon: Clock,
            color: "text-purple-600",
            bg: "bg-purple-50",
        },
        {
            title: "Earnings",
            value: "2,450 XLM",
            change: "+18%",
            icon: TrendingUp,
            color: "text-green-600",
            bg: "bg-green-50",
        },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-900">Dashboard Overview</h2>
                <p className="text-gray-500 mt-2">Here is what is happening with your courses today.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <Card key={stat.title} className="border-none shadow-sm hover:shadow-md transition-shadow duration-300">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-gray-500">{stat.title}</CardTitle>
                            <div className={`${stat.bg} p-2 rounded-lg`}>
                                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                            <p className="text-xs text-green-600 mt-1 font-semibold">
                                {stat.change} <span className="text-gray-400 font-normal ml-1">since last month</span>
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Content Placeholders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-none shadow-sm h-96">
                    <CardHeader>
                        <CardTitle>Recent Enrollments</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center h-full -mt-10">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Users className="text-gray-300" />
                            </div>
                            <p className="text-gray-400 text-sm">No recent enrollments to show.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm h-96">
                    <CardHeader>
                        <CardTitle>Upcoming Sessions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center h-full -mt-10">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Clock className="text-gray-300" />
                            </div>
                            <p className="text-gray-400 text-sm">No upcoming sessions scheduled.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
