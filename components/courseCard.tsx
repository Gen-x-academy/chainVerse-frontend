'use client';

import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';

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
  onAddToCart,
}: CourseCardProps & {
  onAddToCart?: () => void;
}) {
  // Generate star rating display
  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star key={i} className="w-4 h-4 fill-[#FEA780] text-[#FEA780]" />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <Star key={i} className="w-4 h-4 fill-[#D9D9D9] text-[#D9D9D9]" />
        );
      } else {
        stars.push(
          <Star key={i} className="w-4 h-4 fill-[#D9D9D9] text-[#D9D9D9]" />
        );
      }
    }
    return stars;
  };

  return (
    <Card className="flex flex-col h-full">
      <CardContent className="flex flex-col items-center">
        <div className="relative h-48 bg-gray-100 overflow-hidden">
          <Image
            src={image}
            alt={title}
            className="w-full h-full object-cover"
            width={400}
            height={200}
          />
        </div>

        {/* Course Content */}
        <div className="p-4">
          <div className="flex items-center gap-1 mb-2">
            {renderStars()}
            <span className="text-sm text- ml-1">{rating}</span>
          </div>

          <h3 className="font-semibold text-[#333333] mb-2 text-base leading-tight">
            {title}
          </h3>

          <p className="text-[#666666] text-sm mb-3 line-clamp-2 leading-relaxed">
            {description}
          </p>

          <p className="text-[#999999] font-light text-sm mb-3">{instructor}</p>

          <div className="flex items-center gap-4 mb-4 text-sm text-[#666666]">
            <span className="font-medium text-base">{level}</span>
            <span className="font-medium text-sm">
              {price} {currency}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-sm h-9 cursor-pointer border-[#4361EE] text-[#4361EE] hover:bg-[#F2F6FF] font-medium"
              onClick={onAddToCart}
            >
              <span className=" text-[#4361EE]">Add to Cart</span>
            </Button>
            <Button
              size="sm"
              className="flex-1 text-sm h-9 cursor-pointer bg-[#4361EE] hover:bg-[#3551b7] font-medium"
            >
              <span className=" text-white">Buy Now</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
