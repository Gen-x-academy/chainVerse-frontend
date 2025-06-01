import React from "react";
import Image from "next/image";
import { InstructorProps } from "@/types";

// THIS IS THE BADGE FROM THE HEADER WHICH DISPLAYS THE USER IMG, NAME AND MANIPULATED MOCK WALLET ADDRESS
const HeaderBadge = ({ instructor }: { instructor: InstructorProps }) => {
  return (
    <button className="cursor-pointer flex items-center gap-3 bg-gray-100 py-2 sm:px-2 rounded-[6.25rem]">
      <div className="flex items-center gap-1">
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
        <span className="text-xs tracking-[-0.5px] text-gray-500 ">
          {instructor.name}
        </span>
      </div>
      <span className="instructor-wal-address bg-[#D9DFFC] rounded-[6.25rem] px-3 py-0.5 flex items-center text-[10px] gap-0.5">
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
