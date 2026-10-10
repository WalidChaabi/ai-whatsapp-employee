type StatusChipProps = {
  status: string;
  aiPaused?: boolean;
  className?: string;
};

export function StatusChip({ status, aiPaused = false, className = "" }: StatusChipProps) {
  const paused = aiPaused || status === "human";
  const bot = status === "bot" && !aiPaused;

  let label = status;
  let styles = "bg-[var(--canvas)] text-[var(--ink-soft)]";

  if (paused) {
    label = "AI paused";
    styles = "bg-[var(--attn-bg)] text-[var(--attn)]";
  } else if (bot) {
    label = "Bot";
    styles = "bg-[var(--safe-bg)] text-[var(--safe)]";
  }

  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-mono-ui text-[10px] font-medium uppercase tracking-wide ${styles} ${className}`}
    >
      {label}
    </span>
  );
}
