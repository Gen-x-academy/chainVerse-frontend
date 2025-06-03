import { useCartStore } from "@/store/cartStore";
import { Button } from "./ui/button";
import { ShoppingCart, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/authStore";
export default function CartModal({ cartCount }: { cartCount: number }) {
  const router = useRouter();
  const {setRequiresAuth } = useCartStore()
  const isAuthenticated = useAuthStore.getState().isAuthenticated;
  const handleCheckout = () => {
    if(!isAuthenticated){
      setRequiresAuth(true)
    }else{
    router.push("/checkout");}
  };


  return (
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
              <Image
                src="/empty-cart.svg"
                alt="Empty Cart"
                width={120}
                height={120}
                className="w-22 mb-2"
              />
              <p className="text-gray-500 mb-2">Empty Cart</p>
              <Button onClick={() => (window.location.href = "/courses")}>
                Browse Courses
              </Button>
            </div>
          ) : (
            <div className=" ">
              {useCartStore.getState().items.map((item) => (
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
                  <div>
                    <div className="font-medium text-base text-[#0D1330] line-clamp-1 max-w-[140px]">
                      {item.title}
                    </div>
                    <div className="text-sm font-medium text-[#B2B2B2]">
                      {item.price} {item.currency}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      useCartStore.getState().removeFromCart(item.id)
                    }
                    aria-label="Remove"
                  >
                    <Trash2Icon className="w-8 text-black h-8" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        {cartCount > 0 && (
          <div className="p-4 flex flex-col">
            <div className="flex justify-between items-center py-4 font-bold text-sm">
              <span className="text-lg ">Subtotal</span>
              <span className="text-[#627BF1] text-lg">
                $
                {useCartStore
                  .getState()
                  .items.reduce((sum, i) => sum + i.price * i.quantity, 0)
                  .toLocaleString()}
              </span>
            </div>
            <button
              className="w-full gap-1 mb-3 flex items-center justify-center bg-[#4361EE] h-11 rounded-lg  text-white"
              onClick={handleCheckout}
            >
              <svg
                width="17"
                height="16"
                viewBox="0 0 17 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3.83317 15.8333C2.7265 15.8333 1.6865 15.2467 1.1265 14.2933C0.826503 13.8133 0.666504 13.2467 0.666504 12.6667C0.666504 10.92 2.0865 9.5 3.83317 9.5C5.57984 9.5 6.99984 10.92 6.99984 12.6667C6.99984 13.2467 6.83984 13.8133 6.53984 14.3C5.97984 15.2467 4.93984 15.8333 3.83317 15.8333ZM3.83317 10.5C2.63984 10.5 1.6665 11.4733 1.6665 12.6667C1.6665 13.06 1.77317 13.4467 1.97984 13.78C2.37317 14.4467 3.0665 14.8333 3.83317 14.8333C4.59984 14.8333 5.29317 14.44 5.6865 13.7867C5.89317 13.4467 5.99984 13.0667 5.99984 12.6667C5.99984 11.4733 5.0265 10.5 3.83317 10.5Z"
                  fill="white"
                />
                <path
                  d="M3.45326 13.8267C3.32659 13.8267 3.19992 13.7801 3.09992 13.6801L2.43992 13.0201C2.24659 12.8267 2.24659 12.5067 2.43992 12.3134C2.63326 12.12 2.95326 12.12 3.14659 12.3134L3.46659 12.6334L4.53325 11.6467C4.73325 11.46 5.05326 11.4734 5.23992 11.6734C5.42659 11.8734 5.41325 12.1934 5.21326 12.38L3.79325 13.6934C3.69325 13.78 3.57326 13.8267 3.45326 13.8267Z"
                  fill="white"
                />
                <path
                  d="M4.62653 5.20663C4.46653 5.20663 4.31987 5.1333 4.21987 4.99997C4.10654 4.84663 4.0932 4.64661 4.17987 4.47995C4.2932 4.25328 4.4532 4.0333 4.65987 3.8333L6.82654 1.65996C7.9332 0.559961 9.7332 0.559961 10.8399 1.65996L12.0065 2.84665C12.4999 3.33331 12.7999 3.98665 12.8332 4.67998C12.8399 4.83331 12.7799 4.97996 12.6665 5.07996C12.5532 5.17996 12.3999 5.22663 12.2532 5.19996C12.1199 5.17996 11.9799 5.17331 11.8332 5.17331H5.16653C5.00653 5.17331 4.8532 5.18663 4.69987 5.20663C4.67987 5.20663 4.6532 5.20663 4.62653 5.20663ZM5.73987 4.16663H11.7132C11.6265 3.93997 11.4865 3.73331 11.2999 3.54664L10.1265 2.35995C9.4132 1.65329 8.24653 1.65329 7.52653 2.35995L5.73987 4.16663Z"
                  fill="white"
                />
                <path
                  d="M11.8332 15.1666H5.58649C5.37316 15.1666 5.18649 15.0333 5.11316 14.84C5.03982 14.64 5.09982 14.42 5.25982 14.2866C5.41982 14.1533 5.56649 13.98 5.67316 13.7933C5.88649 13.4533 5.99316 13.0666 5.99316 12.6733C5.99316 11.48 5.01983 10.5066 3.82649 10.5066C3.20649 10.5066 2.61316 10.7733 2.19982 11.2466C2.05982 11.4 1.83983 11.46 1.64649 11.3866C1.45316 11.3133 1.31982 11.1266 1.31982 10.92V7.99996C1.31982 5.94663 2.58649 4.45996 4.55316 4.2133C4.73316 4.18663 4.93982 4.16663 5.15316 4.16663H11.8198C11.9798 4.16663 12.1865 4.17329 12.3998 4.20662C14.3665 4.43329 15.6532 5.92663 15.6532 7.99996V11.3333C15.6665 13.6266 14.1265 15.1666 11.8332 15.1666ZM6.61982 14.1666H11.8332C13.5532 14.1666 14.6665 13.0533 14.6665 11.3333V7.99996C14.6665 6.43996 13.7532 5.36661 12.2732 5.19328C12.1132 5.16661 11.9732 5.16663 11.8332 5.16663H5.16649C5.00649 5.16663 4.85316 5.17995 4.69982 5.19995C3.23316 5.38662 2.33316 6.45329 2.33316 7.99996V9.87996C2.78649 9.6333 3.30649 9.49996 3.83316 9.49996C5.57982 9.49996 6.99982 10.92 6.99982 12.6666C6.99982 13.1933 6.86649 13.7133 6.61982 14.1666Z"
                  fill="white"
                />
                <path
                  d="M15.1668 11.5H13.1668C12.1535 11.5 11.3335 10.68 11.3335 9.66671C11.3335 8.65337 12.1535 7.83337 13.1668 7.83337H15.1668C15.4402 7.83337 15.6668 8.06004 15.6668 8.33337C15.6668 8.60671 15.4402 8.83337 15.1668 8.83337H13.1668C12.7068 8.83337 12.3335 9.20671 12.3335 9.66671C12.3335 10.1267 12.7068 10.5 13.1668 10.5H15.1668C15.4402 10.5 15.6668 10.7267 15.6668 11C15.6668 11.2734 15.4402 11.5 15.1668 11.5Z"
                  fill="white"
                />
              </svg>

              <span className="text-base font-medium ">
                Proceed to Checkout
              </span>
            </button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
