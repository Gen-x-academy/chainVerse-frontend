import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Instructor } from "@/lib/types";

interface CoursesProfileProps {
  instructor: Instructor;
}
export default function CoursesProfile({ instructor }: CoursesProfileProps) {
    return (
        <div>
        <h2 className="text-xl font-semibold mb-6">Courses by {instructor.name}</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white border border-[#D9D9D9]">
            <CardContent className="p-4">
              <div className="mb-2 text-xs text-black font-medium">Smart Contracts</div>
              <h3 className="text-lg font-semibold mb-2">Smart Contracts with Soroban</h3>
              <p className="text-gray-600 mb-4 text-sm">
                Master Stellar's smart contract platform Soroban and build decentralized applications.
              </p>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="text-xs text-gray-500">Instructor:</div>
                  <div className="font-medium">{instructor.name}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Level:</div>
                  <div className="font-medium">Intermediate</div>
                </div>
              </div>
              <div className="flex justify-between items-center mb-4">
                <div >
                  <div className="text-xs text-gray-500">Price:</div>
                  <div className="font-bold text-[#4361EE]">250 XLM</div>
                </div>
              </div>
              <Button 
  className="w-full text-white border border-[#4361EE]"
  style={{
    background: 'linear-gradient(90deg, #4361EE 27.4%, #5A77FF 44.71%, #936FFA 83.17%, #A879FF 91.35%, #C48BFC 100%)'
  }}
>
  Enroll Now
</Button>
            </CardContent>
          </Card>

          <Card className="bg-white border border-[#D9D9D9]">
            <CardContent className="p-5">
              <div className="mb-2 text-xs text-black font-medium">Smart Contracts</div>
              <h3 className="text-lg font-semibold mb-2">Smart Contracts Security</h3>
              <p className="text-gray-600 mb-4 text-sm">
                Learn to identify and prevent common vulnerabilities in blockchain applications.
              </p>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="text-xs text-gray-500">Instructor:</div>
                  <div className="font-medium">{instructor.name}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Level:</div>
                  <div className="font-medium">Intermediate</div>
                </div>
              </div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="text-xs text-gray-500">Price:</div>
                  <div className="font-bold text-[#4361EE]">300 XLM</div>
                </div>
              </div>
              <Button 
  className="w-full text-white border border-[#4361EE]"
  style={{
    background: 'linear-gradient(90deg, #4361EE 27.4%, #5A77FF 44.71%, #936FFA 83.17%, #A879FF 91.35%, #C48BFC 100%)'
  }}
>
  Enroll Now
</Button>
            </CardContent>
          </Card>

          <Card className="bg-white border border-[#D9D9D9]">
            <CardContent className="p-5">
              <div className="mb-2 text-xs text-black font-medium">Smart Contracts</div>
              <h3 className="text-lg font-semibold mb-2">DeFi Protocol Development</h3>
              <p className="text-gray-600 mb-4 text-sm">
                Build decentralized finance applications from scratch on Stellar.
              </p>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="text-xs text-gray-500">Instructor:</div>
                  <div className="font-medium">{instructor.name}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Level:</div>
                  <div className="font-medium">Intermediate</div>
                </div>
              </div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="text-xs text-gray-500">Price:</div>
                  <div className="font-bold text-[#4361EE]">350 XLM</div>
                </div>
              </div>
              
              <Button 
  className="w-full text-white border border-[#4361EE]"
  style={{
    background: 'linear-gradient(90deg, #4361EE 27.4%, #5A77FF 44.71%, #936FFA 83.17%, #A879FF 91.35%, #C48BFC 100%)'
  }}
>
  Enroll Now
</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
}