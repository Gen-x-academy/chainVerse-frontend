import '@testing-library/jest-dom';

// Suppress Next.js navigation errors in tests
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/students/dashboard/scholarships',
  useSearchParams: () => new URLSearchParams(),
}));

// Silence console.error for expected test errors
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    // suppress noisy React testing warnings
    if (
      msg.includes('Warning:') ||
      msg.includes('ReactDOM.render') ||
      msg.includes('act(')
    )
      return;
    originalConsoleError(...args);
  };
});
afterEach(() => {
  console.error = originalConsoleError;
});
