import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FacetedFilter } from '../FacetedFilter';
import type { Facet } from '../FacetedFilter';

const facets: Facet[] = [
  {
    key: 'format',
    label: 'Format',
    options: [
      { value: 'print', label: 'Print', count: 120 },
      { value: 'audiobook', label: 'Audiobook', count: 0 },
    ],
  },
];

describe('FacetedFilter', () => {
  it('renders facet groups with values and counts', () => {
    render(<FacetedFilter facets={facets} selected={{}} onChange={vi.fn()} />);

    expect(screen.getByRole('group', { name: 'Format' })).toBeInTheDocument();
    expect(screen.getByText('Print')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
  });

  it('renders a zero-count selected option so it remains removable', () => {
    const onChange = vi.fn();
    render(
      <FacetedFilter facets={facets} selected={{ format: ['audiobook'] }} onChange={onChange} />
    );

    const checkbox = screen.getByRole('checkbox', { name: /audiobook/i });
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({ format: [] });
  });

  it('exposes a busy loading state and an alert on failure', () => {
    const { rerender } = render(
      <FacetedFilter facets={[]} selected={{}} onChange={vi.fn()} isLoading />
    );
    expect(screen.getByLabelText('Loading filters')).toHaveAttribute('aria-busy', 'true');

    rerender(<FacetedFilter facets={[]} selected={{}} onChange={vi.fn()} error="Request failed" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Request failed');
  });
});
