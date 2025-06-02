'use client'
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/button";

export default function CheckoutPage() {
  const { items, clearCart } = useCartStore();
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>
      {items.length === 0 ? (
        <div className="text-center text-gray-500">Your cart is empty.</div>
      ) : (
        <>
          <div className="space-y-4 mb-8">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b pb-3">
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-gray-500">{item.price} {item.currency}</div>
                </div>
                <div className="text-sm">Qty: {item.quantity}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center font-bold text-lg mb-6">
            <span>Subtotal</span>
            <span>₦{subtotal.toLocaleString()}</span>
          </div>
          <Button className="w-full bg-[#4361EE] text-white" onClick={clearCart}>
            Complete Checkout
          </Button>
        </>
      )}
    </div>
  );
} 