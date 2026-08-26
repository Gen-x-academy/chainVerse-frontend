import { z } from 'zod';

export const contributorSchema = z.object({
  name: z.string().min(1, 'Contributor name is required'),
  role: z.enum(['author', 'editor', 'translator', 'illustrator']),
});

export const holdingSchema = z.object({
  location: z.string().min(1, 'Location is required'),
  callNumber: z.string().min(1, 'Call number is required'),
  copies: z.coerce.number().int().min(1, 'At least one copy is required'),
});

export const digitalFormatSchema = z.object({
  format: z.enum(['pdf', 'epub', 'audiobook']),
  url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  fileSizeMb: z.coerce.number().min(0).optional(),
});

export const bibliographicSchema = z.object({
  title: z.string().min(1, 'Title is required').min(2, 'Title must be at least 2 characters'),
  subtitle: z.string().optional(),
  description: z.string().min(1, 'Description is required').min(10, 'Description must be at least 10 characters'),
  isbn: z.string().optional(),
  isbn13: z.string().optional(),
  publisher: z.string().optional(),
  publicationYear: z.coerce.number().int().min(1000).max(2100).optional(),
  language: z.string().min(1, 'Language is required'),
  pages: z.coerce.number().int().min(1).optional(),
});

export const taxonomySchema = z.object({
  subjects: z.array(z.string().min(1)).min(1, 'At least one subject is required'),
  deweyDecimal: z.string().optional(),
  audience: z.string().min(1, 'Audience is required'),
});

export const bookCreateSchema = z.object({
  bibliographic: bibliographicSchema,
  contributors: z.array(contributorSchema).min(1, 'At least one contributor is required'),
  taxonomy: taxonomySchema,
  holdings: z.array(holdingSchema).min(1, 'At least one holding is required'),
  digitalFormats: z.array(digitalFormatSchema),
  coverUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  status: z.enum(['draft', 'published']).default('draft'),
});

export type BookCreateFormValues = z.infer<typeof bookCreateSchema>;

export const isbnSchema = z
  .string()
  .trim()
  .min(1, 'ISBN is required')
  .refine(
    (val) => {
      const digits = val.replace(/[-\s]/g, '');
      return digits.length === 10 || digits.length === 13;
    },
    { message: 'ISBN must be 10 or 13 digits (hyphens optional)' }
  );
