import { useCartStore } from "@/store/cartStore";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export default function CartModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, removeFromCart } = useCartStore();
  const router = useRouter();

  if (!open) return null;

  return (
    <div className="fixed top-0 right-0 w-full h-full bg-black/40 z-50 flex justify-end">
      <div className="bg-white w-full max-w-sm h-full shadow-lg p-6 flex flex-col">
        <h2 className="text-lg font-bold mb-4">Cart</h2>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <img src="/empty-cart.svg" alt="Empty Cart" className="w-32 mb-4" />
              <p className="text-gray-500 mb-2">Empty Cart</p>
              <Button onClick={() => { onClose(); router.push('/courses'); }}>
                Browse Courses
              </Button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b py-3">
                <div>
                  <div className="font-medium">{item.title}</div>
                  <div className="text-sm text-gray-500">{item.price} {item.currency}</div>
                </div>
                <Button variant="ghost" onClick={() => removeFromCart(item.id)}>
                  🗑️
                </Button>
              </div>
            ))
          )}
        </div>
        {items.length > 0 && (
          <>
            <div className="flex justify-between items-center py-4 font-bold">
              <span>Subtotal</span>
              <span>
                ₦{items.reduce((sum, i) => sum + i.price * i.quantity, 0).toLocaleString()}
              </span>
            </div>
            <Button className="w-full bg-[#4361EE] text-white" onClick={() => { onClose(); router.push('/checkout'); }}>
              Proceed to Checkout
            </Button>
          </>
        )}
      </div>
      <div className="fixed inset-0" onClick={onClose} />
    </div>
  );
} 