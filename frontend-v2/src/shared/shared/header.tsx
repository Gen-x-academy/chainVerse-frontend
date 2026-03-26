import Image from "next/image";
import logo from "../public/Vector (1).png";

export function Header() {
  return (
    <header className="py-4 px-6 border-b">
      <div className="flex items-center gap-2">
        <Image src={logo} alt="Logo" className="h-6" width={24} height={24} />
        <span className="font-semibold">ChainVerse Academy</span>
      </div>
    </header>
  );
}
