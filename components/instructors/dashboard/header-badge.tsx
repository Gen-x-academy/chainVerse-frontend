import React from "react";
import Image from "next/image";
import { InstructorProps } from "@/types";

// THIS IS THE BADGE FROM THE HEADER WHICH DISPLAYS THE USER IMG, NAME AND MANIPULATED MOCK WALLET ADDRESS
const HeaderBadge = ({ instructor }: { instructor: InstructorProps }) => {
  return (
    <button className="cursor-pointer flex items-center gap-1 px-2  bg-gray-100 py-1 rounded-[3rem] sm:px-2 md:py-2 md:rounded-[6.25rem] sm:gap-3">
      <div className="flex items-center sm:gap-1">
        {" "}
        <span className="rounded-full ">
          <Image
            src={instructor.img}
            alt={instructor.name + " image"}
            width={24}
            height={24}
            className="rounded-full"
          />
        </span>
        <span className="text-xs tracking-[-0.5px] text-gray-500 hidden sm:block">
          {instructor.name}
        </span>
        {/* <span className="text-xs tracking-[-0.5px] text-gray-500 md:hidden">
          {instructor.name.split(" ")[0][0] + instructor.name.split(" ")[1][0]}
        </span> */}
      </div>
      <span className="instructor-wal-address bg-[#D9DFFC] text-primary  px-3 py-0.5 flex items-center text-[10px] gap-0.5 rounded-[3rem] md:rounded-[6.25rem]">
        <span> •</span>
        {instructor.wallletAddress.slice(0, 4) +
          "..." +
          instructor.wallletAddress.slice(
            instructor.wallletAddress.length - 4,
            instructor.wallletAddress.length
          )}
      </span>
    </button>
  );
};

export default HeaderBadge;
