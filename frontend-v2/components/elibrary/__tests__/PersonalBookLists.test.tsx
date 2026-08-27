import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PersonalBookLists } from '../PersonalBookLists';
import { useBookListsStore } from '@/src/store/booklists-store';
import { toast } from '@/components/ui/use-toast';

// Mock the store
jest.mock('@/src/store/booklists-store', () => ({
  useBookListsStore: jest.fn(),
}));

// Mock toast
jest.mock('@/components/ui/use-toast', () => ({
  toast: jest.fn(),
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(true),
  },
});

describe('PersonalBookLists', () => {
  const mockCreateList = jest.fn();
  const mockRenameList = jest.fn();
  const mockDeleteList = jest.fn();
  const mockAddBookToList = jest.fn();
  const mockRemoveBookFromList = jest.fn();
  const mockReorderBooks = jest.fn();
  const mockTogglePrivacy = jest.fn();
  const mockGenerateShareLink = jest.fn();
  const mockGetList = jest.fn();
  const mockClearError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useBookListsStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        lists: [
          {
            id: 'list-1',
            name: 'Test List',
            isPrivate: true,
            items: [
              { id: 'book-1', title: 'Test Book', author: 'Test Author', addedAt: Date.now() },
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        isLoading: false,
        error: null,
        createList: mockCreateList,
        renameList: mockRenameList,
        deleteList: mockDeleteList,
        addBookToList: mockAddBookToList,
        removeBookFromList: mockRemoveBookFromList,
        reorderBooks: mockReorderBooks,
        togglePrivacy: mockTogglePrivacy,
        generateShareLink: mockGenerateShareLink,
        getList: mockGetList,
        clearError: mockClearError,
      };
      return selector ? selector(state) : state;
    });
  });

  it('renders empty state when there are no lists', () => {
    (useBookListsStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        lists: [],
        isLoading: false,
        error: null,
      };
      return selector ? selector(state) : state;
    });

    render(<PersonalBookLists />);
    expect(screen.getByText('No book lists yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first list')).toBeInTheDocument();
  });

  it('renders list cards when lists exist', () => {
    render(<PersonalBookLists />);
    expect(screen.getByText('My Book Lists')).toBeInTheDocument();
    expect(screen.getByText('Test List')).toBeInTheDocument();
    expect(screen.getByText('1 book')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new list/i })).toBeInTheDocument();
  });

  it('opens create list dialog when new list button is clicked', () => {
    render(<PersonalBookLists />);
    fireEvent.click(screen.getByRole('button', { name: /new list/i }));
    expect(screen.getByText('Create new book list')).toBeInTheDocument();
  });

  it('creates a new list successfully', async () => {
    mockCreateList.mockResolvedValue({ id: 'list-2', name: 'New List', isPrivate: true, items: [], createdAt: Date.now(), updatedAt: Date.now() });
    
    render(<PersonalBookLists />);
    fireEvent.click(screen.getByRole('button', { name: /new list/i }));
    
    const input = screen.getByPlaceholderText('e.g., Summer Reading');
    fireEvent.change(input, { target: { value: 'New List' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }));
    
    await waitFor(() => {
      expect(mockCreateList).toHaveBeenCalledWith('New List');
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'List created' }));
    });
  });

  it('opens list detail view when list card is clicked', () => {
    render(<PersonalBookLists />);
    fireEvent.click(screen.getByText('Test List'));
    expect(screen.getByText('← Back to all lists')).toBeInTheDocument();
    expect(screen.getByText('Test Book')).toBeInTheDocument();
    expect(screen.getByText('Test Author')).toBeInTheDocument();
  });

  it('prevents adding duplicate books', async () => {
    mockAddBookToList.mockRejectedValue(new Error('Book already exists'));
    
    render(<PersonalBookLists />);
    fireEvent.click(screen.getByText('Test List'));
    fireEvent.click(screen.getByRole('button', { name: /add book/i }));
    
    const titleInput = screen.getByPlaceholderText('Book title');
    const authorInput = screen.getByPlaceholderText('Author name');
    fireEvent.change(titleInput, { target: { value: 'Test Book' } });
    fireEvent.change(authorInput, { target: { value: 'Test Author' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Add book' }));
    
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error', variant: 'destructive' }));
    });
  });

  it('requires confirmation for deleting a list', async () => {
    mockDeleteList.mockResolvedValue(undefined);
    
    render(<PersonalBookLists />);
    fireEvent.click(screen.getByText('Test List'));
    
    // Click delete button
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    
    // Confirmation dialog should appear
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    
    // Confirm deletion
    fireEvent.click(screen.getByRole('button', { name: 'Delete list' }));
    
    await waitFor(() => {
      expect(mockDeleteList).toHaveBeenCalledWith('list-1');
    });
  });

  it('toggles privacy settings explicitly', async () => {
    mockTogglePrivacy.mockResolvedValue(undefined);
    
    render(<PersonalBookLists />);
    fireEvent.click(screen.getByText('Test List'));
    
    const privacySwitch = screen.getByRole('switch');
    expect(privacySwitch).not.toBeChecked(); // isPrivate = true
    
    fireEvent.click(privacySwitch);
    
    await waitFor(() => {
      expect(mockTogglePrivacy).toHaveBeenCalledWith('list-1');
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Privacy updated' }));
    });
  });

  it('generates and copies share link', async () => {
    mockGenerateShareLink.mockResolvedValue('http://localhost/shared/lists/abc123');
    
    render(<PersonalBookLists />);
    fireEvent.click(screen.getByText('Test List'));
    
    fireEvent.click(screen.getByRole('button', { name: /share/i }));
    
    await waitFor(() => {
      expect(mockGenerateShareLink).toHaveBeenCalledWith('list-1');
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost/shared/lists/abc123');
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Share link copied' }));
    });
  });

  it('removes a book from the list', async () => {
    mockRemoveBookFromList.mockResolvedValue(undefined);
    
    render(<PersonalBookLists />);
    fireEvent.click(screen.getByText('Test List'));
    
    const deleteBookButton = screen.getByRole('button', { name: '', title: '' }); // Trash icon button
    fireEvent.click(deleteBookButton);
    
    await waitFor(() => {
      expect(mockRemoveBookFromList).toHaveBeenCalledWith('list-1', 'book-1');
    });
  });

  it('renames a list successfully', async () => {
    mockRenameList.mockResolvedValue(undefined);
    
    render(<PersonalBookLists />);
    fireEvent.click(screen.getByText('Test List'));
    
    // Click edit button
    const editButton = screen.getByRole('button', { name: '', title: '' }); // Edit icon button
    fireEvent.click(editButton);
    
    const renameInput = screen.getByDisplayValue('Test List');
    fireEvent.change(renameInput, { target: { value: 'Updated List Name' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    
    await waitFor(() => {
      expect(mockRenameList).toHaveBeenCalledWith('list-1', 'Updated List Name');
    });
  });

  it('displays loading state when isLoading is true', () => {
    (useBookListsStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        lists: [
          { id: 'list-1', name: 'Test List', isPrivate: true, items: [], createdAt: Date.now(), updatedAt: Date.now() },
        ],
        isLoading: true,
        error: null,
      };
      return selector ? selector(state) : state;
    });

    render(<PersonalBookLists />);
    const skeletons = screen.getAllByRole('status');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('displays error state when there is an error', () => {
    (useBookListsStore as unknown as jest.Mock).mockImplementation((selector) => {
      const state = {
        lists: [],
        isLoading: false,
        error: 'Failed to load lists',
        clearError: mockClearError,
      };
      return selector ? selector(state) : state;
    });

    render(<PersonalBookLists />);
    expect(screen.getByText('Failed to load lists')).toBeInTheDocument();
    expect(mockClearError).toHaveBeenCalled();
  });
});