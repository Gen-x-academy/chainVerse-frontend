'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AccessionCopy } from '@/src/features/library/types/acquisitions.types';

const copySchema = z.object({
  barcode: z.string().optional(),
  location: z.string().min(1, 'Location is required'),
  condition: z.enum(['new', 'good', 'fair']),
  holdingType: z.enum(['physical-copy', 'digital-license']),
  licenseCount: z.coerce.number().min(1).optional(),
}).refine(
  (data) => data.holdingType !== 'digital-license' || (data.licenseCount ?? 0) >= 1,
  { message: 'License count is required for digital licenses', path: ['licenseCount'] },
);

const accessionSchema = z.object({
  copies: z.array(copySchema).min(1, 'At least one copy or license is required'),
});

export type AccessionFormData = z.infer<typeof accessionSchema>;

interface AccessionFormProps {
  intakeTitle: string;
  bookRecordId?: string;
  onSubmit: (copies: AccessionCopy[]) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  successMessage?: string | null;
}

/** #930: Accession form linking new holdings to book record */
export function AccessionForm({
  intakeTitle,
  bookRecordId,
  onSubmit,
  isLoading,
  error,
  successMessage,
}: AccessionFormProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AccessionFormData>({
    resolver: zodResolver(accessionSchema),
    defaultValues: {
      copies: [{ location: '', condition: 'good', holdingType: 'physical-copy' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'copies' });

  const handleFormSubmit = async (data: AccessionFormData) => {
    await onSubmit(data.copies);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accession — {intakeTitle}</CardTitle>
        {bookRecordId && (
          <p className="text-sm text-muted-foreground">
            Linked to catalog record: <code className="text-xs">{bookRecordId}</code>
          </p>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {fields.map((field, index) => {
            const holdingType = watch(`copies.${index}.holdingType`);
            return (
              <div key={field.id} className="rounded-md border p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">Copy / license #{index + 1}</p>
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                      Remove
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Holding type</label>
                    <select
                      {...register(`copies.${index}.holdingType`)}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    >
                      <option value="physical-copy">Physical copy</option>
                      <option value="digital-license">Digital license</option>
                    </select>
                  </div>
                  {holdingType === 'physical-copy' ? (
                    <div>
                      <label className="text-sm font-medium">Barcode</label>
                      <input
                        {...register(`copies.${index}.barcode`)}
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                        placeholder="Auto-generated if blank"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm font-medium">License count *</label>
                      <input
                        type="number"
                        min={1}
                        {...register(`copies.${index}.licenseCount`)}
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      />
                      {errors.copies?.[index]?.licenseCount && (
                        <p className="text-xs text-destructive mt-1">
                          {errors.copies[index]?.licenseCount?.message}
                        </p>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium">Location *</label>
                    <input
                      {...register(`copies.${index}.location`)}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="e.g. Main stacks A-12"
                    />
                    {errors.copies?.[index]?.location && (
                      <p className="text-xs text-destructive mt-1">
                        {errors.copies[index]?.location?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Condition</label>
                    <select
                      {...register(`copies.${index}.condition`)}
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    >
                      <option value="new">New</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}

          {errors.copies?.root && (
            <p className="text-xs text-destructive">{errors.copies.root.message}</p>
          )}
          {errors.copies?.message && (
            <p className="text-xs text-destructive">{errors.copies.message}</p>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => append({ location: '', condition: 'good', holdingType: 'physical-copy' })}
          >
            Add another copy
          </Button>

          {error && <div role="alert" className="text-sm text-destructive">{error}</div>}
          {successMessage && <p className="text-sm text-green-700">{successMessage}</p>}

          <Button type="submit" disabled={isLoading || isSubmitting}>
            {isSubmitting || isLoading ? 'Accessioning…' : 'Complete accession'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
