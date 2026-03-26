import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Menu, X, User, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';

export const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);

  const navLinks = [
    { label: 'Courses', href: '/courses' },
    { label: 'Instructors', href: '/instructors' },
    { label: 'Dashboard', href: '/dashboard' },
  ];

  const closeDropdown = useCallback(() => {
    setIsDropdownOpen(false);
    dropdownTriggerRef.current?.focus();
  }, []);

  // Close menus on Escape; close dropdown on outside click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDropdownOpen) {
          closeDropdown();
        } else if (isMenuOpen) {
          setIsMenuOpen(false);
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, isMenuOpen, closeDropdown]);

  return (
    <header role="banner" className="bg-white border-b border-gray-200 sticky top-0 z-50">
      {/* Skip-to-content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-white px-3 py-1 rounded text-sm font-medium text-indigo-600 z-50"
      >
        Skip to content
      </a>

      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" aria-label="ChainVerse home" className="flex items-center gap-2">
            <div
              className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center"
              aria-hidden="true"
            >
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="font-bold text-xl text-gray-900 hidden sm:inline">ChainVerse</span>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-700 hover:text-indigo-600 font-medium transition"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Side - Profile & Mobile Menu */}
          <div className="flex items-center gap-4">
            {/* User Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                ref={dropdownTriggerRef}
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                aria-label="User account menu"
                aria-haspopup="true"
                aria-expanded={isDropdownOpen}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
              >
                <div
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline text-sm font-medium text-gray-700">Account</span>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div
                  role="menu"
                  aria-label="Account options"
                  className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50"
                >
                  <Link
                    href="/profile"
                    role="menuitem"
                    className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm"
                  >
                    <User size={16} aria-hidden="true" />
                    Profile
                  </Link>
                  <Link
                    href="/settings"
                    role="menuitem"
                    className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm"
                  >
                    <Settings size={16} aria-hidden="true" />
                    Settings
                  </Link>
                  <hr className="my-2" />
                  <button
                    role="menuitem"
                    aria-label="Log out"
                    className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 transition text-sm"
                  >
                    <LogOut size={16} aria-hidden="true" />
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-nav"
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition"
            >
              {isMenuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav
            id="mobile-nav"
            aria-label="Mobile navigation"
            className="md:hidden py-4 space-y-2 border-t border-gray-100"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
};
