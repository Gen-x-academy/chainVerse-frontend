"use client";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter, useParams } from "next/navigation";
import { getMockCourses } from "../../mockCourses";

const mockCourse = {
  title: "Building with Solana and AI",
  description: "To enable tutors/instructors to manage their courses, view reports, and schedule private sessions.\nSections & Features:",
  category: "Blockchain",
  price: "20,000",
  thumbnail: "/3horizontal.png",
  categories: ["Cloud Computing", "Artificial Intelligence", "Blockchain"],
  curriculum: [
    {
      id: 1,
      name: "Introduction",
      lessons: [
        { id: 1, title: "Welcome to introduction to Solana", videos: 1 },
        { id: 2, title: "Welcome to introduction to Solana", videos: 1 },
        { id: 3, title: "Welcome to introduction to Solana", videos: 1 },
        { id: 4, title: "Welcome to introduction to Solana", videos: 1 },
        { id: 5, title: "Welcome to introduction to Solana", videos: 1 },
      ],
    },
    {
      id: 2,
      name: "Foundations of Solana",
      lessons: [
        { id: 1, title: "Welcome to introduction to Solana", videos: 1 },
        { id: 2, title: "Welcome to introduction to Solana", videos: 1 },
        { id: 3, title: "Welcome to introduction to Solana", videos: 1 },
      ],
    },
  ],
};

export default function EditCoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [course, setCourse] = useState<any>(null);
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMockCourses().then((courses) => {
      const courseList = courses as any[];
      const found = courseList.find((c: any) => c.id === courseId);
      if (found) {
        setCourse({
          ...found,
          categories: ["Cloud Computing", "Artificial Intelligence", "Blockchain"],
          curriculum: mockCourse.curriculum
        });
      }
      setLoading(false);
    });
  }, [courseId]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!course) return <div className="p-8 text-red-500">Course not found</div>;

  return (
    <div className="w-full max-w-7xl mx-auto px-2 py-8">
      {/* Botón de retroceso y título */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => router.back()}
          className="mr-2 p-2 rounded hover:bg-gray-100 transition"
          aria-label="Go back"
        >
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="text-xl font-semibold">{course.title}</h1>
      </div>
      {/* Grid principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{overflow: 'visible'}}>
        {/* Columna izquierda */}
        <div className="flex flex-col gap-6" style={{overflow: 'visible'}}>
          <div className="bg-gray-100 rounded-xl p-6 flex flex-col items-center" style={{overflow: 'visible'}}>
            <img
              src={course.thumbnail}
              alt="Course thumbnail"
              className="w-24 h-24 rounded-full object-cover mb-2"
            />
            <span className="text-sm text-gray-500">Click image to change thumbnail image</span>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 flex flex-col gap-4" style={{overflow: 'visible'}}>
            <div>
              <label className="block text-sm font-medium mb-1">Course Title</label>
              <Input value={course.title} readOnly className="bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Course Description</label>
              <Textarea value={course.description} readOnly className="bg-white min-h-[60px]" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Course Category</label>
              <Select value={course.category}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="z-[9999]" side="bottom" position="popper">
                  {course.categories.map((cat: any) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-6 flex flex-col gap-2" style={{overflow: 'visible'}}>
            <label className="block text-sm font-medium mb-1">Pricing</label>
            <span className="text-xs text-gray-500 mb-1">Set your pricing plan, you can either make it free or paid</span>
            <Input value={course.price} readOnly className="bg-white" />
          </div>
        </div>
        {/* Columna derecha */}
        <div className="flex flex-col gap-6" style={{overflow: 'visible'}}>
          <div className="bg-gray-50 rounded-xl p-6">
            <div className="text-lg font-medium mb-2">Curriculum</div>
            <div className="text-xs text-gray-500 mb-4">Set your pricing plan, you can either make it free or paid</div>
            <div className="flex flex-col gap-6">
              {course.curriculum.map((section: any, idx: any) => (
                <div key={section.id} className="bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedSection === section.id}
                        onChange={() =>
                          setSelectedSection(selectedSection === section.id ? null : section.id)
                        }
                        className="accent-blue-600 w-4 h-4"
                      />
                      <span className="font-semibold text-base">{section.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="text-gray-400">
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </Button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {section.lessons.map((lesson: any) => (
                      <div key={lesson.id} className="flex items-center justify-between px-4 py-2">
                        <div>
                          <div className="font-medium text-sm text-blue-900 hover:underline cursor-pointer">{lesson.title}</div>
                          <div className="text-xs text-gray-500">{lesson.videos} video</div>
                        </div>
                        <Button variant="ghost" size="icon" className="text-gray-400">
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </Button>
                      </div>
                    ))}
                  </div>
                  {/* Acciones de sección */}
                  {selectedSection === section.id && (
                    <div className="flex gap-2 px-4 py-2 border-t border-gray-100 bg-gray-50">
                      <Button variant="outline" className="flex-1">Delete</Button>
                      <Button variant="outline" className="flex-1">Rename</Button>
                      <Button variant="default" className="flex-1">Edit Content</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 