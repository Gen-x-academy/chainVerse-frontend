import type {
  CatalogMatch,
  CopyDetail,
  LocationNode,
  StocktakeSession,
} from '@/src/features/library/types/library.types';

export const MOCK_LOCATION_TREE: LocationNode[] = [
  {
    id: 'branch-main',
    label: 'Main Library',
    level: 'branch',
    active: true,
    children: [
      {
        id: 'room-stacks-a',
        label: 'Stacks A',
        level: 'room',
        active: true,
        children: [
          {
            id: 'shelf-a1',
            label: 'Shelf A1',
            level: 'shelf',
            active: true,
            children: [
              { id: 'bin-a1-1', label: 'Bin 1', level: 'bin', active: true },
              { id: 'bin-a1-2', label: 'Bin 2', level: 'bin', active: false },
            ],
          },
        ],
      },
      {
        id: 'room-ref',
        label: 'Reference',
        level: 'room',
        active: false,
        children: [],
      },
    ],
  },
  {
    id: 'branch-annex',
    label: 'Annex',
    level: 'branch',
    active: true,
    children: [
      {
        id: 'room-annex-1',
        label: 'Storage Room 1',
        level: 'room',
        active: true,
        children: [
          {
            id: 'shelf-an1',
            label: 'Shelf AN1',
            level: 'shelf',
            active: true,
            children: [{ id: 'bin-an1-1', label: 'Bin 1', level: 'bin', active: true }],
          },
        ],
      },
    ],
  },
];

export const MOCK_CATALOG_MATCHES: CatalogMatch[] = [
  {
    id: 'bib-101',
    title: 'Introduction to Blockchain',
    author: 'Alice Chen',
    isbn: '9780000000001',
    matchScore: 0.92,
    existingCopies: 3,
  },
  {
    id: 'bib-102',
    title: 'Blockchain Basics',
    author: 'Bob Smith',
    isbn: '9780000000002',
    matchScore: 0.71,
    existingCopies: 1,
  },
];

const MOCK_COPIES: Record<string, CopyDetail> = {
  '9780000000001': {
    copyId: 'copy-001',
    barcode: '9780000000001',
    title: 'Introduction to Blockchain',
    author: 'Alice Chen',
    status: 'available',
    locationLabel: 'Main Library / Stacks A / Shelf A1 / Bin 1',
  },
  '9780000000002': {
    copyId: 'copy-002',
    barcode: '9780000000002',
    title: 'Solidity Patterns',
    author: 'Dev Writer',
    status: 'checked-out',
    patronName: 'Patron User',
    dueDate: '2026-09-15',
    locationLabel: 'Main Library / Stacks A / Shelf A1 / Bin 1',
  },
};

const checkedOutBarcodes = new Set<string>();

export function mockLookupCopy(barcode: string): CopyDetail | null {
  return MOCK_COPIES[barcode] ?? null;
}

export function mockScanBarcode(
  barcode: string,
  mode: string
): { success: boolean; duplicate?: boolean; copy?: CopyDetail; error?: string } {
  const copy = MOCK_COPIES[barcode];
  if (!copy) {
    return { success: false, error: 'Copy not found' };
  }
  if (mode === 'checkout') {
    if (checkedOutBarcodes.has(barcode) || copy.status === 'checked-out') {
      return { success: false, duplicate: true, error: 'Item already checked out' };
    }
    checkedOutBarcodes.add(barcode);
    return { success: true, copy: { ...copy, status: 'checked-out' } };
  }
  if (mode === 'return') {
    checkedOutBarcodes.delete(barcode);
    return { success: true, copy: { ...copy, status: 'available', patronName: undefined, dueDate: undefined } };
  }
  return { success: true, copy };
}

export function mockSearchCatalogMatches(query: {
  isbn?: string;
  title?: string;
  author?: string;
}): CatalogMatch[] {
  const q = `${query.title ?? ''} ${query.author ?? ''} ${query.isbn ?? ''}`.toLowerCase();
  return MOCK_CATALOG_MATCHES.filter(
    (m) =>
      m.title.toLowerCase().includes(q.split(' ')[0] ?? '') ||
      m.author.toLowerCase().includes((query.author ?? '').toLowerCase())
  );
}

export function mockStartStocktake(locationLabel: string): StocktakeSession {
  return {
    id: `st-${Date.now()}`,
    location: {},
    locationLabel,
    startedAt: new Date().toISOString(),
    expectedItems: [
      { copyId: 'copy-001', barcode: '9780000000001', title: 'Introduction to Blockchain' },
      { copyId: 'copy-003', barcode: '9780000000003', title: 'DeFi Handbook' },
    ],
    scannedItems: [],
    discrepancies: [],
    status: 'active',
  };
}

export function mockStocktakeScan(
  session: StocktakeSession,
  barcode: string
): StocktakeSession {
  const expected = session.expectedItems.find((e) => e.barcode === barcode);
  const item = {
    barcode,
    title: expected?.title ?? 'Unexpected item',
    status: expected ? ('found' as const) : ('unexpected' as const),
    scannedAt: new Date().toISOString(),
  };
  const scannedItems = [...session.scannedItems.filter((s) => s.barcode !== barcode), item];
  const scannedBarcodes = new Set(scannedItems.filter((s) => s.status === 'found').map((s) => s.barcode));
  const discrepancies = [
    ...session.expectedItems
      .filter((e) => !scannedBarcodes.has(e.barcode))
      .map((e) => ({ barcode: e.barcode, title: e.title, type: 'missing' as const })),
    ...scannedItems
      .filter((s) => s.status === 'unexpected')
      .map((s) => ({ barcode: s.barcode, title: s.title, type: 'unexpected' as const })),
  ];
  return {
    ...session,
    scannedItems,
    discrepancies,
    status: discrepancies.some((d) => d.type === 'missing' || d.type === 'unexpected') ? 'review' : 'active',
  };
}
