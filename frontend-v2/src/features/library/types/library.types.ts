/** Shared E-Library types for acquisitions, circulation, locations, and stocktake. */

export type BookCondition = 'good' | 'worn' | 'damaged' | 'unusable';

export type DonationAcceptanceStatus = 'pending' | 'accepted' | 'rejected';

export interface DonorPreferences {
  /** When true, donor identity is stored but never shown outside acquisitions staff. */
  anonymous: boolean;
  acknowledgmentLetter: boolean;
  taxReceipt: boolean;
  returnIfRejected: boolean;
}

/** Staff-only donor contact — must not appear in patron-facing UI. */
export interface DonorContact {
  name: string;
  email: string;
  phone?: string;
}

export interface CatalogMatch {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  matchScore: number;
  existingCopies: number;
}

export interface DonationIntakePayload {
  donor: DonorContact;
  preferences: DonorPreferences;
  title: string;
  author: string;
  isbn?: string;
  condition: BookCondition;
  conditionNotes?: string;
  matchedCatalogId?: string;
  status: DonationAcceptanceStatus;
  rejectionReason?: string;
}

export interface DonationIntakeRecord extends DonationIntakePayload {
  id: string;
  createdAt: string;
}

export type ScanMode = 'checkout' | 'return' | 'stocktake' | 'copy-detail';

export interface CopyDetail {
  copyId: string;
  barcode: string;
  title: string;
  author: string;
  status: 'available' | 'checked-out' | 'missing' | 'in-transit';
  patronName?: string;
  dueDate?: string;
  locationLabel: string;
}

export type LocationLevel = 'branch' | 'room' | 'shelf' | 'bin';

export interface LocationNode {
  id: string;
  label: string;
  level: LocationLevel;
  active: boolean;
  children?: LocationNode[];
}

export interface LocationSelection {
  branchId?: string;
  roomId?: string;
  shelfId?: string;
  binId?: string;
}

export type StocktakeItemStatus = 'expected' | 'found' | 'missing' | 'unexpected';

export interface StocktakeExpectedItem {
  copyId: string;
  barcode: string;
  title: string;
}

export interface StocktakeScannedItem {
  barcode: string;
  title: string;
  status: StocktakeItemStatus;
  scannedAt: string;
}

export interface StocktakeDiscrepancy {
  barcode: string;
  title: string;
  type: 'missing' | 'unexpected';
}

export interface StocktakeSession {
  id: string;
  location: LocationSelection;
  locationLabel: string;
  startedAt: string;
  expectedItems: StocktakeExpectedItem[];
  scannedItems: StocktakeScannedItem[];
  discrepancies: StocktakeDiscrepancy[];
  status: 'active' | 'review' | 'closed';
}
