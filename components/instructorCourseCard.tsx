'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

export default function InstructorCourseCard({
  course,
  onEdit,
  onDelete,
}: {
  course: { id: string; title: string; thumbnail: string };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="flex flex-col h-full">
      <CardContent className="flex flex-col items-center">
        <div className="flex flex-col items-center justify-center bg-gray-100 px-6 py-4">
          <img
            src={course.thumbnail}
            alt={course.title}
            className="object-contain mx-auto"
            style={{ width: 232, height: 200 }}
          />
        </div>
        <div className="px-4 py-4">
          <div className="text-base font-medium text-gray-900 text-left">
            {course.title}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between gap-2 mt-auto">
        <Button variant="outline" onClick={() => onDelete(course.id)} size="lg">
          Delete
        </Button>
        <Button onClick={() => onEdit(course.id)} size="lg">
          Edit
        </Button>
      </CardFooter>
    </Card>
  );
}


