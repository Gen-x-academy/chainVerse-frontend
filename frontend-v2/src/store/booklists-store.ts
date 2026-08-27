import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BookListItem {
  id: string;
  title: string;
  author: string;
  coverImage?: string;
  addedAt: number;
}

export interface BookList {
  id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  shareId?: string;
  items: BookListItem[];
  createdAt: number;
  updatedAt: number;
}

interface BookListsState {
  lists: BookList[];
  isLoading: boolean;
  error: string | null;
  
  // CRUD operations
  createList: (name: string) => Promise<BookList>;
  renameList: (listId: string, newName: string) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  
  // Item operations
  addBookToList: (listId: string, book: Omit<BookListItem, 'id' | 'addedAt'>) => Promise<void>;
  removeBookFromList: (listId: string, bookId: string) => Promise<void>;
  reorderBooks: (listId: string, fromIndex: number, toIndex: number) => Promise<void>;
  
  // Privacy & sharing
  togglePrivacy: (listId: string) => Promise<void>;
  generateShareLink: (listId: string) => Promise<string>;
  
  // Utility
  getList: (listId: string) => BookList | undefined;
  clearError: () => void;
}

// Simulate API delay for optimistic updates
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useBookListsStore = create<BookListsState>()(
  persist(
    (set, get) => ({
      lists: [],
      isLoading: false,
      error: null,

      createList: async (name: string) => {
        set({ isLoading: true, error: null });
        const previousLists = [...get().lists];
        
        const newList: BookList = {
          id: `list-${Date.now()}`,
          name,
          isPrivate: true,
          items: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // Optimistic update
        set({ lists: [...previousLists, newList] });

        try {
          // Simulate API call
          await delay(800);
          return newList;
        } catch (err) {
          // Rollback on failure
          set({ lists: previousLists, error: 'Failed to create list. Please try again.' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      renameList: async (listId: string, newName: string) => {
        set({ isLoading: true, error: null });
        const previousLists = [...get().lists];
        
        // Optimistic update
        set({
          lists: get().lists.map(list =>
            list.id === listId ? { ...list, name: newName, updatedAt: Date.now() } : list
          )
        });

        try {
          await delay(600);
        } catch (err) {
          set({ lists: previousLists, error: 'Failed to rename list. Please try again.' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      deleteList: async (listId: string) => {
        set({ isLoading: true, error: null });
        const previousLists = [...get().lists];
        
        // Optimistic update
        set({ lists: get().lists.filter(list => list.id !== listId) });

        try {
          await delay(600);
        } catch (err) {
          set({ lists: previousLists, error: 'Failed to delete list. Please try again.' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      addBookToList: async (listId: string, book: Omit<BookListItem, 'id' | 'addedAt'>) => {
        set({ isLoading: true, error: null });
        const previousLists = [...get().lists];
        const list = get().lists.find(l => l.id === listId);
        
        if (!list) {
          set({ error: 'List not found' });
          throw new Error('List not found');
        }

        // Check for duplicates
        const duplicate = list.items.find(item => item.title === book.title && item.author === book.author);
        if (duplicate) {
          set({ error: 'This book is already in the list' });
          throw new Error('Book already exists in list');
        }

        const newBook: BookListItem = {
          ...book,
          id: `book-${Date.now()}`,
          addedAt: Date.now(),
        };

        // Optimistic update
        set({
          lists: get().lists.map(list =>
            list.id === listId
              ? { ...list, items: [...list.items, newBook], updatedAt: Date.now() }
              : list
          )
        });

        try {
          await delay(500);
        } catch (err) {
          set({ lists: previousLists, error: 'Failed to add book. Please try again.' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      removeBookFromList: async (listId: string, bookId: string) => {
        set({ isLoading: true, error: null });
        const previousLists = [...get().lists];
        
        // Optimistic update
        set({
          lists: get().lists.map(list =>
            list.id === listId
              ? { ...list, items: list.items.filter(item => item.id !== bookId), updatedAt: Date.now() }
              : list
          )
        });

        try {
          await delay(500);
        } catch (err) {
          set({ lists: previousLists, error: 'Failed to remove book. Please try again.' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      reorderBooks: async (listId: string, fromIndex: number, toIndex: number) => {
        set({ isLoading: true, error: null });
        const previousLists = [...get().lists];
        const list = get().lists.find(l => l.id === listId);
        
        if (!list) return;

        const newItems = [...list.items];
        const [removed] = newItems.splice(fromIndex, 1);
        newItems.splice(toIndex, 0, removed);

        // Optimistic update
        set({
          lists: get().lists.map(list =>
            list.id === listId ? { ...list, items: newItems, updatedAt: Date.now() } : list
          )
        });

        try {
          await delay(400);
        } catch (err) {
          set({ lists: previousLists, error: 'Failed to reorder books. Please try again.' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      togglePrivacy: async (listId: string) => {
        set({ isLoading: true, error: null });
        const previousLists = [...get().lists];
        const list = get().lists.find(l => l.id === listId);
        
        if (!list) return;

        // Optimistic update - explicit privacy toggle
        set({
          lists: get().lists.map(list =>
            list.id === listId ? { ...list, isPrivate: !list.isPrivate, updatedAt: Date.now() } : list
          )
        });

        try {
          await delay(500);
        } catch (err) {
          set({ lists: previousLists, error: 'Failed to update privacy settings. Please try again.' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      generateShareLink: async (listId: string) => {
        set({ isLoading: true, error: null });
        const shareId = Math.random().toString(36).substring(2, 15);
        const previousLists = [...get().lists];
        
        // Optimistic update
        set({
          lists: get().lists.map(list =>
            list.id === listId ? { ...list, shareId, isPrivate: false, updatedAt: Date.now() } : list
          )
        });

        try {
          await delay(500);
          const shareLink = `${window.location.origin}/shared/lists/${shareId}`;
          return shareLink;
        } catch (err) {
          set({ lists: previousLists, error: 'Failed to generate share link. Please try again.' });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      getList: (listId: string) => get().lists.find(list => list.id === listId),
      clearError: () => set({ error: null }),
    }),
    { name: 'cv-booklists' },
  )
);