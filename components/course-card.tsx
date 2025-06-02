// import { Star } from 'lucide-react';
// import { Card, CardContent, CardFooter } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import Link from 'next/link';

// interface CourseCardProps {
//   id: number;
//   category: string;
//   title: string;
//   rating: number;
//   description: string;
//   instructor: string;
//   level: string;
//   price: number;
//   currency: string;
// }

// export function CourseCard({
//   id,
//   category,
//   title,
//   rating,
//   description,
//   instructor,
//   level,
//   price,
//   currency,
// }: CourseCardProps) {
//   return (
//     <Card className="h-full flex flex-col">
//       <CardContent className="p-6 flex-grow">
//         <div className="flex justify-between items-start mb-2">
//           <div className="text-sm font-medium px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full">
//             {category}
//           </div>
//           <div className="flex items-center bg-yellow-50 px-2 py-0.5 rounded-full">
//             <Star className="h-4 w-4 fill-current text-yellow-500" />
//             <span className="ml-1 text-sm font-medium">
//               {rating.toFixed(1)}
//             </span>
//           </div>
//         </div>
//         <h3 className="text-xl font-bold mb-2 line-clamp-2">{title}</h3>
//         <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
//           {description}
//         </p>
//         <div className="space-y-2 border-t pt-3 mt-auto">
//           <div className="flex justify-between">
//             <span className="text-sm font-medium">Instructor:</span>
//             <span className="text-sm">{instructor}</span>
//           </div>
//           <div className="flex justify-between">
//             <span className="text-sm font-medium">Level:</span>
//             <span className="text-sm">{level}</span>
//           </div>
//           <div className="flex justify-between">
//             <span className="text-sm font-medium">Price:</span>
//             <span className="text-sm font-bold">
//               {price} {currency}
//             </span>
//           </div>
//         </div>
//       </CardContent>
//       <CardFooter className="p-6 pt-0">
//         <Link href={`/courses/${id}`}>
//           <Button className="w-full" variant="default">
//             Enroll Now
//           </Button>
//         </Link>
//       </CardFooter>
//     </Card>
//   );
// }



import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface CourseCardProps {
  id: number
  category: string
  title: string
  rating: number
  description: string
  instructor: string
  level: string
  price: number
  currency: string
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
  onAddToCart,
}: CourseCardProps & { onAddToCart?: () => void }) {
  // Generate star rating display
  const renderStars = () => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} className="w-4 h-4 fill-[#FEA780] text-[#FEA780]" />)
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Star key={i} className="w-4 h-4 fill-[#D9D9D9] text-[#D9D9D9]" />)
      } else {
        stars.push(<Star key={i} className="w-4 h-4 fill-[#D9D9D9] text-[#D9D9D9]" />)
      }
    }
    return stars
  }

  return (
    <Card className="bg-white py-0 border-[#808080] hover:shadow-lg transition-shadow duration-200 rounded-2xl overflow-hidden">
      <CardContent className="p-0">
        {/* Course Thumbnail with Gradient */}
        <div className="relative h-52 bg-gray-100 overflow-hidden">
          <div className="absolute inset-0 flex">
            {/* Purple gradient stripe */}
            <div className="flex-1 bg-gradient-to-b from-purple-300 via-purple-500 to-purple-900"></div>
            {/* Orange gradient stripe */}
            <div className="flex-1 bg-gradient-to-b from-orange-300 via-orange-500 to-orange-900"></div>
            {/* Gray gradient stripe */}
            <div className="flex-1 bg-gradient-to-b from-gray-300 via-gray-600 to-black"></div>
          </div>
        </div>

        {/* Course Content */}
        <div className="p-4">
          {/* Rating */}
          <div className="flex items-center gap-1 mb-2">
            {renderStars()}
            <span className="text-sm text- ml-1">{rating}</span>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-[#333333] mb-2 text-base leading-tight">{title}</h3>

          {/* Description */}
          <p className="text-[#666666] text-sm mb-3 line-clamp-2 leading-relaxed">{description}</p>

          {/* Instructor */}
          <p className="text-[#999999] text-sm mb-3">{instructor}</p>

          {/* Level and Price */}
          <div className="flex items-center gap-4 mb-4 text-sm text-[#666666]">
            <span>{level}</span>
            <span>
              {price} {currency}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-sm h-9 border-[#4361EE] text-[#4361EE] hover:bg-[#F2F6FF] font-medium"
              onClick={onAddToCart}
            >
              <span className=" text-[#4361EE]">Add to Cart</span>
            </Button>
            <Button size="sm" className="flex-1 text-sm h-9 bg-[#4361EE] hover:bg-[#3551b7] font-medium">
              <span className=" text-white">Buy Now</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default CourseCard;
