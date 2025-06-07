"use client"; // Add this directive at the top

import * as React from "react";
import HeroSection from "@/components/HeroSection";
import FeaturedCourses from "@/components/FeaturedCourses";
import KeyFeatures from "@/components/KeyFeatures";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="container mx-auto">
      <HeroSection />
      <KeyFeatures />
      <FeaturedCourses />
      <Footer />
    </div>
  );
}
