import { Input } from "@/components/ui/input";
import React from "react";
import { Search } from "lucide-react";

const Searchbar = () => {
  return (
    <div className="flex items-center gap-1 bg-gray-200 px-2  rounded-[6.25rem] w-[20rem]">
      <Search className="text-gray-600 " />

      <Input
        type="text"
        placeholder="Search"
        className="border-none w-full pl-0 focus-visible:ring-0
      "
      />
    </div>
  );
};

export default Searchbar;
