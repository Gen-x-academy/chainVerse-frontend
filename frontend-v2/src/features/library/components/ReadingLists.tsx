'use client';

import React, { useState } from 'react';
import { List, Plus, BookOpen, Trash2, GripVertical } from 'lucide-react';
import { SecureCoverImage } from './SecureCoverImage';

interface ReadingListBook {
  id: string;
  title: string;
  coverUrl?: string;
  author?: string;
}

interface ReadingList {
  id: string;
  name: string;
  description?: string;
  books: ReadingListBook[];
  createdAt: string;
}

interface ReadingListsProps {
  lists: ReadingList[];
  onAddBook?: (listId: string, bookId: string) => void;
  onRemoveBook?: (listId: string, bookId: string) => void;
  onDeleteList?: (listId: string) => void;
  onCreateList?: (name: string) => void;
}

export function ReadingLists({
  lists,
  onAddBook,
  onRemoveBook,
  onDeleteList,
  onCreateList,
}: ReadingListsProps) {
  const [expandedList, setExpandedList] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <List className="w-5 h-5 text-indigo-500" aria-hidden="true" />
          My Reading Lists
        </h2>
        {onCreateList && (
          <button
            onClick={() => {
              const name = prompt('List name:');
              if (name) onCreateList(name);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            New List
          </button>
        )}
      </div>

      {lists.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <List className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No reading lists yet.</p>
          <p className="text-sm text-gray-400 mt-1">Create a list to save books for later.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <div
              key={list.id}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setExpandedList(expandedList === list.id ? null : list.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition text-left"
              >
                <div>
                  <h3 className="font-medium text-gray-900">{list.name}</h3>
                  <p className="text-sm text-gray-500">
                    {list.books.length} book{list.books.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {onDeleteList && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteList(list.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition"
                      aria-label={`Delete ${list.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </button>

              {expandedList === list.id && (
                <div className="border-t border-gray-100 p-4">
                  {list.description && (
                    <p className="text-sm text-gray-600 mb-3">{list.description}</p>
                  )}
                  {list.books.length === 0 ? (
                    <p className="text-sm text-gray-400">This list is empty.</p>
                  ) : (
                    <ul className="space-y-2">
                      {list.books.map((book) => (
                        <li key={book.id} className="flex items-center gap-3 group">
                          <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                          <SecureCoverImage src={book.coverUrl} alt={book.title} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{book.title}</p>
                            {book.author && (
                              <p className="text-xs text-gray-500 truncate">{book.author}</p>
                            )}
                          </div>
                          {onRemoveBook && (
                            <button
                              onClick={() => onRemoveBook(list.id, book.id)}
                              className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                              aria-label={`Remove ${book.title}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
