import React from 'react';
import Link from 'next/link';
import { Facebook, Twitter, Linkedin, Github, Mail } from 'lucide-react';
import { NewsletterSignup } from '@/src/features/marketing/components/NewsletterSignup';

export const Footer: React.FC = () => {
  const links = {
    product: [
      { label: 'Features', href: '#' },
      { label: 'Pricing', href: '#' },
      { label: 'Security', href: '#' },
      { label: 'Status', href: '#' },
    ],
    company: [
      { label: 'About', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Press', href: '#' },
    ],
    resources: [
      { label: 'Documentation', href: '#' },
      { label: 'Community', href: '#' },
      { label: 'Contact', href: '/contact' },
      { label: 'Support', href: '#' },
    ],
    legal: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '#' },
      { label: 'Cookie Policy', href: '#' },
      { label: 'Compliance', href: '#' },
    ],
  };

  const socials = [
    { icon: Facebook, label: 'Facebook', href: '#' },
    { icon: Twitter, label: 'Twitter', href: '#' },
    { icon: Linkedin, label: 'LinkedIn', href: '#' },
    { icon: Github, label: 'GitHub', href: '#' },
    { icon: Mail, label: 'Email', href: '#' },
  ];

  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12 pb-12 border-b border-gray-800">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">C</span>
              </div>
              <span className="font-bold text-lg text-white">ChainVerse</span>
            </div>
            <p className="text-sm text-gray-400">
              Learn blockchain, DeFi, and Web3 from industry experts.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Product</h4>
            <ul className="space-y-2">
              {links.product.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-white transition text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-2">
              {links.company.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-gray-400 hover:text-white transition text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Resources</h4>
            <ul className="space-y-2">
              {links.resources.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("/") ? (
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-white transition text-sm"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="text-gray-400 hover:text-white transition text-sm"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2">
              {links.legal.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith("/") ? (
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-white transition text-sm"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      href={link.href}
                      className="text-gray-400 hover:text-white transition text-sm"
                    >
                      {link.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between">
          <p className="text-gray-400 text-sm mb-4 md:mb-0">
            © 2026 ChainVerse Academy. All rights reserved.
          </p>

          <div className="flex items-center gap-4">
            {socials.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.label}
                  href={social.href}
                  className="text-gray-400 hover:text-white transition"
                  aria-label={social.label}
                >
                  <Icon size={20} />
                </a>
              );
            })}
          </div>
        </div>

        <div className="mt-12 pt-12 border-t border-gray-800">
          <NewsletterSignup />
        </div>
      </div>
    </footer>
  );
};
