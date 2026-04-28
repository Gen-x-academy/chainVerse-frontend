import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-gray-600 mt-2">Page not found</p>
      <Link href="/" className="mt-4 text-blue-600 hover:underline">Go home</Link>
    </div>
  );
}
