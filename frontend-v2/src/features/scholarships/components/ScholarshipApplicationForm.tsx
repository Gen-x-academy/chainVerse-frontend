'use client';

import { useState } from 'react';
import { useScholarshipStore } from '../store/scholarshipStore';

const defaultProgram = {
  value: 'general-scholarship',
  label: 'ChainVerse Scholarship',
};

export function ScholarshipApplicationForm() {
  const { submitApplication, status, error } = useScholarshipStore();
  const [form, setForm] = useState({
    applicantName: '',
    email: '',
    programId: defaultProgram.value,
    programName: defaultProgram.label,
    institution: '',
    statement: '',
  });

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await submitApplication({
      applicantName: form.applicantName,
      email: form.email,
      programId: form.programId,
      programName: form.programName,
      institution: form.institution,
      programVersion: 'v1',
      submittedAt: new Date().toISOString(),
      answers: {
        personalStatement: form.statement,
      },
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-busy={status === 'loading'}
      noValidate
    >
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
          Scholarship application
        </p>
        <h2 className="mt-2 text-3xl font-bold text-slate-900">Apply for support</h2>
        <p className="mt-2 text-sm text-slate-600">
          Submit only the information required for review. Your receipt contains no sensitive answers.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="applicant-name" className="mb-2 block text-sm font-medium text-slate-700">
            Full name
          </label>
          <input
            id="applicant-name"
            name="applicantName"
            type="text"
            autoComplete="name"
            required
            value={form.applicantName}
            onChange={(event) => setForm((current) => ({ ...current, applicantName: event.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label htmlFor="applicant-email" className="mb-2 block text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="applicant-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label htmlFor="institution" className="mb-2 block text-sm font-medium text-slate-700">
            Institution
          </label>
          <input
            id="institution"
            name="institution"
            type="text"
            autoComplete="organization"
            value={form.institution}
            onChange={(event) => setForm((current) => ({ ...current, institution: event.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="md:col-span-2">
          <label htmlFor="program-name" className="mb-2 block text-sm font-medium text-slate-700">
            Program
          </label>
          <select
            id="program-name"
            name="programName"
            value={form.programId}
            onChange={(event) => {
              const selected = event.target.value;
              const labels: Record<string, string> = {
                'general-scholarship': 'ChainVerse Scholarship',
                'women-in-stem': 'Women in STEM Bursary',
                'community-impact': 'Community Impact Sponsorship',
              };
              setForm((current) => ({
                ...current,
                programId: selected,
                programName: labels[selected] ?? defaultProgram.label,
              }));
            }}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="general-scholarship">ChainVerse Scholarship</option>
            <option value="women-in-stem">Women in STEM Bursary</option>
            <option value="community-impact">Community Impact Sponsorship</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="statement" className="mb-2 block text-sm font-medium text-slate-700">
            Personal statement
          </label>
          <textarea
            id="statement"
            name="statement"
            rows={5}
            required
            value={form.statement}
            onChange={(event) => setForm((current) => ({ ...current, statement: event.target.value }))}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder="Tell us about your goals, learning journey, and how this program will help you."
          />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
          onClick={() => setForm({
            applicantName: '',
            email: '',
            programId: defaultProgram.value,
            programName: defaultProgram.label,
            institution: '',
            statement: '',
          })}
        >
          Clear
        </button>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'loading' ? 'Submitting...' : 'Submit application'}
        </button>
      </div>
    </form>
  );
}
