import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Globe,
  Star,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseContent } from "@/components/course-content";
import { CourseInstructor } from "@/components/course-instructor";
import { CourseReviews } from "@/components/course-reviews";

export default function CourseDetailsPage() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="mb-6">
        <Link
          href="/courses"
          className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Course
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-4">
              Stellar Blockchain Fundamentals
            </h1>
            <p className="text-muted-foreground">
              This comprehensive course covers the fundamental concepts of the
              Stellar blockchain, including its consensus mechanism, network
              architecture, and real-world applications. You&apos;ll gain a
              solid understanding of how Stellar works, its advantages compared
              to other blockchains, and how it&apos;s used in financial
              applications worldwide.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2 text-sm bg-[#F5F5F5] border border-[#CBC7C7] p-1 rounded-xl">
              <User className="h-3 w-3" />
              <span className="text-[11px]">2453 students</span>
            </div>
            <div className="flex items-center gap-2 text-sm bg-[#F5F5F5] border border-[#CBC7C7] p-1 rounded-xl">
              <Star className="h-3 w-3" />
              <span className="text-[11px]">4.8 rating</span>
            </div>
            <div className="flex items-center gap-2 text-sm bg-[#F5F5F5] border border-[#CBC7C7] p-1 rounded-xl">
              <Clock className="h-3 w-3" />
              <span className="text-[11px]">8 Weeks</span>
            </div>
            <div className="flex items-center gap-2 text-sm bg-[#F5F5F5] border border-[#CBC7C7] p-1 rounded-xl">
              <Calendar className="h-3 w-3" />
              <span className="text-[11px]">Updated March 2025</span>
            </div>
            <div className="flex items-center gap-2 text-sm bg-[#F5F5F5] border border-[#CBC7C7] p-1 rounded-xl">
              <Globe className="h-3 w-3" />
              <span className="text-[11px]">English</span>
            </div>
            <Badge
              variant="secondary"
              className="bg-blue-500 text-white hover:bg-blue-600"
            >
              Beginner
            </Badge>
            <Badge
              variant="secondary"
              className="bg-purple-500 text-white hover:bg-purple-600"
            >
              Blockchain Basic
            </Badge>
          </div>
          <Tabs defaultValue="curriculum">
            <TabsList className="grid w-[300px] max-w-[270px] grid-cols-3 mb-8 px-4 py-2 h-full bg-[#F5F5F5] border border-[#CBC7C7] rounded-xl">
              <TabsTrigger
                className="data-[state=active]:shadow-none data-[state=active]:border data-[state=active]:border-[#CBC7C7]"
                value="curriculum"
              >
                Curriculum
              </TabsTrigger>
              <TabsTrigger
                className="data-[state=active]:shadow-none data-[state=active]:border data-[state=active]:border-[#CBC7C7]"
                value="instructor"
              >
                Instructor
              </TabsTrigger>
              <TabsTrigger
                className="data-[state=active]:shadow-none data-[state=active]:border data-[state=active]:border-[#CBC7C7]"
                value="reviews"
              >
                Reviews
              </TabsTrigger>
            </TabsList>
            <TabsContent value="curriculum">
              <CourseContent />
            </TabsContent>
            <TabsContent value="instructor">
              <CourseInstructor />
            </TabsContent>
            <TabsContent value="reviews">
              <CourseReviews />
            </TabsContent>
          </Tabs>
        </div>

        {/* Sticky Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 border rounded-lg p-6 bg-card">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-3xl font-bold">100 XLM</h2>
                <span className="text-muted-foreground">=20 USD</span>
              </div>
              <Button
                className="w-full mb-3 text-white"
                style={{
                  background:
                    "linear-gradient(90deg, #4361EE 27.4%, #5A77FF 44.71%, #936FFA 83.17%, #A879FF 91.35%, #C48BFC 100%)",
                }}
              >
                Enroll Now
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                30-day money-back guarantee
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-lg">This course includes:</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-[#4361EE] mt-0.5 flex-shrink-0" />
                  <span>24/7 access to course materials</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-[#4361EE] mt-0.5 flex-shrink-0" />
                  <span>Hands-on practical exercises</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-[#4361EE] mt-0.5 flex-shrink-0" />
                  <span>Interactive quizzes and assessments</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-[#4361EE] mt-0.5 flex-shrink-0" />
                  <span>Live Q&A sessions with the instructor</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-[#4361EE] mt-0.5 flex-shrink-0" />
                  <span>Certificate of completion (NFT)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-[#4361EE] mt-0.5 flex-shrink-0" />
                  <span>Access to exclusive community forum</span>
                </li>
              </ul>
            </div>

            <Separator className="my-6" />

            <Button
              variant="outline"
              className="w-full bg-[#FCFAF8] py-[23px] px-[44px] hover:bg-gray-200 hover:text-black"
            >
              Apply promo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
