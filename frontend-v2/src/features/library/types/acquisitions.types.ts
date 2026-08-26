/** #930: Purchase intake and accession types */

export type AcquisitionSource =
  | 'vendor'
  | 'donation'
  | 'exchange'
  | 'internal-transfer';

export type AccessionStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';

export type HoldingType = 'physical-copy' | 'digital-license';

export interface PurchaseIntake {
  id?: string;
  bookRecordId?: string;
  title: string;
  author: string;
  isbn?: string;
  source: AcquisitionSource;
  vendorName?: string;
  invoiceReference?: string;
  costAmount?: number;
  costCurrency?: string;
  receivedDate: string;
  notes?: string;
}

export interface AccessionCopy {
  barcode?: string;
  location: string;
  condition: 'new' | 'good' | 'fair';
  holdingType: HoldingType;
  licenseCount?: number;
}

export interface AccessionRecord {
  id: string;
  purchaseIntakeId: string;
  bookRecordId: string;
  status: AccessionStatus;
  copies: AccessionCopy[];
  accessionDate?: string;
  createdAt: string;
}

export interface AcquisitionQueueItem {
  id: string;
  title: string;
  author: string;
  source: AcquisitionSource;
  receivedDate: string;
  status: AccessionStatus;
  copyCount: number;
}
