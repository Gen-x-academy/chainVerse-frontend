import { Star } from "lucide-react";
import { Progress } from "@/components/ui/progress";

// Dummy data for reviews
const reviewStats = {
  average: 4.8,
  total: 2453,
  distribution: [
    { stars: 5, percentage: 85, count: 2085 },
    { stars: 4, percentage: 10, count: 245 },
    { stars: 3, percentage: 3, count: 74 },
    { stars: 2, percentage: 1, count: 25 },
    { stars: 1, percentage: 1, count: 24 },
  ],
};

const reviews = [
  {
    id: 1,
    name: "Alex Johnson",
    date: "April 15, 2025",
    rating: 5,
    comment:
      "This course exceeded my expectations. The instructor explains complex blockchain concepts in a way that's easy to understand. The hands-on exercises were particularly helpful in reinforcing the material.",
  },
  {
    id: 2,
    name: "Maria Garcia",
    date: "March 28, 2025",
    rating: 5,
    comment:
      "As someone with no prior blockchain experience, I found this course to be the perfect introduction. The Stellar-specific content was detailed and practical. I'm now confident in building my first application on the Stellar network.",
  },
  {
    id: 3,
    name: "David Kim",
    date: "March 10, 2025",
    rating: 4,
    comment:
      "Great course overall. The content is well-structured and the instructor is knowledgeable. I would have liked more advanced examples toward the end, but it's an excellent foundation for beginners.",
  },
  {
    id: 4,
    name: "Priya Patel",
    date: "February 22, 2025",
    rating: 5,
    comment:
      "The course does an excellent job of explaining the Stellar consensus protocol. The community forum is also very active, which helped me get answers to questions that came up during the exercises.",
  },
];

export function CourseReviews() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="md:w-1/3 flex flex-col items-center justify-center">
          <div className="text-5xl font-bold mb-2">{reviewStats.average}</div>
          <div className="flex mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-5 w-5 ${
                  star <= Math.round(reviewStats.average)
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-muted-foreground"
                }`}
              />
            ))}
          </div>
          <div className="text-sm text-muted-foreground">
            Course Rating • {reviewStats.total} reviews
          </div>
        </div>

        <div className="md:w-2/3">
          {reviewStats.distribution.map((item) => (
            <div key={item.stars} className="flex items-center mb-2">
              <div className="w-16 text-sm flex items-center">
                <span>{item.stars}</span>
                <Star className="h-3 w-3 ml-1 text-yellow-500 fill-yellow-500" />
              </div>
              <Progress value={item.percentage} className="h-2 flex-1 mx-2" />
              <div className="w-16 text-right text-sm text-muted-foreground">
                {item.percentage}%
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-semibold">Student Reviews</h3>

        {reviews.map((review) => (
          <div key={review.id} className="border-b pb-6 last:border-0">
            <div className="flex justify-between mb-2">
              <div className="font-medium">{review.name}</div>
              <div className="text-sm text-muted-foreground">{review.date}</div>
            </div>
            <div className="flex mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${
                    star <= review.rating
                      ? "text-yellow-500 fill-yellow-500"
                      : "text-muted-foreground"
                  }`}
                />
              ))}
            </div>
            <p className="text-sm">{review.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
