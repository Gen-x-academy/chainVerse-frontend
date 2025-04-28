"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import Image from "next/image";
import icon from "../../public/icon.png"
import star from "../../public/star.svg"
import { FaSearch, FaFilter } from 'react-icons/fa';
const instructorsData = [
  {
    id: 1,
    name: "Alex Johnson",
    title: "Blockchain Architect at StellarPay",
    description:
      "Alex has been developing on the Stellar blockchain for over five years...",
    rating: 4.8,
    courses: 3,
    students: 4250,
    initials: "AJ",
  },
  {
    id: 2,
    name: "Maria Garcia",
    title: "Smart Contract Developer & Consultant",
    description:
      "Maria is a renowned smart contract expert who has built multiple dApps...",
    rating: 4.6,
    courses: 5,
    students: 3128,
    initials: "MG",
  },
  {
    id: 3,
    name: "David Chen",
    title: "Founder of DappWorks Labs",
    description: "David has developed Web3 applications for major companies...",
    rating: 4.9,
    courses: 4,
    students: 5680,
    initials: "DC",
  },
  {
    id: 4,
    name: "Sarah Williams",
    title: "Blockchain Security Researcher",
    description:
      "Sarah is a security researcher specializing in vulnerabilities and audits...",
    rating: 4.7,
    courses: 2,
    students: 1890,
    initials: "SW",
  },
  {
    id: 5,
    name: "Micheal Brown",
    title: "NFT Artist & Developer",
    description:
      "Michael combines his artistic background with technical skills...",
    rating: 4.5,
    courses: 3,
    students: 2340,
    initials: "MB",
  },
  {
    id: 6,
    name: "Jennifer Lee",
    title: "DeFi Protocol Designer",
    description:
      "Jennifer has designed DeFi protocols handling millions in TVL...",
    rating: 4.8,
    courses: 4,
    students: 3750,
    initials: "JL",
  },
];

export default function InstructorsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("newest");
  const [filteredInstructors, setFilteredInstructors] =
    useState(instructorsData);

  useEffect(() => {
    let result = [...instructorsData];

    if (searchTerm) {
      result = result.filter(
        (inst) =>
          inst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          inst.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filter === "highest-rated") {
      result.sort((a, b) => b.rating - a.rating);
    } else if (filter === "most-popular") {
      result.sort((a, b) => b.students - a.students);
    } else {
      result.sort((a, b) => a.id - b.id); // assuming id = newest first
    }

    setFilteredInstructors(result);
  }, [searchTerm, filter]);

  return (
    <div className="max-w-7xl mx-auto py-10 px-4">
      <div className="mb-8">
        <h2 className="font-bold">Our Instructors</h2>
        <p>Learn from the best blockchain experts in the industry</p>
      </div>

    

<div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
  {/* Search Input with Search Icon */}
  <div className="relative w-full md:max-w-sm">
    <Input
      placeholder="Search courses..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="w-full pl-10"  
    />
    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600" />
  </div>

  {/* Select Input with Filter Icon */}
  <div className="relative w-48">
    <Select value={filter} onValueChange={(val) => setFilter(val)}>
      <SelectTrigger className="w-full pl-10"> 
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="newest">Newest</SelectItem>
        <SelectItem value="highest-rated">Highest Rated</SelectItem>
        <SelectItem value="most-popular">Most Popular</SelectItem>
      </SelectContent>
    </Select>
    <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600" />
  </div>
</div>


      {filteredInstructors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInstructors.map((instructor) => (
            <Card key={instructor.id}>
              <CardContent className="p-6">
                <div className="flex items-center mb-4">
                  <div
                    className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center font-semibold text-lg mr-4"
                    style={{
                      backgroundColor: "#80A5F566",
                      backgroundBlendMode: "overlay",
                    }}
                  >
                    {instructor.initials}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{instructor.name}</h3>
                    <p className="text-sm text-gray-500">{instructor.title}</p>
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  {instructor.description.substring(0, 100)}...
                </p>
                <div className="flex items-center text-sm text-gray-700 mb-4 justify-center">
                  <Star className="h-4 w-4 text-yellow-500 mr-1" />

                  <span className="ml-1">{instructor.rating}</span>

                  <span className="mx-5">{instructor.courses} Courses</span>

                  <span className="mx-5">
                    {instructor.students.toLocaleString()} Students
                  </span>
                </div>
                <Button variant="outline" className="mt-2 w-full">
                  View Profile
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <h2 className="text-2xl font-semibold mb-4">No instructors found</h2>
          <p className="text-gray-500">
            Try adjusting your search or filter settings.
          </p>
        </div>
      )}
      <div className="mt-10 text-center">
        <div className="flex justify-between">
          <h2 className="text-xl font-semibold mb-4">Become an Instructor</h2>
          <Button
            className="mt-4  text-white"
            variant="secondary"
            style={{
              backgroundImage: "linear-gradient(45deg, #4361EE, #A855F7)",
            }}
          >
            Apply to Teach
          </Button>
        </div>

        <p className="text-gray-600 text-base leading-relaxed break-words text-start">
          Join our growing community of blockchain educators and share your
          <br />
          expertise with students around the world. ChainVerse Academy
          <br />
          instructors earn XLM through course purchases and receive ongoing
          royalties.
        </p>
      </div>

      <div className="flex items-center mt-6 space-x-8 gap-10 ">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center mb-4 p-5">
          <Image src={star} alt="" className="h-4 w-4 text-yellow-500 mr-1 rounded-full bg-gray-200" />
            <p className="text-gray-600 text-base">Build Your Reputation</p>
          </div>
          <p className="text-gray-600 text-sm">
          Establish yourself as a thought leader
          </p>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center mb-4 p-5 ">
            <Image src={icon} alt="" className="h-4 w-4 text-yellow-500 mr-1 rounded-full bg-gray-200" />
            <p className="text-gray-600 text-base">Earn Crypto</p>
          </div>
          <p className="text-gray-600 text-sm">
          Get paid in XLM for your courses
          </p>
        </div>
      </div>
      <footer className="mt-10  border-t border-gray-300 py-4 justify-between">
        <div className="justify-between flex ">
          <p className="text-gray-600">© 2025 ChainVerse Academy. All rights reserved.</p>
          <span className="text-gray-500">Terms</span>
          <span className="text-gray-500">Privacy</span>
          <span className="text-gray-500">FAQ</span>
        </div>
      </footer>

    </div>
  );
}
