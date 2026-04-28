import { HeroSection } from '@/src/shared/shared/HeroSection'
import { Features } from './sections/Features/Features'
import { FeaturedCourses } from '@/src/shared/shared/FeaturedCourses'
import { Footer } from '@/src/shared/shared/Footer'

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
