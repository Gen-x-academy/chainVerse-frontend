import Image from "next/image";
import { Star } from "lucide-react";

// Dummy data for instructor
const instructor = {
  name: "Dr. Sarah Chen",
  title: "Blockchain Researcher & Educator",
  bio: "Dr. Sarah Chen is a renowned blockchain researcher and educator with over 8 years of experience in distributed systems. She has contributed to several open-source blockchain projects and has published numerous papers on consensus mechanisms and blockchain scalability.",
  experience: [
    "Lead Researcher at Stellar Development Foundation (2020-Present)",
    "Blockchain Consultant for Fortune 500 companies (2018-2020)",
    "PhD in Computer Science, specializing in Distributed Systems",
    "Author of 'Blockchain Fundamentals: A Practical Approach'",
  ],
  stats: {
    courses: 12,
    students: 15000,
    rating: 4.8,
    reviews: 2453,
  },
  imageUrl: "/placeholder.svg?height=200&width=200",
};

export function CourseInstructor() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-shrink-0">
          <Image
            src={instructor.imageUrl || "/placeholder.svg"}
            alt={instructor.name}
            width={150}
            height={150}
            className="rounded-full object-cover"
          />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">{instructor.name}</h2>
          <p className="text-muted-foreground mb-4">{instructor.title}</p>
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              <span className="ml-1 font-medium">
                {instructor.stats.rating}
              </span>
              <span className="ml-1 text-muted-foreground">
                ({instructor.stats.reviews} reviews)
              </span>
            </div>
            <div className="text-muted-foreground">
              {instructor.stats.students.toLocaleString()} students
            </div>
            <div className="text-muted-foreground">
              {instructor.stats.courses} courses
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-3">About the Instructor</h3>
        <p className="mb-4">{instructor.bio}</p>

        <h3 className="text-xl font-semibold mb-3">Experience</h3>
        <ul className="list-disc pl-5 space-y-2">
          {instructor.experience.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
