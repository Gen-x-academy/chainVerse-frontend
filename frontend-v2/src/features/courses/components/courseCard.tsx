'use client';

import { Star, Heart, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { useState } from 'react';

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
  image: string;
}

export function CourseCard({
  title,
  rating,
  description,
  instructor,
  level,
  price,
  currency,
  image,
  category,
  onAddToCart,
}: CourseCardProps & {
  onAddToCart?: () => void;
}) {
  const [isWishlisted, setIsWishlisted] = useState(false);

  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        );
      } else {
        stars.push(
          <Star key={i} className="w-4 h-4 fill-gray-200 text-gray-300" />
        );
      }
    }
    return stars;
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden hover:shadow-lg transition-all duration-300 border-gray-200 hover:border-indigo-200 group">
      {/* Image Container */}
      <div className="relative h-40 bg-gradient-to-br from-blue-400 to-indigo-600 overflow-hidden">
        {image ? (
          <Image
            src={image}
            alt={title}
            fill
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white text-sm font-semibold">{category}</span>
          </div>
        )}
        {/* Wishlist Button */}
        <button
          onClick={() => setIsWishlisted(!isWishlisted)}
          className="absolute top-3 right-3 bg-white rounded-full p-2 shadow-md hover:shadow-lg transition-all hover:scale-110"
        >
          <Heart
            size={18}
            className={isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-400'}
          />
        </button>
        {/* Category Badge */}
        <div className="absolute top-3 left-3 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
          {category}
        </div>
      </div>

      {/* Content */}
      <CardContent className="flex flex-col flex-1 p-5 space-y-4">
        {/* Title */}
        <div>
          <h3 className="text-base font-bold text-gray-900 line-clamp-2 group-hover:text-indigo-600 transition-colors">
            {title}
          </h3>
        </div>

        {/* Instructor & Rating */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-600">By {instructor}</p>
          <div className="flex items-center gap-1">
            <div className="flex gap-0.5">{renderStars()}</div>
            <span className="text-xs font-semibold text-gray-700 ml-1">{rating}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 line-clamp-2">{description}</p>

        {/* Level Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              level === 'beginner'
                ? 'bg-green-100 text-green-700'
                : level === 'intermediate'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-purple-100 text-purple-700'
            }`}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </span>
        </div>

        {/* Price & Button */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-auto">
          <span className="text-xl font-bold text-indigo-600">
            ${price.toFixed(2)}
          </span>
          <Button
            onClick={onAddToCart}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 group/btn"
          >
            <ShoppingCart size={16} className="group-hover/btn:scale-110 transition-transform" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
