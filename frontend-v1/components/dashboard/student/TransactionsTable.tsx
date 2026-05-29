"use client";

import { useState, useMemo } from "react";
import {
  ExternalLink,
  Search,
  Download,
  Wallet,
  TrendingDown,
  Clock,
  Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionStatus = "Completed" | "Pending" | "Failed";

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: TransactionStatus;
  txId: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const WALLET_ADDRESS = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const STELLAR_EXPLORER_BASE = "https://stellar.expert/explorer/public/account/";

const mockTransactions: Transaction[] = [
  {
    id: "1",
    date: "2026-05-25",
    description: "Smart Contracts with Soroban – Course Purchase",
    amount: "-120 XLM",
    status: "Completed",
    txId: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  },
  {
    id: "2",
    date: "2026-05-20",
    description: "Web3 Development Masterclass – Course Purchase",
    amount: "-95 XLM",
    status: "Completed",
    txId: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
  },
  {
    id: "3",
    date: "2026-05-15",
    description: "Wallet Deposit",
    amount: "+500 XLM",
    status: "Completed",
    txId: "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  },
  {
    id: "4",
    date: "2026-05-10",
    description: "DeFi on Stellar – Course Purchase",
    amount: "-75 XLM",
    status: "Completed",
    txId: "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
  },
  {
    id: "5",
    date: "2026-05-08",
    description: "Stellar Blockchain Fundamentals – Course Purchase",
    amount: "-60 XLM",
    status: "Completed",
    txId: "e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
  },
  {
    id: "6",
    date: "2026-05-01",
    description: "Pending Reward – Course Completion Bonus",
    amount: "+10 XLM",
    status: "Pending",
    txId: "f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1",
  },
  {
    id: "7",
    date: "2026-04-28",
    description: "NFT Certificate Mint – Stellar Fundamentals",
    amount: "-2 XLM",
    status: "Completed",
    txId: "a7b8c9d0e1f2a7b8c9d0e1f2a7b8c9d0e1f2a7b8c9d0e1f2a7b8c9d0e1f2a7b8",
  },
  {
    id: "8",
    date: "2026-04-20",
    description: "Wallet Deposit",
    amount: "+200 XLM",
    status: "Completed",
    txId: "b8c9d0e1f2a7b8c9d0e1f2a7b8c9d0e1f2a7b8c9d0e1f2a7b8c9d0e1f2a7b8c9",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusVariant: Record<TransactionStatus, "default" | "secondary" | "destructive"> = {
  Completed: "default",
  Pending: "secondary",
  Failed: "destructive",
};

const statusClass: Record<TransactionStatus, string> = {
  Completed: "bg-green-100 text-green-700 hover:bg-green-100",
  Pending: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  Failed: "bg-red-100 text-red-700 hover:bg-red-100",
};

function shortTxId(txId: string) {
  return `${txId.slice(0, 8)}...${txId.slice(-6)}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Wallet Summary ───────────────────────────────────────────────────────────

function WalletSummary() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(WALLET_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const summaryCards = [
    {
      title: "XLM Balance",
      value: "250 XLM",
      sub: "≈ $50.00 USD",
      icon: Wallet,
      iconClass: "text-blue-600",
      bgClass: "bg-blue-50",
    },
    {
      title: "Total Spent",
      value: "352 XLM",
      sub: "≈ $70.40 USD",
      icon: TrendingDown,
      iconClass: "text-red-500",
      bgClass: "bg-red-50",
    },
    {
      title: "Pending Rewards",
      value: "10 XLM",
      sub: "≈ $2.00 USD",
      icon: Clock,
      iconClass: "text-yellow-600",
      bgClass: "bg-yellow-50",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="bg-white border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bgClass}`}>
                  <Icon className={`h-4 w-4 ${card.iconClass}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Wallet Address */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-medium text-gray-600 shrink-0">
              Wallet Address:
            </span>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <code className="text-xs text-gray-800 bg-gray-100 px-2 py-1 rounded truncate flex-1">
                {WALLET_ADDRESS}
              </code>
              <button
                onClick={handleCopy}
                className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Copy wallet address"
              >
                <Copy className="h-4 w-4" />
              </button>
              {copied && (
                <span className="text-xs text-green-600 shrink-0">Copied!</span>
              )}
              <a
                href={`${STELLAR_EXPLORER_BASE}${WALLET_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                View on Explorer
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TransactionsTable() {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest" | "highest" | "lowest">("recent");

  const filtered = useMemo((): Transaction[] => {
    let data: Transaction[] = mockTransactions.filter((tx: Transaction) =>
      tx.description.toLowerCase().includes(search.toLowerCase())
    );

    switch (sortOrder) {
      case "recent":
        data = [...data].sort((a: Transaction, b: Transaction) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      case "oldest":
        data = [...data].sort((a: Transaction, b: Transaction) => new Date(a.date).getTime() - new Date(b.date).getTime());
        break;
      case "highest":
        data = [...data].sort(
          (a: Transaction, b: Transaction) => Math.abs(parseFloat(b.amount)) - Math.abs(parseFloat(a.amount))
        );
        break;
      case "lowest":
        data = [...data].sort(
          (a: Transaction, b: Transaction) => Math.abs(parseFloat(a.amount)) - Math.abs(parseFloat(b.amount))
        );
        break;
    }

    return data;
  }, [search, sortOrder]);

  const handleExportCSV = () => {
    const headers = ["Date", "Description", "Amount", "Status", "Transaction ID"];
    const rows = filtered.map((tx: Transaction) => [
      formatDate(tx.date),
      `"${tx.description}"`,
      tx.amount,
      tx.status,
      tx.txId,
    ]);
    const csv = [headers.join(","), ...rows.map((r: string[]) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(filtered, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b bg-white px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-900 ml-12 md:ml-0">
          Transaction History
        </h1>
      </header>

      <main className="flex-1 bg-gray-50 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Wallet Summary */}
          <WalletSummary />

          {/* Transactions Card */}
          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Transactions
                </CardTitle>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search transactions..."
                      value={search}
                      onChange={(e: { target: { value: string } }) => setSearch(e.target.value)}
                      className="pl-9 w-full sm:w-56"
                    />
                  </div>

                  {/* Sort */}
                  <Select
                    value={sortOrder}
                    onValueChange={(v: string) => setSortOrder(v as typeof sortOrder)}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Most Recent</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="highest">Highest Amount</SelectItem>
                      <SelectItem value="lowest">Lowest Amount</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Export */}
                  <Select onValueChange={(v: string) => v === "csv" ? handleExportCSV() : handleExportJSON()}>
                    <SelectTrigger className="w-full sm:w-36">
                      <Download className="h-4 w-4 mr-2 text-gray-500" />
                      <SelectValue placeholder="Export" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">Export CSV</SelectItem>
                      <SelectItem value="json">Export JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-b bg-gray-50 text-left">
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transaction ID
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          No transactions found.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((tx: Transaction) => (
                        <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                            {formatDate(tx.date)}
                          </td>
                          <td className="px-6 py-4 text-gray-900 max-w-xs">
                            {tx.description}
                          </td>
                          <td
                            className={`px-6 py-4 font-medium whitespace-nowrap ${
                              tx.amount.startsWith("+")
                                ? "text-green-600"
                                : "text-red-500"
                            }`}
                          >
                            {tx.amount}
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={statusVariant[tx.status]}
                              className={statusClass[tx.status]}
                            >
                              {tx.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <a
                              href={`https://stellar.expert/explorer/public/tx/${tx.txId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-mono text-xs"
                            >
                              {shortTxId(tx.txId)}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <p className="px-6 py-12 text-center text-gray-500">
                    No transactions found.
                  </p>
                ) : (
                  filtered.map((tx: Transaction) => (
                    <div key={tx.id} className="px-4 py-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 flex-1">
                          {tx.description}
                        </p>
                        <span
                          className={`text-sm font-semibold whitespace-nowrap ${
                            tx.amount.startsWith("+") ? "text-green-600" : "text-red-500"
                          }`}
                        >
                          {tx.amount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{formatDate(tx.date)}</span>
                        <Badge
                          variant={statusVariant[tx.status]}
                          className={statusClass[tx.status]}
                        >
                          {tx.status}
                        </Badge>
                      </div>
                      <a
                        href={`https://stellar.expert/explorer/public/tx/${tx.txId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-mono text-xs"
                      >
                        {shortTxId(tx.txId)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
