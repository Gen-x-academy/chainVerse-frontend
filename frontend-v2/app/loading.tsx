import { Spinner } from '@/src/shared/components/ui/Spinner';
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner size="lg" />
    </div>
  );
}
