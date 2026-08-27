import type { BookStatus, BookStatusTransition } from '../types/book.types';

const TRANSITIONS: BookStatusTransition[] = [
  {
    from: 'draft',
    to: 'published',
    label: 'Publish',
    description: 'Make this record visible in the public catalog and available for circulation.',
    confirmMessage:
      'Publishing will expose this title in patron search results and allow holds and loans.',
  },
  {
    from: 'draft',
    to: 'archived',
    label: 'Archive',
    description: 'Remove from active catalog while keeping the record for reference.',
    confirmMessage:
      'Archiving hides this title from patron search. Existing loans are unaffected.',
  },
  {
    from: 'published',
    to: 'archived',
    label: 'Archive',
    description: 'Remove from active catalog while keeping the record for reference.',
    confirmMessage:
      'Archiving removes this title from patron search. Active loans continue until returned.',
  },
  {
    from: 'published',
    to: 'withdrawn',
    label: 'Withdraw',
    description: 'Remove from circulation due to rights, quality, or policy concerns.',
    confirmMessage:
      'Withdrawing blocks new loans and holds. Patrons with active loans retain access until return.',
  },
  {
    from: 'archived',
    to: 'draft',
    label: 'Restore to draft',
    description: 'Return to draft for metadata review before republishing.',
    confirmMessage: 'Restoring to draft removes the title from any public visibility.',
  },
  {
    from: 'withdrawn',
    to: 'archived',
    label: 'Move to archive',
    description: 'Retain the record without returning it to active circulation.',
    confirmMessage: 'The title stays hidden from patrons and cannot be borrowed.',
  },
];

export function getAvailableTransitions(status: BookStatus): BookStatusTransition[] {
  return TRANSITIONS.filter((t) => t.from === status);
}

export function isValidTransition(from: BookStatus, to: BookStatus): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to);
}

export function getTransition(from: BookStatus, to: BookStatus): BookStatusTransition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export const STATUS_LABELS: Record<BookStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
  withdrawn: 'Withdrawn',
};
