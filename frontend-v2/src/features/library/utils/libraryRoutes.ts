/**
 * Central route generation for the E-Library (issue #1056).
 *
 * Catalog cards, search results, recommendations, reading lists, and loan
 * history must link to the *same* canonical book detail route. Derive every
 * book link from `bookDetailRoute` so a future route change happens in one
 * place and a navigation test can lock it down.
 */

/** Canonical patron-facing book detail route. */
export function bookDetailRoute(bookId: string): string {
  return `/catalog/${encodeURIComponent(bookId)}`;
}

/** Author profile route. */
export function authorRoute(authorId: string): string {
  return `/authors/${encodeURIComponent(authorId)}`;
}

/** Library account route with an optional tab. */
export function libraryAccountRoute(tab?: string): string {
  return tab ? `/library/account?tab=${tab}` : '/library/account';
}

/** Librarian edit route for a catalog record. */
export function bookEditRoute(bookId: string): string {
  return `/library/catalog/${encodeURIComponent(bookId)}/edit`;
}

/** Library catalog administrative hub. */
export const libraryCatalogRoute = '/library/catalog';