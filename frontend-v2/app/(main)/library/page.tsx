import { PersonalBookLists } from "@/components/elibrary/PersonalBookLists";

export default function LibraryPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Library</h1>
        <p className="text-muted-foreground">
          Manage your personal book collections and reading lists. Create, organize, and share your favorite books with others.
        </p>
      </div>
      <PersonalBookLists />
    </div>
  );
}