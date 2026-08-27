'use client';

import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bookCreateSchema, type BookCreateFormValues } from '../schemas/book.schema';
import { BookFormStepper, type BookFormStep, BOOK_FORM_STEPS } from './BookFormStepper';
import { cn } from '@/lib/utils';
import type { BookCreatePayload } from '../types/book.types';

export interface BookCreateFormProps {
  defaultValues?: Partial<BookCreateFormValues>;
  serverFieldErrors?: Record<string, string>;
  onSubmit: (payload: BookCreatePayload) => void | Promise<void>;
  loading?: boolean;
  className?: string;
}

const DEFAULT_VALUES: BookCreateFormValues = {
  bibliographic: {
    title: '',
    subtitle: '',
    description: '',
    isbn: '',
    isbn13: '',
    publisher: '',
    language: 'en',
  },
  contributors: [{ name: '', role: 'author' }],
  taxonomy: { subjects: [''], audience: 'general' },
  holdings: [{ location: 'Main', callNumber: '', copies: 1 }],
  digitalFormats: [],
  coverUrl: '',
  status: 'draft',
};

function stepFields(step: BookFormStep): (keyof BookCreateFormValues)[] {
  switch (step) {
    case 'bibliographic':
      return ['bibliographic', 'coverUrl'];
    case 'contributors':
      return ['contributors'];
    case 'taxonomy':
      return ['taxonomy'];
    case 'holdings':
      return ['holdings'];
    case 'digital':
      return ['digitalFormats'];
  }
}

