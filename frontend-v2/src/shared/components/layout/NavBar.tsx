'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib';
import { ConnectWalletButton } from '@/src/shared/components/ConnectWalletButton';
import { colors } from '@/src/shared/constants/design-tokens';
import { useAuthStore } from '@/src/store/authStore';

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => { setIsOpen(false); }, [pathname]);

  const toggleMenu = () => setIsOpen(!isOpen);

  // Build nav links based on auth state and role (closes #732)
  const navLinks: { href: string; label: string }[] = (() => {
    if (!isAuthenticated) {
      return [
        { href: '/login', label: 'Login' },
        { href: '/register', label: 'Register' },
      ];
    }
    if (user?.role === 'instructor') {
      return [
        { href: '/instructors/dashboard', label: 'Instructor Dashboard' },
        { href: '/courses', label: 'My Courses' },
      ];
    }
    // student (and admin fallback)
    return [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/my-courses', label: 'My Courses' },
    ];
  })();

  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK;

  return (
    <nav className="bg-white border-b border-gray-200" style={{ '--dt-primary': colors.primary } as React.CSSProperties}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo Section */}
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-blue-600">
              ChainVerse
            </Link>
            {network === 'testnet' && (
              <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                TESTNET
              </span>
            )}
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-y-0 space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-gray-600 hover:text-[var(--dt-primary)] transition-colors font-medium',
                  // Highlight active route with primary colour + bottom border (#733)
                  pathname === link.href && 'text-[var(--dt-primary)] font-semibold border-b-2 border-[var(--dt-primary)]'
                )}
              >
                {link.label}
              </Link>
            ))}
            <ConnectWalletButton />
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={toggleMenu}
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus-ring min-h-[44px] min-w-[44px]"
              aria-controls="mobile-menu"
              aria-expanded={isOpen}
            >
              <span className="sr-only">{isOpen ? 'Close main menu' : 'Open main menu'}</span>
              {/* Hamburger Icon */}
              <svg
                className={cn("h-6 w-6 transition-transform", isOpen ? "rotate-90" : "rotate-0")}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
        )}
        id="mobile-menu"
        aria-hidden={!isOpen}
      >
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-100">
          {/* Auth-aware links: unauthenticated → Login/Register; student → Dashboard/My Courses; instructor → Instructor Dashboard/My Courses (#732) */}
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                'block px-3 py-4 rounded-md text-base font-medium text-gray-700 hover:text-[var(--dt-primary)] hover:bg-gray-50',
                pathname === link.href && 'text-[var(--dt-primary)] font-semibold bg-blue-50'
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="px-3 py-4">
            <ConnectWalletButton />
          </div>
        </div>
      </div>
    </nav>
  );
};