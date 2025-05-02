import { File } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// Dummy data for course content
const courseModules = [
  {
    id: 1,
    title: "Introduction to Blockchain",
    lessons: [
      { id: 1, title: "What is Blockchain Technology?", duration: 45 },
      { id: 2, title: "Distributed Ledger Fundamentals", duration: 50 },
      { id: 3, title: "Blockchain vs. Traditional Databases", duration: 40 },
    ],
    lessonCount: 3,
  },
  {
    id: 2,
    title: "Introduction to Blockchain",
    lessons: [
      { id: 4, title: "Consensus Mechanisms Explained", duration: 55 },
      { id: 5, title: "Public vs Private Blockchains", duration: 45 },
      { id: 6, title: "Blockchain Security Fundamentals", duration: 60 },
      { id: 7, title: "Smart Contracts Introduction", duration: 50 },
    ],
    lessonCount: 4,
  },
  {
    id: 3,
    title: "Introduction to Blockchain",
    lessons: [
      { id: 8, title: "Stellar Network Architecture", duration: 65 },
      { id: 9, title: "Stellar Consensus Protocol", duration: 55 },
      { id: 10, title: "Building on Stellar", duration: 70 },
    ],
    lessonCount: 3,
  },
];

export function CourseContent() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Course Content</h2>
        <p className="text-muted-foreground">10 lessons • 8 weeks total</p>
      </div>

      <Accordion type="multiple" defaultValue={["module-1"]}>
        {courseModules.map((module) => (
          <AccordionItem
            key={module.id}
            value={`module-${module.id}`}
            className="border rounded-md mb-4 overflow-hidden"
          >
            <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 [&[data-state=open]>svg]:rotate-180">
              <div className="flex justify-between items-center w-full">
                <span className="font-medium">{module.title}</span>
                <span className="text-sm text-muted-foreground">
                  {module.lessonCount} lessons
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-0">
              <ul className="divide-y">
                {module.lessons.map((lesson) => (
                  <li
                    key={lesson.id}
                    className="flex items-start py-3 px-4 hover:bg-muted/30"
                  >
                    <div className="flex items-center mr-3 mt-1">
                      <File className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{lesson.title}</p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {lesson.duration} min
                    </div>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
