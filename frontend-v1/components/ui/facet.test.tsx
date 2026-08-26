import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Facet, FacetOption } from './facet';

const mockOptions: FacetOption[] = [
  { value: 'video', label: 'Video Course', count: 15 },
  { value: 'book', label: 'eBook', count: 8 },
  { value: 'audio', label: 'Audio Book', count: 5 },
  { value: 'workshop', label: 'Workshop', count: 3, disabled: true, disabledReason: 'Coming soon' },
];

describe('Facet Component', () => {
  const mockOnChange = jest.fn();
  
  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders the facet title and options correctly', () => {
    render(
      <Facet
        title="Format"
        options={mockOptions}
        selectedValues={[]}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Format')).toBeInTheDocument();
    expect(screen.getByText('Video Course (15)')).toBeInTheDocument();
    expect(screen.getByText('eBook (8)')).toBeInTheDocument();
    expect(screen.getByText('Audio Book (5)')).toBeInTheDocument();
  });

  it('allows selecting an option', () => {
    render(
      <Facet
        title="Format"
        options={mockOptions}
        selectedValues={[]}
        onChange={mockOnChange}
      />
    );

    const videoCheckbox = screen.getByLabelText('Video Course');
    fireEvent.click(videoCheckbox);
    
    expect(mockOnChange).toHaveBeenCalledWith(['video']);
  });

  it('allows deselecting an option', () => {
    render(
      <Facet
        title="Format"
        options={mockOptions}
        selectedValues={['video']}
        onChange={mockOnChange}
      />
    );

    const videoCheckbox = screen.getByLabelText('Video Course');
    fireEvent.click(videoCheckbox);
    
    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it('prevents selecting disabled options', () => {
    render(
      <Facet
        title="Format"
        options={mockOptions}
        selectedValues={[]}
        onChange={mockOnChange}
      />
    );

    const workshopCheckbox = screen.getByLabelText('Workshop');
    expect(workshopCheckbox).toBeDisabled();
    
    fireEvent.click(workshopCheckbox);
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('displays selected filters as removable badges', () => {
    render(
      <Facet
        title="Format"
        options={mockOptions}
        selectedValues={['video', 'book']}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Video Course')).toBeInTheDocument();
    expect(screen.getByText('eBook')).toBeInTheDocument();
    
    // Remove video filter
    const removeButton = screen.getAllByRole('button', { name: /remove/i })[0];
    fireEvent.click(removeButton);
    
    expect(mockOnChange).toHaveBeenCalledWith(['book']);
  });

  it('allows clearing all selected filters', () => {
    render(
      <Facet
        title="Format"
        options={mockOptions}
        selectedValues={['video', 'book']}
        onChange={mockOnChange}
      />
    );

    const clearAllButton = screen.getByText('Clear all');
    fireEvent.click(clearAllButton);
    
    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it('collapses and expands when clicked', () => {
    render(
      <Facet
        title="Format"
        options={mockOptions}
        selectedValues={[]}
        onChange={mockOnChange}
        defaultCollapsed={false}
      />
    );

    // Initially expanded - options are visible
    expect(screen.getByText('Video Course')).toBeInTheDocument();
    
    // Click to collapse
    fireEvent.click(screen.getByText('Format'));
    
    // After collapse - options should not be visible (in DOM but not rendered)
    // The chevron should rotate
    const chevron = screen.getByRole('button', { name: /collapse/i });
    expect(chevron).toHaveClass('rotate-180');
  });

  it('shows loading state correctly', () => {
    render(
      <Facet
        title="Format"
        options={mockOptions}
        selectedValues={[]}
        onChange={mockOnChange}
        isLoading={true}
      />
    );

    // Should show skeleton loaders instead of actual options
    const skeletons = screen.getAllByRole('status');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error state correctly', () => {
    render(
      <Facet
        title="Format"
        options={mockOptions}
        selectedValues={[]}
        onChange={mockOnChange}
        error="Failed to load options"
      />
    );

    expect(screen.getByText('Failed to load options')).toBeInTheDocument();
  });

  it('shows empty state correctly when no options available', () => {
    render(
      <Facet
        title="Format"
        options={[]}
        selectedValues={[]}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('No options available')).toBeInTheDocument();
  });
});