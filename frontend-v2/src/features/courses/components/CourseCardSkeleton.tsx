import { Card } from "@/src/shared/components/ui/Card";

export const CourseCardSkeleton = () => {
  return (
    <Card className="animate-pulse bg-white rounded-lg shadow-md p-6">
      <div className="h-40 bg-gray-300 rounded mb-4" />
      <div className="h-4 bg-gray-300 rounded w-3/4 mb-2" />
      <div className="h-4 bg-gray-300 rounded w-1/2" />
    </Card>
  );
};
