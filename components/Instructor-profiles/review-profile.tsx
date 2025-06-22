'use client';

import { Card } from '@/components/ui/card';
import { Star } from 'lucide-react';
import { Instructor } from '@/types';

interface ReviewProfileProps {
  instructor: Instructor;
}

export default function ReviewProfile({ instructor }: ReviewProfileProps) {
  return (
    <Card className="rounded-[10px] p-6 bg-white border border-[#D9D9D9]">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Students Reviews</h2>
        <p className="text-sm text-[#808080]">
          387 reviews . 4.8 average rating
        </p>
      </div>
      <div className="flex flex-col md:flex-row gap-8">
        {' '}
        {/* Responsive flex container */}
        {/* Rating Figure */}
        <div className="flex flex-col items-center md:items-start mb-4 flex-shrink-0">
          <div className="items-center mb-2">
            <p className="text-3xl font-bold mr-3">4.8</p>
            <div className="flex items-center">
              <Star className="h-5 w-5 text-yellow-500 fill-current" />
              <Star className="h-5 w-5 text-yellow-500 fill-current" />
              <Star className="h-5 w-5 text-yellow-500 fill-current" />
              <Star className="h-5 w-5 text-yellow-500 fill-current" />
              <Star className="h-5 w-5 text-gray-300 fill-current" />
            </div>
          </div>
          <p className="text-black text-sm md:text-base">Course Rating</p>
        </div>
        {/* Rating Distribution */}
        <div className="flex-1 min-w-0">
          <div className="mb-8 w-full">
            <div className="flex items-center mb-1">
              <span className="w-6 text-right mr-2">5</span>
              <div className="flex-grow h-4 bg-gray-200 rounded-full overflow-hidden min-w-[100px]">
                <div
                  className="h-full bg-[#A855F7]"
                  style={{ width: '75%' }}
                ></div>
              </div>
              <span className="ml-2 text-sm text-gray-500 w-10 text-right">
                75%
              </span>
            </div>
            <div className="flex items-center mb-1">
              <span className="w-6 text-right mr-2">4</span>
              <div className="flex-grow h-4 bg-gray-200 rounded-full overflow-hidden min-w-[100px]">
                <div
                  className="h-full bg-purple-500"
                  style={{ width: '20%' }}
                ></div>
              </div>
              <span className="ml-2 text-sm text-gray-500 w-10 text-right">
                20%
              </span>
            </div>
            <div className="flex items-center mb-1">
              <span className="w-6 text-right mr-2">3</span>
              <div className="flex-grow h-4 bg-gray-200 rounded-full overflow-hidden min-w-[100px]">
                <div
                  className="h-full bg-purple-500"
                  style={{ width: '5%' }}
                ></div>
              </div>
              <span className="ml-2 text-sm text-gray-500 w-10 text-right">
                5%
              </span>
            </div>
            <div className="flex items-center mb-1">
              <span className="w-6 text-right mr-2">2</span>
              <div className="flex-grow h-4 bg-gray-200 rounded-full overflow-hidden min-w-[100px]">
                <div
                  className="h-full bg-purple-500"
                  style={{ width: '0%' }}
                ></div>
              </div>
              <span className="ml-2 text-sm text-gray-500 w-10 text-right">
                0%
              </span>
            </div>
            <div className="flex items-center mb-1">
              <span className="w-6 text-right mr-2">1</span>
              <div className="flex-grow h-4 bg-gray-200 rounded-full overflow-hidden min-w-[100px]">
                <div
                  className="h-full bg-purple-500"
                  style={{ width: '0%' }}
                ></div>
              </div>
              <span className="ml-2 text-sm text-gray-500 w-10 text-right">
                0%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Student reviews */}
      <div className="space-y-6">
        <div className="border-b border-t p-5">
          <div className="flex justify-between mb-2">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-semibold text-xs mr-3">
                SW
              </div>
              <span className="font-medium">Sarah Williams</span>
            </div>
          </div>
          <div className="flex items-center">
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
          </div>
          <p className="text-[#000000] text-sm font-bold">
            This course was incredibly helpful in getting me up to speed with
            Stellar blockchain concepts. The instructor explains complex topics
            in an accessible way, and the exercises really helped solidify my
            understanding.
          </p>
          <div className="mt-3 text-xs text-gray-500">
            3 months ago · Smart Contracts with Soroban
          </div>
        </div>

        <div className="border-b p-5">
          <div className="flex justify-between mb-2">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center font-semibold text-xs mr-3">
                JC
              </div>
              <span className="font-medium">James Chen</span>
            </div>
          </div>
          <div className="flex items-center">
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <Star className="h-4 w-4 text-gray-300" />
          </div>
          <p className="text-[#000000] text-sm font-bold">
            Very comprehensive coverage of the Stellar ecosystem. Some of the
            later modules were a bit challenging, but overall this was exactly
            what I needed to start building on Stellar.
          </p>
          <div className="mt-3 text-xs text-gray-500">
            1 month ago · Smart Contracts Security
          </div>
        </div>

        <div className="border-b p-5">
          <div className="flex justify-between mb-2">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center font-semibold text-xs mr-3">
                PP
              </div>
              <span className="font-medium">Priya Patel</span>
            </div>
          </div>
          <div className="flex items-center">
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
          </div>
          <p className="text-[#000000] font-bold text-sm">
            The best blockchain course I've taken so far. Loved the hands-on
            approach and the NFT certificate at the end was a nice touch!
          </p>
          <div className="mt-3 text-xs text-gray-500">
            2 months ago · DeFi Protocol Development
          </div>
        </div>
      </div>
    </Card>
  );
}
