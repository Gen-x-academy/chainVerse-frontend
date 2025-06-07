import { StudentWalletData } from "../types";

export const walletData: StudentWalletData = {
  walletBalance: {
    xlmBalance: 250,
    totalSpent: 175,
    pendingRewards: 15,
    walletAddress: "StellaRtfsv56fvjksIGFgf88yd9&x8j2",
    explorerLink: "View on Explorer"
  },

  transactions: [
    {
      date: "Mar 15, 2025",
      description: "Course Purchase: DeFi on Stellar",
      amount: -75,
      currency: "XLM",
      status: "Completed",
      transactionId: "3a7ead94...",
      explorerIcon: true
    },
    {
      date: "Mar 20, 2025",
      description: "Course Purchase: Web3 Development Masterclass",
      amount: -50,
      currency: "XLM",
      status: "Completed",
      transactionId: "2b6f9c85...",
      explorerIcon: true
    },
    {
      date: "Mar 5, 2025",
      description: "Course Purchase: Smart Contracts with Soroban",
      amount: -50,
      currency: "XLM",
      status: "Completed",
      transactionId: "1c5e8b74...",
      explorerIcon: true
    },
    {
      date: "Feb 20, 2025",
      description: "Wallet Deposit",
      amount: 200,
      currency: "XLM",
      status: "Completed",
      transactionId: "9d8c7b6a...",
      explorerIcon: true
    },
    {
      date: "Feb 15, 2025",
      description: "Course Purchase: Stellar Blockchain Fundamentals",
      amount: -25,
      currency: "XLM",
      status: "Completed",
      transactionId: "8e7dc65e...",
      explorerIcon: true
    },
    {
      date: "Feb 10, 2025",
      description: "Wallet Deposit",
      amount: 100,
      currency: "XLM",
      status: "Completed",
      transactionId: "7f6e5d4c...",
      explorerIcon: true
    }
  ]
};
