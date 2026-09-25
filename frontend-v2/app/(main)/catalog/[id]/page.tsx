'use client';

import { useParams } from 'next/navigation';
import { BookDetailView } from '@/src/features/library/components/BookDetailView';

export default function BookDetailPage() {
  const params = useParams<{ id: string }>();
  return <BookDetailView bookId={params.id} />;
}