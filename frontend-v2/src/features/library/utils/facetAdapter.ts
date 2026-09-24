/**
 * Single facet adapter shared by every catalog entry point.
 *
 * Facet values and counts are sourced from the `/library/catalog/search`
 * response, persisted in the URL (`?facet[key]=value`) and merged with the
 * active query cache so selected values always remain visible and removable.
 */

import type { CatalogFacet, CatalogFacetOption } from '../types/catalog.types';
import type { Facet, FacetOption } from '../components/FacetedFilter';

export const FACET_PARAM_PREFIX = 'facet[';

const FACET_PARAM_PATTERN = /^facet\[(.+)\]$/;

/** Query-string key used to persist a selected facet value in the URL. */
export function facetParamKey(key: string): string {
  return `${FACET_PARAM_PREFIX}${key}]`;
}

/** Turn `before-2022` / `publication_year` into `Before 2022` / `Publication Year`. */
export function humanizeFacetValue(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Minimal shape shared by `URLSearchParams` and Next's readonly wrapper. */
export interface FacetParamsLike {
  forEach(callback: (value: string, key: string) => void): void;
}

/** Read the selected facets encoded as `facet[key]=value` URL parameters. */
export function parseFacetsFromParams(params: FacetParamsLike): Record<string, string[]> {
  const selected: Record<string, string[]> = {};

  params.forEach((value, key) => {
    const match = FACET_PARAM_PATTERN.exec(key);
    if (!match || !value) return;

    const facetKey = match[1];
    const values = selected[facetKey] ?? (selected[facetKey] = []);
    if (!values.includes(value)) values.push(value);
  });

  return selected;
}

/** Write selected facets onto `params` as repeated `facet[key]=value` entries. */
export function appendFacetParams(
  params: URLSearchParams,
  selected: Record<string, string[]>
): URLSearchParams {
  for (const [key, values] of Object.entries(selected)) {
    for (const value of values) {
      if (value) params.append(facetParamKey(key), value);
    }
  }
  return params;
}

function normalizeOption(raw: CatalogFacetOption): FacetOption {
  return {
    value: raw.value,
    label: raw.label || humanizeFacetValue(raw.value),
    count: Number.isFinite(raw.count) ? raw.count : 0,
  };
}

/**
 * Map backend facet values and counts into the UI facet shape.
 *
 * Selected values that are absent from the response (for example because the
 * current filter combination dropped them to a zero count) are re-injected
 * with `count: 0` so the user can always remove them.
 */
export function adaptFacets(
  responseFacets: CatalogFacet[] | null | undefined,
  selected: Record<string, string[]> = {}
): Facet[] {
  const facets = new Map<string, Facet>();

  for (const facet of responseFacets ?? []) {
    if (!facet?.key) continue;
    facets.set(facet.key, {
      key: facet.key,
      label: facet.label || humanizeFacetValue(facet.key),
      options: (facet.options ?? []).map(normalizeOption),
    });
  }

  for (const [key, values] of Object.entries(selected)) {
    let facet = facets.get(key);
    if (!facet) {
      facet = { key, label: humanizeFacetValue(key), options: [] };
      facets.set(key, facet);
    }

    const present = new Set(facet.options.map((option) => option.value));
    for (const value of values) {
      if (!value || present.has(value)) continue;
      facet.options.push({ value, label: humanizeFacetValue(value), count: 0 });
      present.add(value);
    }
  }

  return Array.from(facets.values());
}
