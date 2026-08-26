"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
// Toast functionality will be added when the component is integrated into the app's toast system
import { useBookListsStore, BookList, BookListItem } from "@/src/store/booklists-store";
import { Plus, Trash2, Edit3, Share2, Lock, Globe, GripVertical, Copy, Check, Eye, EyeOff } from "lucide-react";

interface PersonalBookListsProps {
  className?: string;
}

export function PersonalBookLists({ className }: PersonalBookListsProps) {
  const { lists, isLoading, error, createList, renameList, deleteList, addBookToList, removeBookFromList, reorderBooks, togglePrivacy, generateShareLink, clearError } = useBookListsStore();
  
  const [selectedList, setSelectedList] = useState<BookList | null>(null);
  const [newListName, setNewListName] = useState("");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddBookDialog, setShowAddBookDialog] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState("");
  const [newBookAuthor, setNewBookAuthor] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState<string | null>(null);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  // Create new list
  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      await createList(newListName.trim());
      setNewListName("");
      setShowCreateDialog(false);
      console.log(`List "${newListName}" created successfully`);
    } catch (err) {
      console.error("Failed to create list");
    }
  };

  // Rename list
  const handleRenameList = async (listId: string) => {
    if (!editingName.trim()) return;
    try {
      await renameList(listId, editingName.trim());
      setEditingListId(null);
      setEditingName("");
      console.log("List renamed successfully");
    } catch (err) {
      console.error("Failed to rename list");
    }
  };

  // Delete list with confirmation
  const handleDeleteList = async (listId: string) => {
    try {
      await deleteList(listId);
      if (selectedList?.id === listId) setSelectedList(null);
      setDeleteConfirmId(null);
      toast({
        title: "List deleted",
        description: "List has been deleted permanently.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete list. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add book to list
  const handleAddBook = async () => {
    if (!selectedList || !newBookTitle.trim() || !newBookAuthor.trim()) return;
    try {
      await addBookToList(selectedList.id, {
        title: newBookTitle.trim(),
        author: newBookAuthor.trim(),
      });
      setNewBookTitle("");
      setNewBookAuthor("");
      setShowAddBookDialog(false);
      toast({
        title: "Book added",
        description: `"${newBookTitle}" has been added to the list.`,
      });
      // Refresh selected list
      const updatedList = useBookListsStore.getState().getList(selectedList.id);
      if (updatedList) setSelectedList(updatedList);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to add book. It might already be in the list.",
        variant: "destructive",
      });
    }
  };

  // Remove book from list
  const handleRemoveBook = async (bookId: string) => {
    if (!selectedList) return;
    try {
      await removeBookFromList(selectedList.id, bookId);
      toast({
        title: "Book removed",
        description: "Book has been removed from the list.",
      });
      // Refresh selected list
      const updatedList = useBookListsStore.getState().getList(selectedList.id);
      if (updatedList) setSelectedList(updatedList);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to remove book. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Toggle privacy
  const handleTogglePrivacy = async (listId: string) => {
    try {
      await togglePrivacy(listId);
      toast({
        title: "Privacy updated",
        description: "List privacy settings have been updated.",
      });
      // Refresh selected list
      const updatedList = useBookListsStore.getState().getList(listId);
      if (updatedList) setSelectedList(updatedList);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update privacy settings.",
        variant: "destructive",
      });
    }
  };

  // Generate and copy share link
  const handleShareList = async (listId: string) => {
    try {
      const shareLink = await generateShareLink(listId);
      await navigator.clipboard.writeText(shareLink);
      setCopiedShareLink(listId);
      setTimeout(() => setCopiedShareLink(null), 2000);
      toast({
        title: "Share link copied",
        description: "Share link has been copied to your clipboard.",
      });
      // Refresh selected list
      const updatedList = useBookListsStore.getState().getList(listId);
      if (updatedList) setSelectedList(updatedList);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to generate share link.",
        variant: "destructive",
      });
    }
  };

  // Drag and drop handlers for reordering
  const handleDragStart = (index: number) => {
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index || !selectedList) return;
    
    reorderBooks(selectedList.id, draggedItemIndex, index);
    setDraggedItemIndex(index);
    // Refresh selected list
    const updatedList = useBookListsStore.getState().getList(selectedList.id);
    if (updatedList) setSelectedList(updatedList);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  // Clear error if any
  if (error) {
    clearError();
  }

  // Empty state
  if (lists.length === 0 && !isLoading) {
    return (
      <div className={cn("flex flex-col items-center justify-center min-h-[400px] p-8", className)}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
            <Plus className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold">No book lists yet</h3>
          <p className="text-muted-foreground max-w-md">
            Create your first personal book list to organize your reading collection. You can create multiple lists, add books, and share them with others.
          </p>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>Create your first list</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create new book list</DialogTitle>
                <DialogDescription>
                  Give your list a name to get started. You can always rename it later.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="list-name">List name</Label>
                  <Input
                    id="list-name"
                    placeholder="e.g., Summer Reading"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateList} disabled={!newListName.trim()}>
                  Create list
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Book Lists</h2>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create new book list</DialogTitle>
              <DialogDescription>
                Give your list a name to get started. You can always rename it later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="list-name">List name</Label>
                <Input
                  id="list-name"
                  placeholder="e.g., Summer Reading"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateList} disabled={!newListName.trim()}>
                Create list
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </Card>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Lists grid when no list is selected */}
      {!selectedList && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <Card key={list.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedList(list)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{list.name}</h3>
                    {list.isPrivate ? (
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Globe className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {list.items.length} {list.items.length === 1 ? "book" : "books"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created {new Date(list.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Selected list detail view */}
      {selectedList && !isLoading && (
        <div className="space-y-6">
          {/* List header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setSelectedList(null)}>
              ← Back to all lists
            </Button>
            <div className="flex items-center gap-2">
              <Dialog open={showAddBookDialog} onOpenChange={setShowAddBookDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Book
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add book to list</DialogTitle>
                    <DialogDescription>
                      Add a new book to your "{selectedList.name}" list.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="book-title">Book title</Label>
                      <Input
                        id="book-title"
                        placeholder="Book title"
                        value={newBookTitle}
                        onChange={(e) => setNewBookTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="book-author">Author</Label>
                      <Input
                        id="book-author"
                        placeholder="Author name"
                        value={newBookAuthor}
                        onChange={(e) => setNewBookAuthor(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleAddBook} disabled={!newBookTitle.trim() || !newBookAuthor.trim()}>
                      Add book
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* List details and actions */}
          <Card className="p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
              <div>
                {editingListId === selectedList.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="max-w-xs"
                      autoFocus
                    />
                    <Button size="sm" onClick={() => handleRenameList(selectedList.id)}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingListId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold">{selectedList.name}</h3>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingListId(selectedList.id);
                        setEditingName(selectedList.name);
                      }}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <p className="text-muted-foreground mt-1">
                  {selectedList.items.length} {selectedList.items.length === 1 ? "book" : "books"}
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Privacy toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    id="privacy-toggle"
                    checked={!selectedList.isPrivate}
                    onCheckedChange={() => handleTogglePrivacy(selectedList.id)}
                  />
                  <Label htmlFor="privacy-toggle" className="flex items-center gap-1 cursor-pointer">
                    {selectedList.isPrivate ? (
                      <>
                        <EyeOff className="w-4 h-4" /> Private
                      </>
                    ) : (
                      <>
                        <Eye className="w-4 h-4" /> Public
                      </>
                    )}
                  </Label>
                </div>

                {/* Share button */}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleShareList(selectedList.id)}
                  className="flex items-center gap-2"
                >
                  {copiedShareLink === selectedList.id ? (
                    <>
                      <Check className="w-4 h-4" /> Copied!
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" /> Share
                    </>
                  )}
                </Button>

                {/* Delete button with confirmation */}
                <AlertDialog open={deleteConfirmId === selectedList.id} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteConfirmId(selectedList.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your list "{selectedList.name}" and remove all books from it.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteList(selectedList.id)}>
                        Delete list
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* Books list with reordering */}
            {selectedList.items.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground mb-4">No books in this list yet</p>
                <Button onClick={() => setShowAddBookDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add your first book
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {selectedList.items.map((book, index) => (
                  <li
                    key={book.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
                      draggedItemIndex === index && "opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab" />
                      <div>
                        <p className="font-medium">{book.title}</p>
                        <p className="text-sm text-muted-foreground">{book.author}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveBook(book.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}