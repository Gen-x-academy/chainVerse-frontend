import { useCartStore } from "@/store/cartStore";
import { Button } from "./ui/button";
import { ShoppingCart, Trash2Icon } from "lucide-react";
import { WalletIcon } from "./ui/WalletIcon";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/authStore";
import { useState, useEffect } from "react";

export default function CartModal({ cartCount }: { cartCount: number }) {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const setRequiresAuth = useCartStore((state) => state.setRequiresAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isOpen, setIsOpen] = useState(false);

  // Add effect to handle body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  const handleCheckout = () => {
    if (!isAuthenticated) {
      setRequiresAuth(true);
      setIsOpen(false);
    } else {
      router.push("/checkout");
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
      <div className="mr-2">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <div className="relative flex cursor-pointer items-center justify-center w-10 h-10 rounded-full bg-[#E5E5E5] hover:bg-[#D5D5D5] transition-colors duration-200">
            <ShoppingCart className="relative w-5 h-5 text-[#4D4D4D]" />
            {cartCount > 0 && (
              <span className="absolute top-0 right-0 bg-[#4361EE] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="bg-white w-80 mt-4 p-0 z-50 rounded-lg shadow-lg transition-all duration-300 ease-in-out max-h-[390px] overflow-y-auto"
        >
          {cartCount === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-8">
              <Image
                src="/empty-cart.svg"
                alt="Empty Cart"
                width={120}
                height={120}
                className="w-22 mb-4"
              />
              <p className="text-gray-500 mb-4 text-lg">Your cart is empty</p>
              <Button
                onClick={() => router.push("/courses")}
                className="bg-[#4361EE] hover:bg-[#3651D4] transition-colors duration-200"
              >
                Browse Courses
              </Button>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto p-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border-b py-4 last:border-b-0"
                  >
                    <Image
                      src={item.image}
                      alt={item.title}
                      width={50}
                      height={50}
                      className="w-12 h-12 rounded-md object-cover mr-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-base text-[#0D1330] line-clamp-1">
                        {item.title}
                      </div>
                      <div className="text-sm font-medium text-[#B2B2B2]">
                        {item.price} {item.currency}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromCart(item.id)}
                      aria-label="Remove"
                      className="hover:bg-gray-100 transition-colors duration-200"
                    >
                      <Trash2Icon className="w-5 h-5 text-gray-500" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t bg-white">
                <div className="flex justify-between items-center py-4 font-bold text-sm">
                  <span className="text-lg">Subtotal</span>
                  <span className="text-[#627BF1] text-lg">
                    $
                    {items
                      .reduce((sum: number, i: { price: number; quantity: number }) => sum + i.price * i.quantity, 0)
                      .toLocaleString()}
                  </span>
                </div>
                <button
                  className="w-full gap-2 mb-3 cursor-pointer flex items-center justify-center bg-[#4361EE] hover:bg-[#3651D4] h-11 rounded-lg text-white transition-colors duration-200"
                  onClick={handleCheckout}
                >
                  <WalletIcon />
                  <span className="text-base font-medium">
                    Proceed to Checkout
                  </span>
                </button>
              </div>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    
    </>
  );
}
