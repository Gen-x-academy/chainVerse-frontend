import Link from "next/link"
import { BookOpen,Trophy,ShieldCheck } from "lucide-react"


import { Button } from "@/components/ui/button"
import { aboutData } from "@/data/about-data"
import { teamData } from "@/data/team-data"
import TeamMemberCard from "./team-member-card"
import WhyChooseCard from "./why-choose-card"
import { whyChooseData } from "@/data/why-choose-data"
import FaqAccordion from "./faq-accordion"
import { faqData } from "@/data/faq-data"

export const metadata = {
  title: "About ChainVerse Academy",
  description: "Learn about our mission, team, and approach to blockchain education",
}

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Main content */}
      <main className="flex-1">
        {/* Hero section */}
        <section className="py-12 md:py-16 text-center px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{aboutData.title}</h1>
          <p className="text-sm text-muted-foreground mb-6">{aboutData.subtitle}</p>
          <p className="max-w-3xl mx-auto text-muted-foreground">{aboutData.description}</p>
        </section>

        {/* Vision, Values, Approach section */}
        <section className="py-8 px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Vision Card */}
            <div className="border rounded-lg p-6 flex flex-col items-start">
              <div className="w-10 h-10 flex items-center justify-center text-blue-600 mb-4">
                <BookOpen className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-semibold mb-4">Our Vision</h2>
              <p className="text-sm text-muted-foreground">{aboutData.vision}</p>
            </div>

            {/* Values Card */}
            <div className="border rounded-lg p-6 flex flex-col items-start">
              <div className="w-10 h-10 flex items-center justify-center text-blue-600 mb-4">
               <ShieldCheck className="h-7 w-7 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold mb-4">Our Values</h2>
              <p className="text-sm text-muted-foreground">{aboutData.values}</p>
            </div>

            {/* Approach Card */}
            <div className="border rounded-lg p-6 flex flex-col items-start">
              <div className="w-10 h-10 flex items-center justify-center text-blue-600 mb-4">
                <div className="h-6 w-6">
               <Trophy className="h-7 w-7 text-blue-600" />
                </div>
              </div>
              <h2 className="text-xl font-semibold mb-4">Our Approach</h2>
              <p className="text-sm text-muted-foreground">{aboutData.approach}</p>
            </div>
          </div>
        </section>

        {/* Team section */}
        <section className="py-12 px-4">
          <h2 className="text-2xl font-bold text-center mb-12">Our Team</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {teamData.map((member) => (
              <TeamMemberCard key={member.id} member={member} />
            ))}
          </div>
        </section>

        {/* Why Choose ChainVerse section */}
        <section className="py-12 px-4 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-12">Why Choose ChainVerse?</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-8">
                {whyChooseData.map((item) => (
                  <WhyChooseCard key={item.id} item={item} />
                ))}
              </div>
              <div className="border rounded-lg bg-white">
                <h3 className="p-6 text-xl font-semibold border-b">Frequently Asked Question</h3>
                <FaqAccordion items={faqData} />
              </div>
            </div>
          </div>
        </section>

        {/* CTA section */}
        <section className="py-16 px-4 text-center">
          <p className="text-sm text-muted-foreground mb-4">Be part of the ChainVerse Academy ecosystem</p>
          <h2 className="text-2xl font-bold mb-8">Join Our Community</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 h-auto">Explore Courses</Button>
            <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-4 h-auto">
              Join Discord Community
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t text-center text-xs text-muted-foreground">
        <p>© 2023 ChainVerse Academy. All rights reserved.</p>
        <div className="flex justify-center gap-4 mt-2">
          <Link href="#" className="hover:underline">
            Terms
          </Link>
          <Link href="#" className="hover:underline">
            Privacy
          </Link>
          <Link href="#" className="hover:underline">
            Help
          </Link>
        </div>
      </footer>
    </div>
  )
}
