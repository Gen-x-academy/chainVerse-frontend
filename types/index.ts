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
  icon: 'globe' | 'book' | 'users';
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
  courseTitle: string;
  name: string;
  date: string;
  blockchain: string;
  transactionId: string;
}
export interface Instructor {
  id: number;
  name: string;
  title: string;
  description: string;
  rating: number;
  courses: number;
  students: number;
  initials: string;
  reviews?: number;
}

export interface NotificationData {}
export interface UserData {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  bio: string;
}
export interface UserProfilData {
  name: string;
  avatar: string;
  role: string;
  memberSince: string;
  coursesCompleted: string;
  certificatesEarned: string;
  walletConnected: boolean;
}

export interface WalletData {}
