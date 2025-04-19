'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from './button';
import Image from 'next/image';
import logo from '../../public/Vector (1).png';
import { Menu, Wallet } from 'lucide-react';

const NavBar: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <header className="p-2 shadow-md bg-white">
      <nav className="container mx-auto flex justify-between items-center">
        {/* Logo and Toggle Icon */}
        <div className="flex items-center space-x-2">
          <Link
            href="/"
            className="text-black text-lg font-bold flex items-center"
          >
            <Image
              src={logo}
              alt="Logo"
              className="h-6"
              width={24}
              height={24}
            />
            <span className="ml-2">ChainVerse Academy</span>
          </Link>
        </div>

        {/* Navigation Links (Visible on lg screens only) */}
        <ul className="hidden lg:flex space-x-2">
          {['Courses', 'Instructors', 'About'].map((item) => (
            <li key={item} className="p-2 flex items-center">
              <Link
                href={`/${item.toLowerCase()}`}
                className="text-black text-sm"
              >
                {item}
              </Link>
            </li>
          ))}
        </ul>
        <button
          onClick={toggleMobileMenu}
          className=" text-black block lg:hidden"
        >
          <Menu size={24} />
        </button>

        {/* Authentication Buttons (Visible on md and lg screens) */}

        <div className="hidden md:flex items-center space-x-4">
          <Link href="/login" className="flex items-center">
            <Button variant="outline" size="sm">
              Login
            </Button>
          </Link>
          <div className="flex items-center">
            <Button variant="outline" size="sm">
              <Wallet size={16} />
              <span>Connect Wallet</span>
            </Button>
          </div>
          <Button className="bg-primary text-white" size="sm">
            <Link href="/register" className="flex items-center">
              Register
            </Link>
          </Button>
        </div>

        {/* Mobile Menu (sm and md) */}

        <div
          className={`${
            isMobileMenuOpen ? 'block' : 'hidden'
          } lg:hidden absolute top-full left-0 w-full bg-white shadow-md z-50`}
        >
          {['Courses', 'Instructors', 'About'].map((item) => (
            <Link
              key={item}
              href={`/${item.toLowerCase()}`}
              className="block p-2 text-black text-sm border-b"
            >
              {item}
            </Link>
          ))}
        </div>

        {/* Small screen buttons (Logo, Menu, Register only) */}

        <div className="flex md:hidden items-center">
          <Link href="/register" className="flex items-center">
            <Button className="bg-primary text-white" size="sm">
              Register
            </Button>
          </Link>
        </div>
      </nav>
    </header>
  );
};

export default NavBar;
