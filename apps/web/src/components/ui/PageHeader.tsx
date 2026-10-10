import { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, actions, className = "" }: PageHeaderProps) {
  return (
    <div className={`mb-7 flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-[460px] text-[15px] text-[var(--ink-soft)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
