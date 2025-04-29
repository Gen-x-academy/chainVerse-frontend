// Export the instructors data properly
// File: data/instructorsData.ts
import { Instructor } from "../types";

export const instructorsData: Instructor[] = [
  {
    id: 1,
    name: "Alex Johnson",
    title: "Blockchain Architect at StellarPay",
    description:
      "Alex has been developing on the Stellar blockchain for over five years...",
    rating: 4.8,
    courses: 3,
    students: 4250,
    initials: "AJ",
  },
  {
    id: 2,
    name: "Maria Garcia",
    title: "Smart Contract Developer & Consultant",
    description:
      "Maria is a renowned smart contract expert who has built multiple dApps...",
    rating: 4.6,
    courses: 5,
    students: 3128,
    initials: "MG",
  },
  {
    id: 3,
    name: "David Chen",
    title: "Founder of DappWorks Labs",
    description: "David has developed Web3 applications for major companies...",
    rating: 4.9,
    courses: 4,
    students: 5680,
    initials: "DC",
  },
  {
    id: 4,
    name: "Sarah Williams",
    title: "Blockchain Security Researcher",
    description:
      "Sarah is a security researcher specializing in vulnerabilities and audits...",
    rating: 4.7,
    courses: 2,
    students: 1890,
    initials: "SW",
  },
  {
    id: 5,
    name: "Micheal Brown",
    title: "NFT Artist & Developer",
    description:
      "Michael combines his artistic background with technical skills...",
    rating: 4.5,
    courses: 3,
    students: 2340,
    initials: "MB",
  },
  {
    id: 6,
    name: "Jennifer Lee",
    title: "DeFi Protocol Designer",
    description:
      "Jennifer has designed DeFi protocols handling millions in TVL...",
    rating: 4.8,
    courses: 4,
    students: 3750,
    initials: "JL",
  },
];