export function BookCreateForm({
  defaultValues,
  serverFieldErrors = {},
  onSubmit,
  loading = false,
  className,
}: BookCreateFormProps) {
  const [step, setStep] = useState<BookFormStep>('bibliographic');
  const [completedSteps, setCompletedSteps] = useState<BookFormStep[]>([]);

  const form = useForm<BookCreateFormValues>({
    resolver: zodResolver(bookCreateSchema),
    defaultValues: { ...DEFAULT_VALUES, ...defaultValues },
    mode: 'onSubmit',
  });

  const {
    register,
    control,
    handleSubmit,
    trigger,
    formState: { errors },
  } = form;

  const contributors = useFieldArray({ control, name: 'contributors' });
  const holdings = useFieldArray({ control, name: 'holdings' });
  const digitalFormats = useFieldArray({ control, name: 'digitalFormats' });
  const subjects = useFieldArray({ control, name: 'taxonomy.subjects' });

  const stepIndex = BOOK_FORM_STEPS.findIndex((s) => s.id === step);
  const isLastStep = stepIndex === BOOK_FORM_STEPS.length - 1;

  const fieldError = (path: string) => {
    const parts = path.split('.');
    let err: unknown = errors;
    for (const p of parts) {
      err = (err as Record<string, unknown>)?.[p];
    }
    const clientMsg = (err as { message?: string })?.message;
    return serverFieldErrors[path] ?? clientMsg;
  };

  const validateStep = async () => {
    const fields = stepFields(step);
    const valid = await trigger(fields);
    if (valid && !completedSteps.includes(step)) {
      setCompletedSteps((prev) => [...prev, step]);
    }
    return valid;
  };

  const goNext = async () => {
    const valid = await validateStep();
    if (!valid) return;
    if (!isLastStep) {
      setStep(BOOK_FORM_STEPS[stepIndex + 1].id);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) setStep(BOOK_FORM_STEPS[stepIndex - 1].id);
  };

  const submitForm = handleSubmit(async (data) => {
    const payload: BookCreatePayload = {
      status: data.status,
      bibliographic: {
        ...data.bibliographic,
        isbn: data.bibliographic.isbn || undefined,
        isbn13: data.bibliographic.isbn13 || undefined,
        subtitle: data.bibliographic.subtitle || undefined,
        publisher: data.bibliographic.publisher || undefined,
      },
      contributors: data.contributors,
      taxonomy: {
        ...data.taxonomy,
        subjects: data.taxonomy.subjects.filter(Boolean),
        deweyDecimal: data.taxonomy.deweyDecimal || undefined,
      },
      holdings: data.holdings,
      digitalFormats: data.digitalFormats.map((f) => ({
        ...f,
        url: f.url || undefined,
      })),
      coverUrl: data.coverUrl || undefined,
    };
    await onSubmit(payload);
  });

  return (
    <form
      className={cn('space-y-6', className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (isLastStep) void submitForm();
        else void goNext();
      }}
      noValidate
    >
      <BookFormStepper
        currentStep={step}
        completedSteps={completedSteps}
        onStepClick={(s) => setStep(s)}
      />

      {step === 'bibliographic' && (
        <section aria-labelledby="bib-heading" className="space-y-4">
          <h2 id="bib-heading" className="text-lg font-semibold text-gray-900">
            Bibliographic metadata
          </h2>
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              id="title"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              {...register('bibliographic.title')}
            />
            {fieldError('bibliographic.title') && (
              <p className="text-red-600 text-xs mt-1">{fieldError('bibliographic.title')}</p>
            )}
          </div>
          <div>
            <label htmlFor="subtitle" className="block text-sm font-medium text-gray-700 mb-1">
              Subtitle
            </label>
            <input
              id="subtitle"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              {...register('bibliographic.subtitle')}
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              id="description"
              rows={4}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
              {...register('bibliographic.description')}
            />
            {fieldError('bibliographic.description') && (
              <p className="text-red-600 text-xs mt-1">{fieldError('bibliographic.description')}</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="isbn" className="block text-sm font-medium text-gray-700 mb-1">
                ISBN-10
              </label>
              <input id="isbn" className="w-full border rounded-lg px-3 py-2 text-sm" {...register('bibliographic.isbn')} />
            </div>
            <div>
              <label htmlFor="isbn13" className="block text-sm font-medium text-gray-700 mb-1">
                ISBN-13
              </label>
              <input id="isbn13" className="w-full border rounded-lg px-3 py-2 text-sm" {...register('bibliographic.isbn13')} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="publisher" className="block text-sm font-medium text-gray-700 mb-1">
                Publisher
              </label>
              <input id="publisher" className="w-full border rounded-lg px-3 py-2 text-sm" {...register('bibliographic.publisher')} />
            </div>
            <div>
              <label htmlFor="publicationYear" className="block text-sm font-medium text-gray-700 mb-1">
                Publication year
              </label>
              <input
                id="publicationYear"
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                {...register('bibliographic.publicationYear')}
              />
            </div>
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
                Language *
              </label>
              <input id="language" className="w-full border rounded-lg px-3 py-2 text-sm" {...register('bibliographic.language')} />
              {fieldError('bibliographic.language') && (
                <p className="text-red-600 text-xs mt-1">{fieldError('bibliographic.language')}</p>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="coverUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Cover URL
            </label>
            <input id="coverUrl" className="w-full border rounded-lg px-3 py-2 text-sm" {...register('coverUrl')} />
            {fieldError('coverUrl') && (
              <p className="text-red-600 text-xs mt-1">{fieldError('coverUrl')}</p>
            )}
          </div>
        </section>
      )}

      {step === 'contributors' && (
        <section aria-labelledby="contrib-heading" className="space-y-4">
          <h2 id="contrib-heading" className="text-lg font-semibold text-gray-900">
            Contributors
          </h2>
          {contributors.fields.map((field, index) => (
            <div key={field.id} className="flex flex-col sm:flex-row gap-3 items-start">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  {...register(`contributors.${index}.name`)}
                />
                {fieldError(`contributors.${index}.name`) && (
                  <p className="text-red-600 text-xs mt-1">{fieldError(`contributors.${index}.name`)}</p>
                )}
              </div>
              <div className="w-full sm:w-40">
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  {...register(`contributors.${index}.role`)}
                >
                  <option value="author">Author</option>
                  <option value="editor">Editor</option>
                  <option value="translator">Translator</option>
                  <option value="illustrator">Illustrator</option>
                </select>
              </div>
              {contributors.fields.length > 1 && (
                <button
                  type="button"
                  className="text-sm text-red-600 mt-6"
                  onClick={() => contributors.remove(index)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {errors.contributors?.root && (
            <p className="text-red-600 text-xs">{errors.contributors.root.message}</p>
          )}
          {typeof errors.contributors?.message === 'string' && (
            <p className="text-red-600 text-xs">{errors.contributors.message}</p>
          )}
          <button
            type="button"
            className="text-sm text-indigo-600"
            onClick={() => contributors.append({ name: '', role: 'author' })}
          >
            + Add contributor
          </button>
        </section>
      )}

      {step === 'taxonomy' && (
        <section aria-labelledby="tax-heading" className="space-y-4">
          <h2 id="tax-heading" className="text-lg font-semibold text-gray-900">
            Taxonomy
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subjects *</label>
            {subjects.fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 mb-2">
                <input
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  {...register(`taxonomy.subjects.${index}`)}
                />
                {subjects.fields.length > 1 && (
                  <button type="button" className="text-sm text-red-600" onClick={() => subjects.remove(index)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="text-sm text-indigo-600" onClick={() => subjects.append('')}>
              + Add subject
            </button>
            {fieldError('taxonomy.subjects') && (
              <p className="text-red-600 text-xs mt-1">{fieldError('taxonomy.subjects')}</p>
            )}
          </div>
          <div>
            <label htmlFor="dewey" className="block text-sm font-medium text-gray-700 mb-1">
              Dewey decimal
            </label>
            <input id="dewey" className="w-full border rounded-lg px-3 py-2 text-sm" {...register('taxonomy.deweyDecimal')} />
          </div>
          <div>
            <label htmlFor="audience" className="block text-sm font-medium text-gray-700 mb-1">
              Audience *
            </label>
            <select id="audience" className="w-full border rounded-lg px-3 py-2 text-sm" {...register('taxonomy.audience')}>
              <option value="general">General</option>
              <option value="children">Children</option>
              <option value="young-adult">Young adult</option>
              <option value="academic">Academic</option>
              <option value="professional">Professional</option>
            </select>
            {fieldError('taxonomy.audience') && (
              <p className="text-red-600 text-xs mt-1">{fieldError('taxonomy.audience')}</p>
            )}
          </div>
        </section>
      )}

      {step === 'holdings' && (
        <section aria-labelledby="hold-heading" className="space-y-4">
          <h2 id="hold-heading" className="text-lg font-semibold text-gray-900">
            Holdings
          </h2>
          {holdings.fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 border rounded-lg">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Location</label>
                <input className="w-full border rounded px-2 py-1 text-sm" {...register(`holdings.${index}.location`)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Call number</label>
                <input className="w-full border rounded px-2 py-1 text-sm" {...register(`holdings.${index}.callNumber`)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Copies</label>
                <input type="number" className="w-full border rounded px-2 py-1 text-sm" {...register(`holdings.${index}.copies`)} />
              </div>
              {holdings.fields.length > 1 && (
                <button type="button" className="text-xs text-red-600 sm:col-span-3" onClick={() => holdings.remove(index)}>
                  Remove holding
                </button>
              )}
            </div>
          ))}
          <button type="button" className="text-sm text-indigo-600" onClick={() => holdings.append({ location: 'Main', callNumber: '', copies: 1 })}>
            + Add holding
          </button>
        </section>
      )}

      {step === 'digital' && (
        <section aria-labelledby="dig-heading" className="space-y-4">
          <h2 id="dig-heading" className="text-lg font-semibold text-gray-900">
            Digital formats
          </h2>
          {digitalFormats.fields.length === 0 && (
            <p className="text-sm text-gray-500">No digital formats yet. Add one if applicable.</p>
          )}
          {digitalFormats.fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 border rounded-lg">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Format</label>
                <select className="w-full border rounded px-2 py-1 text-sm" {...register(`digitalFormats.${index}.format`)}>
                  <option value="pdf">PDF</option>
                  <option value="epub">EPUB</option>
                  <option value="audiobook">Audiobook</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">URL</label>
                <input className="w-full border rounded px-2 py-1 text-sm" {...register(`digitalFormats.${index}.url`)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Size (MB)</label>
                <input type="number" className="w-full border rounded px-2 py-1 text-sm" {...register(`digitalFormats.${index}.fileSizeMb`)} />
              </div>
              <button type="button" className="text-xs text-red-600 sm:col-span-3" onClick={() => digitalFormats.remove(index)}>
                Remove format
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-sm text-indigo-600"
            onClick={() => digitalFormats.append({ format: 'pdf', url: '' })}
          >
            + Add digital format
          </button>
        </section>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 justify-between pt-4 border-t">
        <div className="flex gap-3">
          {stepIndex > 0 && (
            <button type="button" onClick={goBack} className="px-4 py-2 text-sm border rounded-lg">
              Back
            </button>
          )}
        </div>
        <div className="flex gap-3">
          {isLastStep ? (
            <>
              <button
                type="button"
                disabled={loading}
                className="px-4 py-2 text-sm border rounded-lg"
                onClick={() => {
                  form.setValue('status', 'draft');
                  void submitForm();
                }}
              >
                Save as draft
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg disabled:opacity-50"
                onClick={() => form.setValue('status', 'draft')}
              >
                {loading ? 'Creating…' : 'Create book record'}
              </button>
            </>
          ) : (
            <button type="submit" className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg">
              Continue
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
