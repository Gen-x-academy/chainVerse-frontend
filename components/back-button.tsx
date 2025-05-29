import Link from "next/link";
import { ArrowLeft, ChevronLeft } from "lucide-react";

interface BackButtonProps {
  href: string;
  label?: string;
}

export function BackButton({ href, label = "Back toHome" }: BackButtonProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-foreground hover:text-foreground/80 transition-colors py-2"
    >
      <ArrowLeft size={30} />
      <span className="">Back to Home</span>
    </Link>
  );
}
