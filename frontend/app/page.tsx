import NavBar from "@/components/ui/NavBar";
import FeaturedCourses from "@/components/ui/FeaturedCourses";

export default function Home() {
  return (
    <div>
      <NavBar />
      <div className="font-extrabold text-4xl text-center py-10">
        chainVerse Academy
      </div>
      <FeaturedCourses />
    </div>
  );
}
