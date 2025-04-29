"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Instructor } from "@/lib/types";

interface AboutProfileProps {
    instructor: Instructor;
  }
export default function AboutProfile ({ instructor }: AboutProfileProps){
    return (
        <Card className="bg-white border border-[#D9D9D9] p-5">
                <h2 className="text-xl font-semibold mb-4">About {instructor.name}</h2>
                <p className="text-gray-700 mb-6">
                  {instructor.name} has been developing on the Stellar blockchain for over 5 years and previously worked at the Stellar Development Foundation. He specializes in financial applications and cross-border payment systems.
                </p>
                <p className="text-gray-700 mb-6">
                  With a background in distributed systems and cryptography, {instructor.name} brings a wealth of practical experience to his teaching. Before joining StellarPay as their lead blockchain architect, he spent three years at the Stellar Development Foundation where he contributed to core protocol development and helped design the Stellar Consensus Protocol (SCP) improvements.
                </p>
                <p className="text-gray-700 mb-6">
                  {instructor.name} is passionate about making blockchain technology accessible to developers of all skill levels. His teaching philosophy focuses on practical, hands-on learning with real-world examples drawn from his extensive industry experience.
                </p>
                <p className="text-gray-700 mb-6">
                  When not coding or teaching, {instructor.name} contributes to open-source blockchain projects and speaks at technology conferences around the world about the future of decentralized finance and blockchain scalability solutions.
                </p>

                <h3 className="text-lg font-semibold mt-8 mb-4">Credentials</h3>
                <ul className="space-y-3">
                  <li className="flex items-center">
                    <div className="w-3 h-3 bg-[#4361EE] rounded-full mr-3"/>
                    <span>Former Developer at Stellar Development Foundation</span>
                  </li>
                  <li className="flex items-center">
                  <div className="w-3 h-3 bg-[#4361EE] rounded-full mr-3"/>
                  <span>MS in Computer Science, Stanford University</span>
                  </li>
                  <li className="flex items-center">
                  <div className="w-3 h-3 bg-[#4361EE] rounded-full mr-3"/>
                  <span>Author of 'Building on Stellar: A Developer's Guide'</span>
                  </li>
                  <li className="flex items-center">
                  <div className="w-3 h-3 bg-[#4361EE] rounded-full mr-3"/>
                  <span>Speaker at Blockchain Summit 2024</span>
                  </li>
                  <li className="flex items-center">
                  <div className="w-3 h-3 bg-[#4361EE] rounded-full mr-3"/>
                  <span>Contributor to multiple open-source blockchain projects</span>
                  </li>
                </ul>
              </Card> 
    );
}