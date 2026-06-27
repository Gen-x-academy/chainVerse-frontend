import type { Metadata } from 'next';
import { CoursesPage } from '@/features/courses/pages/CoursesPage';

export const metadata: Metadata = {
  title: 'Explore Courses — ChainVerse',
  description:
    'Browse blockchain, DeFi, NFT and smart contract courses. Filter by category, level and price.',
};

export default function Page() {
  return <CoursesPage />;
}
