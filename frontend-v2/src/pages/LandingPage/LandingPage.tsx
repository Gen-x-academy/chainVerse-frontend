import HeroSection from '@/src/shared/components/HeroSection'
import { Features } from './sections/Features/Features'
import FeaturedCourses from '@/src/shared/components/FeaturedCourses'
import Footer from '@/src/shared/components/Footer'

export function LandingPage() {
  return (
    <main>
      <HeroSection />
      <Features />
      <FeaturedCourses />
      <Footer />
    </main>
  )
}
