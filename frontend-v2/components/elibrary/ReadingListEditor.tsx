"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ReadingListItem {
  id: string;
  title: string;
  priority?: boolean;
}

interface ReadingListEditorProps {
  courseId: string;
  initialItems: ReadingListItem[];
  onPublish: (items: ReadingListItem[]) => void;
  className?: string;
}

/** Fix #988: minimal tutor reading-list editor (add, reorder, prioritize, publish). */
export function ReadingListEditor({
  courseId,
  initialItems,
  onPublish,
  className,
}: ReadingListEditorProps) {
  const [items, setItems] = useState(initialItems);
  const [dirty, setDirty] = useState(false);

  const move = (index: number, dir: -1 | 1) => {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setDirty(true);
  };

  const togglePriority = (id: string) => {
    setItems(items.map((i) => (i.id === id ? { ...i, priority: !i.priority } : i)));
    setDirty(true);
  };

  return (
    <div className={cn("space-y-2", className)} data-course-id={courseId}>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={item.id} className="flex items-center justify-between rounded border p-2 text-sm">
            <span>{item.priority ? "★ " : ""}{item.title}</span>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => move(i, -1)}>Up</button>
              <button type="button" onClick={() => move(i, 1)}>Down</button>
              <button type="button" onClick={() => togglePriority(item.id)}>Priority</button>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={!dirty}
        onClick={() => {
          onPublish(items);
          setDirty(false);
        }}
        className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
      >
        Publish changes
      </button>
    </div>
  );
}
