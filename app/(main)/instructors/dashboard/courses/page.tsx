'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { getMockCourses } from './mockCourses';
import InstructorCourseCard from '@/components/instructorCourseCard';

const tabList = [
  { label: 'My Courses', value: 'courses' },
  { label: 'Assignments', value: 'assignments' },
];

export default function InstructorCoursesPage() {
  const [courses, setCourses] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tab, setTab] = useState('courses');
  const router = useRouter();

  useEffect(() => {
    getMockCourses().then((data: any) => {
      setCourses(data);
      setLoading(false);
    });
  }, []);

  const handleDelete = (id: string) => {
    setCourses((prev) => (prev ? prev.filter((c) => c.id !== id) : []));
    setDeleteId(null);
  };

  const handleEdit = (id: string) => {
    router.push(`/instructors/dashboard/courses/${id}/edit`);
  };

  return (
    <div className="relative w-full max-w-7xl mx-auto px-2">
      <div className="flex items-center justify-between mt-4 mb-2">
        <h2 className="text-xl font-semibold">Courses</h2>
        <Button
          onClick={() => router.push('/instructors/dashboard/courses/new')}
          variant="outline"
          className="ml-auto"
        >
          + Add Course
        </Button>
      </div>
      {/* Custom Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {tabList.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-0 pb-1 text-base font-medium transition-colors duration-200 border-b-2 focus:outline-none
              ${
                tab === t.value
                  ? 'border-black text-black font-semibold'
                  : 'border-transparent text-gray-400 font-normal'
              }
            `}
            style={{ background: 'none' }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-60 w-full" />
          ))}
        </div>
      ) : !courses?.length ? (
        <div className="flex flex-col items-center mt-10">
          <p className="mb-4">No courses found.</p>
          <Button
            onClick={() => router.push('/instructors/dashboard/courses/new')}
          >
            Add Course
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <InstructorCourseCard
              course={course}
              onDelete={handleDelete}
              onEdit={handleEdit}
              key={course.id}
            />
          ))}
        </div>
      )}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Course</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this course?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(deleteId!)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
