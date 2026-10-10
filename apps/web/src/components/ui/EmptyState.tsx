import { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-start justify-center px-6 py-10 ${className}`}>
      <p className="font-display text-lg font-semibold text-[var(--ink)]">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--ink-soft)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
