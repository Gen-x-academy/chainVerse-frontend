"use client"

     import * as React from "react"
     import {
       DropdownMenu,
       DropdownMenuContent,
       DropdownMenuItem,
       DropdownMenuLabel,
       DropdownMenuRadioGroup,
       DropdownMenuRadioItem,
       DropdownMenuSeparator,
       DropdownMenuTrigger,
     } from "@/components/ui/dropdown-menu"
     import { Button } from "@/components/ui/button"
     import { ChevronDown, Menu } from "lucide-react"

     interface Course {
       id: string
       title: string
       price: number
       rating: number
       createdAt: Date
     }

     interface CourseSortDropdownProps {
       courses: Course[]
       onSortChange: (sortedCourses: Course[]) => void
     }

     interface SortOption {
       value: string
       label: string
     }

     export function CourseSortDropdown({ courses, onSortChange }: CourseSortDropdownProps) {
       const [sortBy, setSortBy] = React.useState<string>("newest")

       const sortOptions: SortOption[] = [
         { value: "newest", label: "Newest" },
         { value: "price-low", label: "Price: Low to High" },
         { value: "price-high", label: "Price: High to Low" },
         { value: "rating", label: "Rating" },
       ]

       const handleSortChange = (newSortBy: string) => {
         setSortBy(newSortBy)

         if (courses.length === 0) {
           onSortChange([])
           return
         }

         const sortedCourses = [...courses].sort((a, b) => {
           switch (newSortBy) {
             case "newest":
               return b.createdAt.getTime() - a.createdAt.getTime()
             case "price-low":
               return a.price - b.price
             case "price-high":
               return b.price - a.price
             case "rating":
               return b.rating - a.rating
             default:
               return 0
           }
         })
         onSortChange(sortedCourses)
       }

       return (
         <DropdownMenu>
           <DropdownMenuTrigger asChild>
             <Button
               variant="outline"
               className="flex items-center gap-14 mt-8 border-2 z-50 group focus:outline-none outline-none  border-[#246be6] rounded-lg px-4 py-2 text-black bg-transparent focus:border-[#246be6]"
             >
             <div className="flex items-center" >
              <svg
              className="h-5 w-5 group-hover:fill-white transition ease-in-out"
               xmlns="http://www.w3.org/2000/svg" height="44px" viewBox="0 -960 960 960" width="24px" fill="black">
              <path d="M440-800v487L216-537l-56 57 320 320 320-320-56-57-224 224v-487h-80Z"/>
              </svg>
              <svg 
              className="h-5 w-5 group-hover:fill-white transition ease-in-out"
              xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="black">
              <path d="M120-240v-80h240v80H120Zm0-200v-80h480v80H120Zm0-200v-80h720v80H120Z"/>
              </svg>
                    
                    
              </div>
               <span className="font-medium">
                 {sortOptions.find(opt => opt.value === sortBy)?.label}
               </span>
               <ChevronDown className="h-5 w-5" />
             </Button>
           </DropdownMenuTrigger>
           <DropdownMenuContent className="w-56 bg-white" align="end">
             <DropdownMenuLabel>Sort Courses</DropdownMenuLabel>
             <DropdownMenuSeparator />
             <DropdownMenuRadioGroup value={sortBy} onValueChange={handleSortChange}>
               {sortOptions.map(option => (
                 <DropdownMenuRadioItem key={option.value} value={option.value}>
                   {option.label}
                 </DropdownMenuRadioItem>
               ))}
             </DropdownMenuRadioGroup>
           </DropdownMenuContent>
         </DropdownMenu>
       )
     }


