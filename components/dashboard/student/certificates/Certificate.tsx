import React from "react";
import { StellerIcon } from "@/lib/mock-data/studentCertificate";
import { BookIcon } from "@/lib/mock-data/studentCertificate";
import { SendIcon } from "@/lib/mock-data/studentCertificate";
import { StudentProps } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { DownLoadIcon } from "@/lib/mock-data/studentCertificate";
import { ShareIcon } from "@/lib/mock-data/studentCertificate";

const Certificate = ({ student }: { student: StudentProps }) => {
  return (
    <div className="border border-[#D9D9D9]  max-w-[500px] rounded-[10px]">
      <div className="flex gap-2 px-2 items-center pt-8 pb-2 bg-[#D9D9D926] pl-6">
        {StellerIcon} <h6 className="font-bold">{student.courseTitle}</h6>
      </div>
      <div className="bg-[#D9D9D952] py-2 grid gap-5 place-content-center">
        <div className="text-center">
          <h4 className=" text-[1.3rem] md:text-[1.5rem] font-semibold">
            Certificate of Completion
          </h4>
          <p className="text-[#808080] text-[13px]">This certifies that</p>
          <p className="py-2 text-[1.3rem] md:text-[1.5rem] font-semibold">
            {student.name}
          </p>
          <p className="text-[#808080] text-[13px]">
            Has successfully completed
          </p>
          <h6 className="font-bold py-1">{student.courseTitle}</h6>
          <p className="text-[#808080] text-[13px]">Issued on {student.date}</p>
        </div>

        <div className="bg-[#80A5F566] rounded-full grid place-items-center h-[5rem] aspect-square mx-auto">
          {" "}
          {BookIcon}
        </div>
      </div>

      <div className="py-4 px-6 grid gap-1">
        <div className="flex justify-between">
          <span className="text-[#808080] text-[14px]">Issued:</span>
          <span className=" text-[14px] md:text-base">{student.date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#808080] text-[14px]">Blockchain:</span>
          <span className="text-base">{student.blockchain}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#808080] text-[14px]">TransactionId</span>
          <button className="text-[15px] text-[#4361EE] flex cursor-pointer hover:text-[14.9px] hover:underline transition-all ease-in-out duration-500">
            {student.transactionId.slice(0, 8)}...{" "}
            <span className="hover:h-3.5">{SendIcon}</span>
          </button>
        </div>
      </div>

      <div className="flex justify-between px-4 md:px-16 pt-6 pb-10 border border-b-0 border-t-[#D9D9D9]">
        <Button className="bg-[#D9D9D94D] border border-[#808080] hover:bg-[#D9D9D99f] hover:border-[#000000] transition-all ease-in-out duration-300 text-black">
          {DownLoadIcon} Download
        </Button>
        <Button className="bg-[#D9D9D94D] border border-[#808080] hover:bg-[#D9D9D99f] hover:border-[#000000] transition-all ease-in-out duration-300 text-black">
          {ShareIcon} Share
        </Button>
      </div>
    </div>
  );
};

export default Certificate;
