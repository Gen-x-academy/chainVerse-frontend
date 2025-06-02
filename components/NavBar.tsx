"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {  Menu, ShoppingCart,Trash2Icon } from "lucide-react";
import { Badge } from "./ui/badge";
import Image from "next/image";
import logo from "../public/logo.png";
import { useCartStore } from "@/store/cartStore";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {displayNavbar && (
        <header className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${scrolled ? "shadow-md bg-white/90 backdrop-blur border-b border-[#F2F2F2]" : "bg-white border-b-2 border-[#F2F2F2]"}`}>
          <nav className="w-full mx-auto px-4 sm:px-8 lg:px-10 flex items-center justify-between h-24" aria-label="Main navigation">
            {/* Logo */}
            <Link href="/" className="flex  items-center gap-2 justify-center" aria-label="Home">
              {/* Replace with SVG if available */}
              <Image src={logo} alt="ChainVerse Academy Logo" width={32} height={32} className="w-8 h-8 mt-2" />
              <span className="text-xl font-medium  tracking-tight select-none">ChainVerse Academy</span>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="relative flex cursor-pointer items-center justify-center w-10 h-10 rounded-full bg-[#E5E5E5]">
                    <ShoppingCart className="relative w-5 h-5 text-[#4D4D4D]" />
                    {cartCount > 0 && (
                      <span className="absolute top-0 right-0 bg-[#4361EE] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                        {cartCount}
                      </span>
                    )}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="bg-white w-80 mt-4 p-0">
                  <div className="p-4 max-h-[330px] overflow-y-auto ">
                    {cartCount === 0 ? (
                      <div className="flex  flex-col items-center justify-center py-8">
                        <img src="/empty-cart.svg" alt="Empty Cart" className="w-24 mb-2" />
                        <p className="text-gray-500 mb-2">Empty Cart</p>
                        <Button onClick={() => window.location.href = '/courses'}>Browse Courses</Button>
                      </div>
                    ) : (
                      <div className=" ">
                        {useCartStore.getState().items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between border-b py-4 last:border-b-0">
                            <div>
                              <div className="font-medium text-base text-[#0D1330] line-clamp-1 max-w-[140px]">{item.title}</div>
                              <div className="text-sm font-medium text-[#B2B2B2]">{item.price} {item.currency}</div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => useCartStore.getState().removeFromCart(item.id)} aria-label="Remove">
                              {/* <svg width="18" height="18" fill="#000" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> */}
                              <Trash2Icon className="w-8 text-black h-8"/>
                            </Button>
                          </div>
                        ))}
                       
                      </div>
                    )}
                  </div>
                  {cartCount > 0  &&
                  <div className="p-4 flex flex-col">
                     <div className="flex justify-between items-center py-4 font-bold text-sm">
                          <span className="text-lg ">Subtotal</span>
                          <span className="text-[#627BF1] text-lg">
                          ${useCartStore.getState().items.reduce((sum, i) => sum + i.price * i.quantity, 0).toLocaleString()}
                          </span>
                        </div>
                        <button className="w-full mb-3 bg-[#4361EE] h-11 rounded-lg  text-white" onClick={() => window.location.href = '/checkout'}>
                          <span className="text-[15px] font-medium ">Proceed to Checkout </span>
                        </button>
                  </div>
                    }
                 
                </DropdownMenuContent>
              </DropdownMenu>
              <Badge variant="secondary" className="bg-[#D9DFFC] text-[#627BF1] px-4 py-2 rounded-full text-base font-medium">
                {WALLET_ADDRESS}
              </Badge>
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
            className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${mobileOpen ? "block" : "hidden"}`}
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <nav
            className={`fixed top-0 right-0 w-64 h-full bg-white shadow-lg z-50 transform transition-transform duration-200 ${mobileOpen ? "translate-x-0" : "translate-x-full"} md:hidden`}
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
    </>
  );
};

export default NavBar;
