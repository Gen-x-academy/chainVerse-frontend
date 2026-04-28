/**
 * #108 Refactor: Global Store Index
 * Central entry point for application-wide state management.
 */

import { create } from 'zustand';

// 1. Exporting types for Global State
export interface GlobalState {
  isSidebarOpen: boolean;
  theme: 'light' | 'dark';
  notifications: Notification[];
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export const INITIAL_STATE: GlobalState = {
  isSidebarOpen: true,
  theme: 'light',
  notifications: [],
};

export const useGlobalStore = create<GlobalState>(() => INITIAL_STATE);