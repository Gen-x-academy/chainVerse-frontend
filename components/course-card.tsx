import { Star } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface CourseCardProps {
  id: number;
  category: string;
  title: string;
  rating: number;
  description: string;
  instructor: string;
  level: string;
  price: number;
  currency: string;
}

export function CourseCard({
  id,
  category,
  title,
  rating,
  description,
  instructor,
  level,
  price,
  currency,
}: CourseCardProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardContent className="p-6 flex-grow">
        <div className="flex justify-between items-start mb-2">
          <div className="text-sm font-medium px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full">
            {category}
          </div>
          <div className="flex items-center bg-yellow-50 px-2 py-0.5 rounded-full">
            <Star className="h-4 w-4 fill-current text-yellow-500" />
            <span className="ml-1 text-sm font-medium">
              {rating.toFixed(1)}
            </span>
          </div>
        </div>
        <h3 className="text-xl font-bold mb-2 line-clamp-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {description}
        </p>
        <div className="space-y-2 border-t pt-3 mt-auto">
          <div className="flex justify-between">
            <span className="text-sm font-medium">Instructor:</span>
            <span className="text-sm">{instructor}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium">Level:</span>
            <span className="text-sm">{level}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium">Price:</span>
            <span className="text-sm font-bold">
              {price} {currency}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-6 pt-0">
        <Link href={`/courses/${id}`}>
          <Button className="w-full" variant="default">
            Enroll Now
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
