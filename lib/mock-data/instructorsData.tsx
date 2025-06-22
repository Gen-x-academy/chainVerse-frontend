// Export the instructors data properly
// File: data/instructorsData.ts
import { Instructor } from '../types';

export const instructorsData: Instructor[] = [
  {
    id: 1,
    name: 'Alex Johnson',
    title: 'Blockchain Architect at StellarPay',
    description:
      'Alex has been developing on the Stellar blockchain for over five years...',
    rating: 4.8,
    courses: 3,
    students: 4250,
    initials: 'AJ',
  },
  {
    id: 2,
    name: 'Maria Garcia',
    title: 'Smart Contract Developer & Consultant',
    description:
      'Maria is a renowned smart contract expert who has built multiple dApps...',
    rating: 4.6,
    courses: 5,
    students: 3128,
    initials: 'MG',
  },
  {
    id: 3,
    name: 'David Chen',
    title: 'Founder of DappWorks Labs',
    description: 'David has developed Web3 applications for major companies...',
    rating: 4.9,
    courses: 4,
    students: 5680,
    initials: 'DC',
  },
  {
    id: 4,
    name: 'Sarah Williams',
    title: 'Blockchain Security Researcher',
    description:
      'Sarah is a security researcher specializing in vulnerabilities and audits...',
    rating: 4.7,
    courses: 2,
    students: 1890,
    initials: 'SW',
  },
  {
    id: 5,
    name: 'Micheal Brown',
    title: 'NFT Artist & Developer',
    description:
      'Michael combines his artistic background with technical skills...',
    rating: 4.5,
    courses: 3,
    students: 2340,
    initials: 'MB',
  },
  {
    id: 6,
    name: 'Jennifer Lee',
    title: 'DeFi Protocol Designer',
    description:
      'Jennifer has designed DeFi protocols handling millions in TVL...',
    rating: 4.8,
    courses: 4,
    students: 3750,
    initials: 'JL',
  },
];

