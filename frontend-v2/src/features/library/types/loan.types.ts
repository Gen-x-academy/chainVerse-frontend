export type LoanEventType =
  | 'checkout'
  | 'return'
  | 'renewal'
  | 'due_date'
  | 'overdue'
  | 'fine';

export interface LoanTimelineEvent {
  id: string;
  type: LoanEventType;
  bookTitle: string;
  bookId: string;
  timestamp: string;
  details?: string;
  librarian?: string;
  /** When true the event is historical and must not be edited from the UI. */
  immutable: boolean;
}

export interface LoanActivityResponse {
  data: LoanTimelineEvent[];
  total: number;
}
