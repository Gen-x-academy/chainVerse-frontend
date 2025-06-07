"use client";
import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { walletData } from "@/lib/mock-data/transaction";
import { ExternalLink } from "lucide-react";
import { StudentTransaction } from "@/lib/types";

const TransactionHistoryTable = ({
  transactions
}: {
  transactions: StudentTransaction[];
}) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[#71717A] font-medium py-4">
              Date
            </TableHead>
            <TableHead className="text-[#71717A] font-medium py-4">
              Description
            </TableHead>
            <TableHead className="text-[#71717A] font-medium py-4">
              Amount
            </TableHead>
            <TableHead className="text-[#71717A] font-medium py-4">
              Status
            </TableHead>
            <TableHead className="text-[#71717A] font-medium py-4">
              Transaction ID
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction, index) => (
            <TableRow key={index}>
              <TableCell>{transaction.date}</TableCell>

              <TableCell className="font-medium">
                {transaction.description}
              </TableCell>
              <TableCell>
                <span
                  className={`${
                    transaction.amount < 0 ? "text-red-500" : "text-[#086D23]"
                  }`}
                >
                  {transaction.amount} XML
                </span>
              </TableCell>
              <TableCell>
                <span
                  className={`px-0.5 py-0.5 rounded-[10px] max-w-[5.5rem] text-xs flex justify-center items-center text-center  ${
                    transaction.status === "Completed"
                      ? "bg-[#BAFDCC] border border-[#4169E166] text-[#086D23]"
                      : transaction.status === "Pending"
                      ? "bg-amber-100 border border-amber-300 text-amber-300"
                      : "bg-red-300 border border-red-500 text-red-500"
                  }`}
                >
                  {transaction.status}
                </span>
              </TableCell>
              <TableCell className="flex items-center justify-start text-[13px] gap-2">
                <span> {transaction.transactionId.slice(0, 8) + "..."}</span>
                <button className="cursor-pointer">
                  <ExternalLink className="h-4 w-4" />
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TransactionHistoryTable;
