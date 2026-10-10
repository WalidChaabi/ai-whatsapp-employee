import Link from "next/link";

type StatCardProps = {
  label: string;
  value: number | null;
  href: string;
  linkLabel: string;
  loading?: boolean;
};

export function StatCard({ label, value, href, linkLabel, loading = false }: StatCardProps) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--line)] border-l-[3px] border-l-[var(--line)] bg-[var(--card)] p-5">
      <p className="font-mono-ui text-[11px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
        {label}
      </p>
      {loading ? (
        <div className="mt-3 h-8 w-16 animate-pulse rounded bg-[var(--canvas)]" />
      ) : (
        <p className="mt-2 font-display text-3xl font-medium text-[var(--ink)]">{value ?? 0}</p>
      )}
      <Link
        href={href}
        className="mt-2 inline-block border-b border-[var(--ink-faint)] pb-px text-xs font-medium text-[var(--ink)]"
      >
        {linkLabel}
      </Link>
    </div>
  );
}
