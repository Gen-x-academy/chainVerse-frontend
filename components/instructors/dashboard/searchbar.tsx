import { Input } from "@/components/ui/input";
import React from "react";
import { Search } from "lucide-react";

const Searchbar = () => {
  return (
    <div className="flex items-center gap-1 bg-gray-200 px-1  sm:px-2 rounded-[6.25rem] w-[8rem] sm:w-[20rem]">
      <Search className="text-gray-600 w-5 h-5 " />

      <Input
        type="text"
        placeholder="Search"
        className="border-none w-full pl-0 focus-visible:ring-0 text-[13px] p-1 sm:text-[15px]"
      />
    </div>
  );
};

export default Searchbar;
