export interface Instructor {
    id: string;
    initials: string;
    name: string;
    title: string;
    bio: string;
    rating: number;
    courseCount: number;
    studentCount: number;
    avatarColor: string;
  }
  
  export const instructors: Instructor[] = [
    {
      id: "1",
      initials: "AJ",
      name: "Alex Johnson",
      title: "Blockchain Architect at StellarPay",
      bio: "Alex has been developing on the Stellar blockchain for over five years and specializes in creating secure, scalable dApps for the financial sector.",
      rating: 4.8,
      courseCount: 3,
      studentCount: 4250,
      avatarColor: "bg-blue-100"
    },
    {
      id: "2",
      initials: "MG",
      name: "Maria Garcia",
      title: "Smart Contract Developer",
      bio: "Maria specializes in smart contract audit and security. She has worked on major DeFi projects and teaches best practices in blockchain security.",
      rating: 4.9,
      courseCount: 5,
      studentCount: 3350,
      avatarColor: "bg-purple-100"
    },
    {
      id: "3",
      initials: "DC",
      name: "David Chen",
      title: "Web3 Integration Specialist",
      bio: "David guides developers on integrating Web3 technologies for traditional businesses, with expertise in Ethereum and Solana ecosystems.",
      rating: 4.7,
      courseCount: 4,
      studentCount: 5085,
      avatarColor: "bg-blue-100"
    },
    {
      id: "4",
      initials: "SW",
      name: "Sarah Williams",
      title: "Crypto Research Specialist",
      bio: "As a industry researcher, Sarah specializes in analyzing DeFi protocols and helping students understand tokenomics and crypto market dynamics.",
      rating: 4.6,
      courseCount: 2,
      studentCount: 1850,
      avatarColor: "bg-gray-100"
    },
    {
      id: "5",
      initials: "MB",
      name: "Michael Brown",
      title: "dApp Frontend Developer",
      bio: "Michael combines his frontend development skills with blockchain knowledge to create intuitive and responsive decentralized application interfaces.",
      rating: 4.5,
      courseCount: 3,
      studentCount: 2340,
      avatarColor: "bg-green-100"
    },
    {
      id: "6",
      initials: "JL",
      name: "Jennifer Lee",
      title: "Cryptocurrency Consultant",
      bio: "With deep background in traditional finance, Jennifer helps bridge the gap between conventional financial systems and emerging blockchain technologies.",
      rating: 4.6,
      courseCount: 4,
      studentCount: 2765,
      avatarColor: "bg-indigo-100"
    },
    {
      id: "7",
      initials: "RT",
      name: "Robert Taylor",
      title: "Blockchain Protocol Engineer",
      bio: "Robert specializes in Layer 1 and Layer 2 blockchain protocols, focusing on scalability solutions and consensus mechanisms.",
      rating: 4.9,
      courseCount: 6,
      studentCount: 6120,
      avatarColor: "bg-amber-100"
    },
    {
      id: "8",
      initials: "EZ",
      name: "Elena Zhang",
      title: "NFT and Digital Asset Expert",
      bio: "Elena's expertise spans NFT marketplaces, digital asset tokenization, and implementing metadata standards for blockchain-based collectibles.",
      rating: 4.7,
      courseCount: 3,
      studentCount: 3890,
      avatarColor: "bg-rose-100"
    }
  ];