"use client";
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

const isValidObjectId = (value?: string) =>
  !value || /^[a-f\d]{24}$/i.test(value);

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const pruneInvalidItems = useCartStore((state) => state.pruneInvalidItems);

  useEffect(() => {
    pruneInvalidItems();
  }, [pruneInvalidItems]);

  const validItems = useMemo(
    () => items.filter((item) => isValidObjectId(item.courseId)),
    [items]
  );

  const invalidItems = useMemo(
    () => items.filter((item) => !isValidObjectId(item.courseId)),
    [items]
  );

  const subtotal = validItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>
      {validItems.length === 0 ? (
        <div className="text-center text-gray-500">Your cart is empty.</div>
      ) : (
        <>
          {invalidItems.length > 0 && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            >
              Some cart items had invalid course IDs and were skipped before
              checkout.
            </div>
          )}
          <div className="space-y-4 mb-8">
            {validItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b pb-3"
              >
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-gray-500">
                    {item.price} {item.currency}
                  </div>
                </div>
                <div className="text-sm">Qty: {item.quantity}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center font-bold text-lg mb-6">
            <span>Subtotal</span>
            <span>₦{subtotal.toLocaleString()}</span>
          </div>
          <Button
            className="w-full bg-[#4361EE] h-11 text-white"
            onClick={() => {
              // Handle checkout logic here
              alert("Checkout complete!");
              clearCart();
              router.push("/courses");
            }}
          >
            <span className="text-base font-medium ">Complete Checkout</span>
          </Button>
        </>
      )}
    </div>
  );
}
