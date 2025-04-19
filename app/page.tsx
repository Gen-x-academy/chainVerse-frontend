import NavBar from '@/components/ui/NavBar';
import HeroSection from '@/components/ui/HeroSection';
import FeaturedCourses from '@/components/ui/FeaturedCourses';
import KeyFeatures from '@/components/ui/KeyFeatures';
import Footer from '@/components/ui/Footer';

export default function Home() {
  return (
    <div className="container mx-auto ">
      <HeroSection />
      <KeyFeatures />
      <FeaturedCourses />
      <Footer />
    </div>
  );
}
