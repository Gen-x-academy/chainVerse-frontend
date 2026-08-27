'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AcquisitionSource, PurchaseIntake } from '@/src/features/library/types/acquisitions.types';

const purchaseIntakeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().min(1, 'Author is required'),
  isbn: z.string().optional(),
  source: z.enum(['vendor', 'donation', 'exchange', 'internal-transfer']),
  vendorName: z.string().optional(),
  invoiceReference: z.string().optional(),
  costAmount: z.coerce.number().min(0, 'Cost must be 0 or more').optional(),
  costCurrency: z.string().optional(),
  receivedDate: z.string().min(1, 'Received date is required'),
  notes: z.string().optional(),
  bookRecordId: z.string().optional(),
}).refine(
  (data) => data.source !== 'vendor' || !!data.vendorName?.trim(),
  { message: 'Vendor name is required for vendor purchases', path: ['vendorName'] },
);

export type PurchaseIntakeFormData = z.infer<typeof purchaseIntakeSchema>;

interface PurchaseIntakeFormProps {
  defaultValues?: Partial<PurchaseIntakeFormData>;
  canViewCost: boolean;
  onSubmit: (data: PurchaseIntake) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  successMessage?: string | null;
}

const SOURCE_LABELS: Record<AcquisitionSource, string> = {
  vendor: 'Vendor purchase',
  donation: 'Donation',
  exchange: 'Exchange',
  'internal-transfer': 'Internal transfer',
};

/** #930: Purchase intake form with cost role restriction */
export function PurchaseIntakeForm({
  defaultValues,
  canViewCost,
  onSubmit,
  isLoading,
  error,
  successMessage,
}: PurchaseIntakeFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseIntakeFormData>({
    resolver: zodResolver(purchaseIntakeSchema),
    defaultValues: {
      source: 'vendor',
      costCurrency: 'USD',
      receivedDate: new Date().toISOString().slice(0, 10),
      ...defaultValues,
    },
  });

  const source = watch('source');

  const handleFormSubmit = async (data: PurchaseIntakeFormData) => {
    const payload: PurchaseIntake = {
      title: data.title,
      author: data.author,
      isbn: data.isbn,
      source: data.source,
      vendorName: data.vendorName,
      invoiceReference: data.invoiceReference,
      receivedDate: data.receivedDate,
      notes: data.notes,
      bookRecordId: data.bookRecordId,
    };
    if (canViewCost && data.costAmount !== undefined) {
      payload.costAmount = data.costAmount;
      payload.costCurrency = data.costCurrency ?? 'USD';
    }
    await onSubmit(payload);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase intake</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="title" className="text-sm font-medium">Title *</label>
              <input id="title" {...register('title')} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
              {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
            </div>
            <div>
              <label htmlFor="author" className="text-sm font-medium">Author *</label>
              <input id="author" {...register('author')} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
              {errors.author && <p className="text-xs text-destructive mt-1">{errors.author.message}</p>}
            </div>
            <div>
              <label htmlFor="isbn" className="text-sm font-medium">ISBN</label>
              <input id="isbn" {...register('isbn')} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="source" className="text-sm font-medium">Acquisition source *</label>
              <select id="source" {...register('source')} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                {(Object.keys(SOURCE_LABELS) as AcquisitionSource[]).map((s) => (
                  <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            {source === 'vendor' && (
              <div>
                <label htmlFor="vendorName" className="text-sm font-medium">Vendor name *</label>
                <input id="vendorName" {...register('vendorName')} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
                {errors.vendorName && <p className="text-xs text-destructive mt-1">{errors.vendorName.message}</p>}
              </div>
            )}
            <div>
              <label htmlFor="invoiceReference" className="text-sm font-medium">Invoice reference</label>
              <input id="invoiceReference" {...register('invoiceReference')} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="receivedDate" className="text-sm font-medium">Received date *</label>
              <input id="receivedDate" type="date" {...register('receivedDate')} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
              {errors.receivedDate && <p className="text-xs text-destructive mt-1">{errors.receivedDate.message}</p>}
            </div>
            {canViewCost ? (
              <>
                <div>
                  <label htmlFor="costAmount" className="text-sm font-medium">Cost amount</label>
                  <input id="costAmount" type="number" step="0.01" min="0" {...register('costAmount')} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
                  {errors.costAmount && <p className="text-xs text-destructive mt-1">{errors.costAmount.message}</p>}
                </div>
                <div>
                  <label htmlFor="costCurrency" className="text-sm font-medium">Currency</label>
                  <input id="costCurrency" {...register('costCurrency')} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
                </div>
              </>
            ) : (
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Cost fields are restricted to administrators.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="notes" className="text-sm font-medium">Notes</label>
            <textarea id="notes" {...register('notes')} rows={3} className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </div>

          {error && <div role="alert" className="text-sm text-destructive">{error}</div>}
          {successMessage && <p className="text-sm text-green-700">{successMessage}</p>}

          <Button type="submit" disabled={isLoading || isSubmitting}>
            {isSubmitting || isLoading ? 'Saving…' : 'Submit intake'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
