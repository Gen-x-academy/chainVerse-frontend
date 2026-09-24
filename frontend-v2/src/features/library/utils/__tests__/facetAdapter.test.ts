import { describe, expect, it } from 'vitest';
import { adaptFacets, appendFacetParams, parseFacetsFromParams } from '../facetAdapter';
import type { CatalogFacet } from '../../types/catalog.types';

describe('parseFacetsFromParams', () => {
  it('reads repeated facet[key] params and ignores unrelated params', () => {
    const params = new URLSearchParams(
      'q=dune&facet[format]=print&facet[format]=ebook&facet[genre]=fiction'
    );

    expect(parseFacetsFromParams(params)).toEqual({
      format: ['print', 'ebook'],
      genre: ['fiction'],
    });
  });

  it('dedupes repeated values and skips blanks', () => {
    const params = new URLSearchParams(
      'facet[format]=print&facet[format]=print&facet[format]='
    );

    expect(parseFacetsFromParams(params)).toEqual({ format: ['print'] });
  });

  it('returns an empty map when no facet params are present', () => {
    expect(parseFacetsFromParams(new URLSearchParams('q=react'))).toEqual({});
  });
});

describe('appendFacetParams', () => {
  it('serializes selected facets without mutating unrelated params', () => {
    const params = appendFacetParams(new URLSearchParams('q=dune'), {
      format: ['print', 'ebook'],
      genre: ['fiction'],
    });

    expect(params.getAll('facet[format]')).toEqual(['print', 'ebook']);
    expect(params.getAll('facet[genre]')).toEqual(['fiction']);
    expect(params.get('q')).toBe('dune');
  });

  it('skips empty values', () => {
    const params = appendFacetParams(new URLSearchParams(), { format: ['', 'print'] });

    expect(params.getAll('facet[format]')).toEqual(['print']);
  });
});

describe('adaptFacets', () => {
  const response: CatalogFacet[] = [
    {
      key: 'format',
      label: 'Format',
      options: [
        { value: 'print', label: 'Print', count: 12 },
        { value: 'ebook', label: 'E-book', count: 4 },
      ],
    },
  ];

  it('maps backend values, labels, and counts into UI facets', () => {
    expect(adaptFacets(response, {})).toEqual([
      {
        key: 'format',
        label: 'Format',
        options: [
          { value: 'print', label: 'Print', count: 12 },
          { value: 'ebook', label: 'E-book', count: 4 },
        ],
      },
    ]);
  });

  it('keeps selected values that dropped to zero count so they stay removable', () => {
    const facets = adaptFacets(response, { format: ['audiobook'] });
    const format = facets.find((facet) => facet.key === 'format');

    expect(format?.options).toContainEqual({
      value: 'audiobook',
      label: 'Audiobook',
      count: 0,
    });
  });

  it('keeps selected values whose entire facet is missing from the response', () => {
    expect(adaptFacets(undefined, { genre: ['scifi'] })).toEqual([
      {
        key: 'genre',
        label: 'Genre',
        options: [{ value: 'scifi', label: 'Scifi', count: 0 }],
      },
    ]);
  });

  it('handles a missing facets payload without throwing', () => {
    expect(adaptFacets(undefined, {})).toEqual([]);
    expect(adaptFacets(null)).toEqual([]);
  });

  it('humanizes labels when the backend omits them', () => {
    const facets = adaptFacets(
      [
        {
          key: 'publication_year',
          label: '',
          options: [{ value: 'before-2022', label: '', count: 3 }],
        },
      ],
      {}
    );

    expect(facets[0].label).toBe('Publication Year');
    expect(facets[0].options[0].label).toBe('Before 2022');
  });

  it('does not duplicate a selected value already present in the response', () => {
    const facets = adaptFacets(response, { format: ['print'] });

    expect(facets[0].options.filter((option) => option.value === 'print')).toHaveLength(1);
  });
});
