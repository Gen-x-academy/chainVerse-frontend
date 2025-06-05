"use client"; // Add this directive at the top

import * as React from "react";
import HeroSection from "@/components/HeroSection";
import FeaturedCourses from "@/components/FeaturedCourses";
import KeyFeatures from "@/components/KeyFeatures";
import Footer from "@/components/Footer";
import NavBar from "@/components/NavBar";

export default function Home() {
  return (
    <div className="container mx-auto">
      <NavBar />
      <div className="px-4 sm:px-8 lg:px-10">
        <HeroSection />
        <KeyFeatures />
        <FeaturedCourses />
      </div>
      <Footer />
    </div>
  );
}
