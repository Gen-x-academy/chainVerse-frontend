import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export const StarRating: React.FC<{ rating: number; max?: number }> = ({ rating, max = 5 }) => {
  return (
    <div className="flex gap-0.5" aria-label={`Rated ${rating} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={cn('w-4 h-4', i < Math.floor(rating) ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-300')}
        />
      ))}
    </div>
  );
};