export const instructorRoutes = [
  {
    name: 'Overview',
    icon: (
      <svg
        className="w-5 h-5"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 22.75C6.07 22.75 1.25 17.93 1.25 12C1.25 9.64 2 7.4 3.42 5.52C3.67 5.19 4.14 5.13 4.47 5.38C4.8 5.63 4.87 6.1 4.62 6.43C3.4 8.04 2.75 9.97 2.75 12C2.75 17.1 6.9 21.25 12 21.25C17.1 21.25 21.25 17.1 21.25 12C21.25 6.9 17.1 2.75 12 2.75C11.59 2.75 11.25 2.41 11.25 2C11.25 1.59 11.59 1.25 12 1.25C17.93 1.25 22.75 6.07 22.75 12C22.75 17.93 17.93 22.75 12 22.75Z"
          fill="#0D1330"
        />
        <path
          d="M12 19.75C7.73 19.75 4.25 16.27 4.25 12C4.25 11.59 4.59 11.25 5 11.25C5.41 11.25 5.75 11.59 5.75 12C5.75 15.45 8.55 18.25 12 18.25C15.45 18.25 18.25 15.45 18.25 12C18.25 8.55 15.45 5.75 12 5.75C11.59 5.75 11.25 5.41 11.25 5C11.25 4.59 11.59 4.25 12 4.25C16.27 4.25 19.75 7.73 19.75 12C19.75 16.27 16.27 19.75 12 19.75Z"
          fill="#0D1330"
        />
        <path
          d="M12 16.75C11.59 16.75 11.25 16.41 11.25 16C11.25 15.59 11.59 15.25 12 15.25C13.79 15.25 15.25 13.79 15.25 12C15.25 10.21 13.79 8.75 12 8.75C11.59 8.75 11.25 8.41 11.25 8C11.25 7.59 11.59 7.25 12 7.25C14.62 7.25 16.75 9.38 16.75 12C16.75 14.62 14.62 16.75 12 16.75Z"
          fill="#0D1330"
        />
      </svg>
    ),
    route: '/instructors/dashboard',
    isActive: false,
  },
  {
    name: 'Account',
    icon: (
      <svg
        className="w-5 h-5"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12.1601 10.87C12.0601 10.86 11.9401 10.86 11.8301 10.87C9.45006 10.79 7.56006 8.84 7.56006 6.44C7.56006 3.99 9.54006 2 12.0001 2C14.4501 2 16.4401 3.99 16.4401 6.44C16.4301 8.84 14.5401 10.79 12.1601 10.87Z"
          stroke="#0D1330"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.15997 14.56C4.73997 16.18 4.73997 18.82 7.15997 20.43C9.90997 22.27 14.42 22.27 17.17 20.43C19.59 18.81 19.59 16.17 17.17 14.56C14.43 12.73 9.91997 12.73 7.15997 14.56Z"
          stroke="#0D1330"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    route: '/instructors/dashboard/account',
    isActive: false,
  },
  {
    name: 'Course Management',
    icon: (
      <svg
        className="w-5 h-5"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z"
          stroke="#0D1330"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 2.43994V12.4199C17 14.3899 15.59 15.1599 13.86 14.1199L12.54 13.3299C12.24 13.1499 11.76 13.1499 11.46 13.3299L10.14 14.1199C8.41 15.1499 7 14.3899 7 12.4199V2.43994"
          stroke="#0D1330"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z"
          stroke="#0D1330"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 2.43994V12.4199C17 14.3899 15.59 15.1599 13.86 14.1199L12.54 13.3299C12.24 13.1499 11.76 13.1499 11.46 13.3299L10.14 14.1199C8.41 15.1499 7 14.3899 7 12.4199V2.43994"
          stroke="#0D1330"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    route: '/instructors/dashboard/courses',
    isActive: false,
  },
  {
    name: 'Sessions',
    icon: (
      <svg
        className="w-5 h-5"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3 1.75H21C21.1339 1.75 21.25 1.86614 21.25 2V14.0996C21.25 15.1652 20.9462 15.9366 20.4414 16.4414C19.9366 16.9462 19.1652 17.25 18.0996 17.25H5.90039C4.83484 17.25 4.06341 16.9462 3.55859 16.4414C3.05378 15.9366 2.75 15.1652 2.75 14.0996V2C2.75 1.86614 2.86614 1.75 3 1.75ZM3.25 14.0996C3.25 14.9065 3.42773 15.6016 3.91309 16.0869C4.39845 16.5723 5.09353 16.75 5.90039 16.75H18.0898C18.8967 16.75 19.5918 16.5723 20.0771 16.0869C20.5624 15.6016 20.7402 14.9064 20.7402 14.0996V2.25H3.25V14.0996Z"
          fill="#292D32"
          stroke="#0D1330"
        />
        <path
          d="M2 1.75H22C22.1339 1.75 22.25 1.86614 22.25 2C22.25 2.13386 22.1339 2.25 22 2.25H2C1.86614 2.25 1.75 2.13386 1.75 2C1.75 1.86614 1.86614 1.75 2 1.75Z"
          fill="#292D32"
          stroke="#0D1330"
        />
        <path
          d="M12 16.75C12.1339 16.75 12.25 16.8661 12.25 17V20C12.25 20.0655 12.2224 20.1319 12.1689 20.1807L12.1064 20.2227L8.10645 22.2227C8.07099 22.2404 8.02705 22.25 8 22.25C7.92516 22.2499 7.86047 22.2212 7.81543 22.1719L7.77734 22.1162L7.77539 22.1113L7.75781 22.0664C7.73197 21.9744 7.76187 21.872 7.84668 21.8066L7.89355 21.7773L11.4736 19.9873L11.75 19.8486V17C11.75 16.8662 11.8663 16.7502 12 16.75Z"
          fill="#292D32"
          stroke="#0D1330"
        />
        <path
          d="M11.7773 19.8838C11.8443 19.7596 11.9939 19.7123 12.1152 19.7676H12.1162L16.1162 21.7676C16.2399 21.8342 16.2866 21.9825 16.2324 22.1035C16.18 22.2009 16.0865 22.25 16 22.25C15.9865 22.25 15.9689 22.2477 15.9502 22.2432L15.8936 22.2227L11.8936 20.2227C11.7691 20.1555 11.7214 20.0052 11.7773 19.8838Z"
          fill="#292D32"
          stroke="#0D1330"
        />
        <path
          d="M7.49993 11.7502C7.28993 11.7502 7.06994 11.6602 6.91994 11.4802C6.64994 11.1602 6.69992 10.6902 7.01992 10.4202L10.1699 7.79018C10.4599 7.55018 10.8299 7.45018 11.1799 7.51018C11.5399 7.57018 11.8499 7.79016 12.0399 8.11016L13.0899 9.86016L16.0199 7.42019C16.3399 7.16019 16.8099 7.20016 17.0799 7.52016C17.3499 7.84016 17.2999 8.31016 16.9799 8.58016L13.8299 11.2102C13.5399 11.4502 13.1699 11.5502 12.8199 11.4902C12.4599 11.4302 12.1499 11.2102 11.9599 10.8902L10.9099 9.14019L7.97994 11.5802C7.83994 11.6902 7.66993 11.7502 7.49993 11.7502Z"
          fill="#292D32"
        />
      </svg>
    ),
    route: '/instructors/dashboard/sessions',
    isActive: false,
  },
];

export const instructor = {
  id: 0,
  name: 'Smith Johnson',
  img: 'data:image/jpeg;base64,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',
  wallletAddress: '0xdf2hgu54egdtd6f8dg9979h9a56',
};
