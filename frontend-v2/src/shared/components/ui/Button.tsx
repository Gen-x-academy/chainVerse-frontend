import React from "react";
import clsx from "clsx";
import { colors } from '@/src/shared/constants/design-tokens';
import { focusRing } from '@/src/shared/constants/a11y';
type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}
const variantStyles: Record<Variant, string> = {
  primary: "bg-[var(--dt-primary)] text-white hover:bg-[var(--dt-primary-hover)]",
  secondary: "bg-[var(--dt-secondary)] text-white hover:bg-[var(--dt-secondary)]/90",
  outline: "border border-gray-300 hover:bg-gray-100",
  ghost: "hover:bg-gray-100",
  destructive: "bg-red-600 text-white hover:bg-red-700",
};
export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  className,
  style,
  ...props
}) => {
  return (
    <button
      style={{
        '--dt-primary': colors.primary,
        '--dt-primary-hover': colors.primaryHover,
        '--dt-secondary': colors.secondary,
        ...style,
      } as React.CSSProperties}
      className={clsx(
        "px-4 py-2 rounded-md transition",
        focusRing,
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
};
