"use client";

import { cn } from "@/lib/utils";

export interface BookSearchMatch {
  location: string; // e.g. "Chapter 3, p. 42"
  snippet: string;
  hasAccess: boolean;
  href?: string;
}

interface BookSearchSnippetsProps {
  matches: BookSearchMatch[];
  query: string;
  className?: string;
}

function highlight(snippet: string, query: string) {
  if (!query) return snippet;
  const parts = snippet.split(new RegExp(`(${query})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/** Fix #986: in-book search result snippets with permission-aware previews. */
export function BookSearchSnippets({
  matches,
  query,
  className,
}: BookSearchSnippetsProps) {
  if (matches.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>No matches found.</p>;
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {matches.map((match, i) => (
        <li key={i} className="rounded-md border p-3 text-sm">
          <span className="block text-xs font-medium text-muted-foreground">
            {match.location}
          </span>
          {match.hasAccess ? (
            <a href={match.href} className="mt-1 block hover:underline">
              {highlight(match.snippet, query)}
            </a>
          ) : (
            <p className="mt-1 italic text-muted-foreground">
              This section is not available with your current access.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
