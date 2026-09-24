/**
 * Scholarship documentation manifest and gate.
 *
 * The UI ships user-facing and operator-facing guides. This module keeps a
 * manifest of every expected document with its audience, owners, and required
 * sections (ownership, privacy, migration, operational impact are mandatory
 * per segment), and validates on-disk docs against it so the documented
 * surface can never silently drift out of the supported workflows.
 */

export type DocAudience = 'users' | 'operators' | 'both';
export type DocSection = 'overview' | 'ownership' | 'privacy' | 'migration' | 'operational-impact' | 'troubleshooting';
export type DocSeverity = 'required' | 'recommended';

export const DOC_SECTION_HEADINGS: Record<DocSection, string> = {
  overview: 'Overview',
  ownership: 'Ownership',
  privacy: 'Privacy',
  migration: 'Migration',
  'operational-impact': 'Operational impact',
  troubleshooting: 'Troubleshooting',
};

export type ScholarshipDocEntry = {
  id: string;
  path: string;
  audience: DocAudience;
  title: string;
  owner: string;
  sections: DocSection[];
  severity: DocSeverity;
};

export type DocumentationManifest = {
  version: string;
  feature: 'scholarships';
  docs: ScholarshipDocEntry[];
};

export const DOC_SECTION_REQUIREMENTS: Record<DocAudience, DocSection[]> = {
  users: ['overview', 'privacy', 'troubleshooting'],
  operators: ['overview', 'ownership', 'migration', 'operational-impact'],
  both: ['overview', 'ownership', 'privacy', 'migration', 'operational-impact', 'troubleshooting'],
};

/** Ensure the manifest itself stays in sync with what the feature promises. */
export function validateManifestIntegrity(manifest: DocumentationManifest): string[] {
  const errors = [];

  if (manifest.feature !== 'scholarships') {
    errors.push('Manifest feature tag must be "scholarships".');
  }

  const ids = manifest.docs.map((doc) => doc.id);
  if (new Set(ids).size !== ids.length) {
    errors.push('Duplicate document ids in the manifest.');
  }

  for (const doc of manifest.docs) {
    const requiredSections = DOC_SECTION_REQUIREMENTS[doc.audience] ?? [];
    for (const section of requiredSections) {
      if (!doc.sections.includes(section)) {
        errors.push(`Document "${doc.id}" is missing required section "${section}" for the "${doc.audience}" audience.`);
      }
    }
    if (doc.severity === 'required' && !doc.owner.trim()) {
      errors.push(`Required document "${doc.id}" has no named owner.`);
    }
  }

  return errors;
}

export type DocFileCheck = {
  docId: string;
  path: string;
  content: string;
  missingHeadings: DocSection[];
  present: boolean;
  ok: boolean;
};

export type DocumentationGateResult = { ok: boolean; checks: DocFileCheck[]; errors: string[] };

/** Headings are matched case-insensitively so formatted docs still count. */
export function checkDocContents(
  manifest: DocumentationManifest,
  readDoc: (path: string) => string | null
): DocumentationGateResult {
  const errors = validateManifestIntegrity(manifest);
  const checks: DocFileCheck[] = [];

  for (const doc of manifest.docs) {
    const content = readDoc(doc.path);
    if (content === null) {
      errors.push(`Document "${doc.id}" is missing at ${doc.path}.`);
      checks.push({ docId: doc.id, path: doc.path, content: '', missingHeadings: [], present: false, ok: false });
      continue;
    }

    const lower = content.toLowerCase();
    const missingHeadings = doc.sections.filter((section) => !lower.includes(DOC_SECTION_HEADINGS[section].toLowerCase()));
    for (const heading of missingHeadings) {
      errors.push(`Document "${doc.id}" is missing section "${heading}" (${DOC_SECTION_HEADINGS[heading]}).`);
    }

    checks.push({
      docId: doc.id,
      path: doc.path,
      content,
      missingHeadings,
      present: true,
      ok: missingHeadings.length === 0 && (content.trim().length > 0),
    });
  }

  return { ok: errors.length === 0 && checks.every((check) => check.ok && check.present), checks, errors };
}