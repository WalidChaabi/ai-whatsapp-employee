import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--safe)] text-[#EDEAE1] hover:bg-[var(--teal-deep)] disabled:opacity-60",
  secondary:
    "border border-[var(--line)] bg-[var(--card)] text-[var(--ink)] hover:border-[var(--safe)] hover:text-[var(--safe)] disabled:opacity-60",
  ghost:
    "text-[var(--ink-soft)] hover:bg-[var(--canvas)] hover:text-[var(--ink)] disabled:opacity-60",
  danger:
    "border border-[var(--urgent-bg)] bg-[var(--urgent-bg)] text-[var(--urgent)] hover:opacity-90 disabled:opacity-60",
};

const sizes: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
