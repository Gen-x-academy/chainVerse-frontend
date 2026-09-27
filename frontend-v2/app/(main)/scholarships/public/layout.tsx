import type { Metadata } from 'next';

type LayoutProps = {
  children: React.ReactNode;
};

/**
 * Static defaults for the public program section. The per-slug page supplies
 * `generateMetadata` derived from the published page, which Next merges over
 * these defaults.
 */
export const metadata: Metadata = {
  title: 'Scholarship programs',
  description: 'Published scholarship program details, eligibility criteria, and deadlines.',
  robots: { index: true, follow: true },
};

export default function PublicProgramsLayout({ children }: LayoutProps) {
  return <div className="bg-slate-100">{children}</div>;
}
