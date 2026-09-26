import type { Metadata } from 'next';
import { ScholarshipPublicProgramPage } from '@/src/features/scholarships/public-pages';
import { publicProgramService } from '@/src/features/scholarships/public-pages/service';
import type { PublicProgramPage } from '@/src/features/scholarships/public-pages/types';

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function loadPage(slug: string): Promise<{
  page: PublicProgramPage | null;
  errorMessage?: string;
}> {
  try {
    return { page: await publicProgramService.get(slug) };
  } catch (err) {
    return {
      page: null,
      errorMessage: err instanceof Error ? err.message : 'The public program page could not be loaded.',
    };
  }
}

/**
 * Indexability metadata is derived from the published page itself, so only
 * whitelisted fields can ever reach a search-engine snippet.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await loadPage(slug);

  if (!page || page.visibility !== 'public') {
    return { title: 'Program not available', robots: { index: false, follow: false } };
  }

  return {
    title: page.title,
    description: page.summary || page.description,
    alternates: { canonical: page.canonicalUrl },
    openGraph: {
      type: 'website',
      title: page.title,
      description: page.summary || page.description,
      url: page.canonicalUrl,
    },
  };
}

export default async function PublicProgramPageRoute({ params }: PageProps) {
  const { slug } = await params;
  const { page, errorMessage } = await loadPage(slug);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-center text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">
          Public programs
        </p>
        <div className="mt-6">
          {page ? (
            <>
              <script
                type="application/ld+json"
                // The payload is built from whitelisted fields only.
                dangerouslySetInnerHTML={{ __html: JSON.stringify(page.structuredData) }}
              />
              <ScholarshipPublicProgramPage slug={slug} page={page} state="ready" />
            </>
          ) : (
            <ScholarshipPublicProgramPage
              slug={slug}
              page={null}
              state="error"
              errorMessage={errorMessage}
            />
          )}
        </div>
      </div>
    </main>
  );
}
