export interface TeamMember {
  id: number;
  name: string;
  title: string;
  bio: string;
  initials: string;
  bgColor: string;
}

export interface FAQ {
  id: number;
  question: string;
  answer: string;
}

export interface WhyChooseItem {
  id: number;
  title: string;
  description: string;
  icon: "globe" | "book" | "users";
}

export interface AboutContent {
  title: string;
  subtitle: string;
  description: string;
  vision: string;
  values: string;
  approach: string;
}

export interface RouteType {
  name: string;
  icon: any;
  route: string;
  isActive: boolean;
}

export interface InstructorProps {
  id: number;
  name: string;
  img: string;
  wallletAddress: string;
}

export interface StudentProps {
  name: string;
  date: string;
  courseTitle: string;
  blockchain: string;
  transactionId: string;
}
