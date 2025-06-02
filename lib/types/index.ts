// Define the Instructor type interface first
// File: types/index.ts
export interface Instructor {
    id: number;
    name: string;
    title: string;
    description: string;
    rating: number;
    courses: number;
    students: number;
    initials: string;
    reviews?: number;
  }

export interface NotificationData {
    preferences: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    notifications: Array<{
      id: string;
      title: string;
      message: string;
      time: string;
      read: boolean;
      type: 'info' | 'warning' | 'success';
    }>;
  }

  export interface WalletData {
    balance: number;
    currency: string;
    cards: Array<{
      id: string;
      type: string;
      last4: string;
      expiry: string;
    }>;
    transactions: Array<{
      id: string;
      amount: number;
      description: string;
      date: string;
      type: 'credit' | 'debit';
    }>;
  }

 export interface UserData {
  name: string;
  email: string;
  phone: string;
  bio: string;
  avatar: string;
  role:string,
  memberSince:string,
   coursesCompleted: number,
    certificatesEarned: number,
    walletConnected: boolean

}

  