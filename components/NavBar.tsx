"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Badge } from "./ui/badge";
import Image from "next/image";
import logo from "../public/logo.png";
import { useCartStore } from "@/store/cartStore";
import CartModal from "./CartModal";
import { Button } from "./ui/button";
import AuthPrompt from "./AuthPrompt";
import { useAuthStore } from "@/store/authStore";

const NAV_ITEMS = [
  { label: "Courses", href: "/courses" },
  { label: "Instructors", href: "/instructors" },
  { label: "About", href: "/about" },
];

const WALLET_ADDRESS = "0xfcf2....9a56";

const NavBar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [displayNavbar] = useState(pathname.split("/")[2] !== "dashboard");
  const cartCount = useCartStore((state) => state.items.length);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, user, logout } = useAuthStore();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {displayNavbar && (
        <header
          className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
            scrolled
              ? "shadow-md bg-white/90 backdrop-blur border-b border-[#F2F2F2]"
              : "bg-white border-b-2 border-[#F2F2F2]"
          }`}
        >
          <nav
            className="w-full mx-auto px-4 sm:px-8 lg:px-10 flex items-center justify-between h-24"
            aria-label="Main navigation"
          >
            {/* Logo */}
            <Link
              href="/"
              className="flex  items-center gap-2 justify-center"
              aria-label="Home"
            >
              {/* Replace with SVG if available */}
              <Image
                src={logo}
                alt="ChainVerse Academy Logo"
                width={32}
                height={32}
                className="w-8 h-8 mt-2"
              />
              <span className="text-xl font-medium  tracking-tight select-none">
                ChainVerse Academy
              </span>
            </Link>

            {/* Desktop Nav */}
            <ul className="hidden md:flex items-center justify-between gap-10">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`relative transition-colors duration-200 px-1 py-2 text-base font-medium ${
                      isActive(item.href)
                        ? " after:absolute after:left-0 after:right-0 after:-bottom-3 after:h-[3px] after:bg-[#4361EE] after:rounded-b-full after:content-[''] after:block"
                        : "text-[#0D1330] "
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Right side */}
            <div className="flex items-center gap-4 min-w-max">
              {/* card Modal */}
              <CartModal cartCount={cartCount} />
              
              {isAuthenticated ? (
                <>
                  <Badge
                    variant="secondary"
                    className="bg-[#D9DFFC] text-[#627BF1] px-4 py-2 rounded-full text-base font-medium"
                  >
                    {user?.walletAddress || WALLET_ADDRESS}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={logout}>
                    Logout
                  </Button>
                </>
              ) : (
                <div className="hidden md:flex items-center space-x-4">
                  <Link href="/login" className="flex items-center">
                    <Button variant="outline" size="lg" className="bg-[#D9DFFC] text-[#4361EE]">
                      Login
                    </Button>
                  </Link>
                </div>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="md:hidden ml-2 p-2 rounded focus:outline-none focus:ring-2 focus:ring-[#4361EE]"
                aria-label="Open menu"
                aria-expanded={mobileOpen}
              >
                <Menu size={28} className="text-[#4361EE]" />
              </button>
            </div>
          </nav>

          {/* Mobile Menu */}
          <div
            className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
              mobileOpen ? "block" : "hidden"
            }`}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <nav
            className={`fixed top-0 right-0 w-64 h-full bg-white shadow-lg z-50 transform transition-transform duration-200 ${
              mobileOpen ? "translate-x-0" : "translate-x-full"
            } md:hidden`}
            aria-label="Mobile navigation"
          >
            <div className="flex flex-col gap-2 p-6 pt-24">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`block px-3 py-3 rounded-lg text-lg font-medium transition-colors duration-200 ${
                    isActive(item.href)
                      ? "text-[#4361EE] bg-[#E9EDFB]"
                      : "text-gray-800 hover:text-[#4361EE] hover:bg-[#F2F2F2]"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
      )}
      <AuthPrompt />
    </>
  );
};

export default NavBar;
