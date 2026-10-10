import Link from "next/link";

type BrandMarkProps = {
  href?: string | null;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  variant?: "default" | "onDark";
  className?: string;
};

const sizes = {
  sm: {
    mark: "h-[30px] w-[30px] text-[11px] rounded-lg",
    name: "text-[17px]",
  },
  md: {
    mark: "h-10 w-10 text-xs rounded-lg",
    name: "text-base",
  },
  lg: {
    mark: "h-14 w-14 text-sm rounded-[10px]",
    name: "text-2xl sm:text-3xl",
  },
};

export function BrandMark({
  href = "/",
  size = "md",
  showName = true,
  variant = "default",
  className = "",
}: BrandMarkProps) {
  const s = sizes[size];
  const nameColor = variant === "onDark" ? "text-[#EDEAE1]" : "text-[var(--ink)]";

  const content = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`inline-flex ${s.mark} items-center justify-center bg-[linear-gradient(160deg,var(--safe),#1F4E38)] font-mono-ui font-medium tracking-[0.08em] text-[#EDEAE1]`}
      >
        AWE
      </span>
      {showName ? (
        <span className={`font-display font-semibold tracking-[0.01em] ${nameColor} ${s.name}`}>
          AI WhatsApp Employee
        </span>
      ) : null}
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="inline-flex no-underline">
      {content}
    </Link>
  );
}
