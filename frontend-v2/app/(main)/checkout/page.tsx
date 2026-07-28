'use client';

import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';
import { WalletIcon } from '@/src/shared/components/ui/WalletIcon';

/**
 * Checkout / payment summary surface for the cart → pay journey.
 * CartModal navigates here after authenticated "Proceed to Checkout".
 */
export default function CheckoutPage() {
  const items = useCartStore((state) => state.items);
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Checkout</h1>
        <p className="text-gray-500 text-sm mb-8">
          Review your courses and complete payment with your Stellar wallet.
        </p>

        {items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
            <p className="text-gray-500 mb-6">Your cart is empty.</p>
            <Link
              href="/courses"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#4361EE] hover:bg-[#3651D4] text-white font-medium transition-colors"
            >
              Browse Courses
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <ul className="bg-white rounded-xl border border-gray-100 divide-y">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 px-6 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.title}</p>
                    <p className="text-sm text-gray-500">
                      Qty {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-[#627BF1] whitespace-nowrap">
                    {item.price} {item.currency}
                  </p>
                </li>
              ))}
            </ul>

            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-6">
                <span className="text-lg font-bold text-gray-900">Subtotal</span>
                <span className="text-lg font-bold text-[#627BF1]">
                  ${subtotal.toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                className="w-full gap-2 cursor-pointer flex items-center justify-center bg-[#4361EE] hover:bg-[#3651D4] h-11 rounded-lg text-white transition-colors duration-200"
              >
                <WalletIcon />
                <span className="text-base font-medium">Pay with Wallet</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
