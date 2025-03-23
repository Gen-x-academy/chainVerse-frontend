import NavBar from "@/components/ui/NavBar";
import HeroSection from '@/components/ui/HeroSection';
import FeaturedCourses from "@/components/ui/FeaturedCourses";
import KeyFeatures from "@/components/ui/KeyFeatures";

export default function Home() {
  return (
    <div className="">
      <NavBar />
      <HeroSection />
      <KeyFeatures/>
      <FeaturedCourses />
    </div>
  );
}
