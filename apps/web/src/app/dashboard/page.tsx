"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusChip } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { relativeTime, truncate } from "@/lib/format";
import { customerLabel } from "@/lib/labels";

type AttentionConversation = {
  uuid: string;
  status: string;
  ai_paused: boolean;
  last_message_at: string | null;
  customer: {
    name: string | null;
    phone: string | null;
    wa_id: string;
  } | null;
  latest_message?: { body: string | null } | null;
};

type Analytics = {
  messages_today: number;
  inbound_7d: number;
  outbound_7d: number;
  by_status: { bot: number; human: number; paused: number };
  by_sender_7d: { customer: number; ai: number; agent: number };
  series_7d: Array<{
    date: string;
    label: string;
    inbound: number;
    outbound: number;
    total: number;
  }>;
};

type DashboardStats = {
  conversations: number;
  paused: number;
  unread: number;
  customers: number;
  products: number;
  attention: AttentionConversation[];
  whatsapp_connected: boolean;
  ai_configured: boolean;
  analytics: Analytics;
};

function formatStamp(date: Date): string {
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = String(date.getDate()).padStart(2, "0");
  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${weekday} · ${month} ${day} · ${time}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function load(options?: { silent?: boolean }) {
      const silent = options?.silent === true;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await apiFetch<DashboardStats>("/api/v1/dashboard/stats");
        if (!cancelled) {
          setStats(data);
          setLoadedAt(new Date());
        }
      } catch (err) {
        if (!cancelled && !silent) {
          setError(err instanceof Error ? err.message : "Failed to load overview");
        }
      } finally {
        if (!cancelled && !silent) {
          setLoading(false);
        }
      }
    }

    const clear = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const start = () => {
      clear();
      timer = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          void load({ silent: true });
        }
      }, 15_000);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
        start();
      } else {
        clear();
      }
    };

    void load();
    if (document.visibilityState === "visible") {
      start();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clear();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const stamp = useMemo(() => formatStamp(now), [now]);
  const lastSync = loadedAt ? relativeTime(loadedAt.toISOString()) || "just now" : "—";

  const paused = stats?.paused ?? 0;
  const unread = stats?.unread ?? 0;
  const conversations = stats?.conversations ?? 0;
  const attention = stats?.attention ?? [];
  const analytics = stats?.analytics;
  const series = analytics?.series_7d ?? [];
  const seriesMax = Math.max(1, ...series.map((d) => d.total));
  const messages7d = (analytics?.inbound_7d ?? 0) + (analytics?.outbound_7d ?? 0);
  const statusTotal = Math.max(
    1,
    (analytics?.by_status.bot ?? 0) +
      (analytics?.by_status.human ?? 0) +
      (analytics?.by_status.paused ?? 0),
  );

  const checks = [
    {
      key: "whatsapp",
      done: Boolean(stats?.whatsapp_connected),
      title: "Connect WhatsApp",
      sub: stats?.whatsapp_connected ? "Business number linked" : "Link your Cloud API number",
      href: "/dashboard/settings",
    },
    {
      key: "products",
      done: (stats?.products ?? 0) > 0,
      title: "Add products",
      sub:
        (stats?.products ?? 0) > 0
          ? `${stats?.products} product${stats?.products === 1 ? "" : "s"} in catalog`
          : "So AI can search your catalog",
      href: "/dashboard/products",
    },
    {
      key: "ai",
      done: Boolean(stats?.ai_configured),
      title: "Train your AI",
      sub: stats?.ai_configured ? "System prompt is set" : "Set tone & sell scripts",
      href: "/dashboard/ai",
    },
  ];
  const doneCount = checks.filter((c) => c.done).length;
  const showChecklist = !loading && doneCount < checks.length;

  const aiSignal =
    paused > 0
      ? `${paused} need you`
      : "Active, covering queue";

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
            Overview
          </h1>
          <p className="mt-1.5 max-w-[460px] text-[15px] text-[var(--ink-soft)]">
            WhatsApp support that sells for you. Here&apos;s what your AI employee handled while you
            were away.
          </p>
        </div>
        <div className="font-mono-ui text-xs text-[var(--ink-faint)]">{stamp}</div>
      </div>

      {error ? <p className="mb-4 text-sm text-[var(--urgent)]">{error}</p> : null}

      <div className="mb-7 flex overflow-x-auto rounded-[var(--radius)] bg-[var(--shell)] px-[22px] py-4">
        <Signal
          label="WHATSAPP"
          value={
            loading ? "…" : stats?.whatsapp_connected ? "Connected" : "Not connected"
          }
          amber={!loading && !stats?.whatsapp_connected}
          showDot
        />
        <Signal
          label="AI EMPLOYEE"
          value={loading ? "…" : paused > 0 ? "Needs human review" : "Active, covering queue"}
          amber={!loading && paused > 0}
          showDot
        />
        <Signal
          label="PAUSED CHATS"
          value={loading ? "…" : aiSignal}
          amber={!loading && paused > 0}
          showDot={paused > 0}
        />
        <Signal
          label="UNREAD"
          value={loading ? "…" : unread > 0 ? `${unread} unread` : "All caught up"}
          amber={!loading && unread > 0}
          showDot={unread > 0}
        />
        <Signal label="LAST SYNC" value={loading ? "…" : lastSync} showDot={false} last />
      </div>

      {showChecklist ? (
        <section className="mb-7 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--card)] px-6 py-[22px]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Get set up</h2>
            <span className="font-mono-ui text-xs text-[var(--ink-faint)]">
              {doneCount} / {checks.length} DONE
            </span>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-start gap-2.5 rounded-[10px] border p-3.5 transition hover:border-[var(--safe)] ${
                  item.done
                    ? "border-transparent bg-[var(--safe-bg)]"
                    : "border-[var(--line)] bg-transparent"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[11px] ${
                    item.done
                      ? "bg-[var(--safe)] text-white"
                      : "border-[1.5px] border-[var(--ink-faint)]"
                  }`}
                >
                  {item.done ? "✓" : null}
                </span>
                <span>
                  <span className="block text-[13.5px] font-medium">{item.title}</span>
                  <span className="block text-xs text-[var(--ink-soft)]">{item.sub}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mb-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Conversations"
          value={loading ? null : conversations}
          href="/dashboard/inbox"
          linkLabel="Open inbox"
          accent="safe"
          tag="Live"
        />
        <MetricCard
          label="AI Paused"
          value={loading ? null : paused}
          href="/dashboard/inbox"
          linkLabel="Review paused"
          accent={paused === 0 ? "safe" : "attn"}
          valueSafe={paused === 0}
          tag={paused === 0 ? "All clear" : "Review"}
        />
        <MetricCard
          label="Customers"
          value={loading ? null : (stats?.customers ?? 0)}
          href="/dashboard/customers"
          linkLabel="View customers"
        />
        <MetricCard
          label="Products"
          value={loading ? null : (stats?.products ?? 0)}
          href="/dashboard/products"
          linkLabel="Manage catalog"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--card)] px-[26px] py-6">
          <div className="mb-[22px] flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[19px] font-semibold">Needs attention</h2>
              <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                Chats where AI is paused or handed to a human.
              </p>
            </div>
            <Link
              href="/dashboard/inbox"
              className="shrink-0 text-[13px] font-medium text-[var(--safe)]"
            >
              Open inbox →
            </Link>
          </div>

          {loading ? (
            <div className="h-20 animate-pulse rounded-[10px] bg-[var(--canvas)]" />
          ) : attention.length === 0 ? (
            <div className="flex items-center gap-4 rounded-[10px] bg-[var(--safe-bg)] p-5">
              <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[var(--safe)] text-[17px] text-white">
                ✓
              </div>
              <div>
                <p className="text-[14.5px] font-semibold">All clear</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                  No paused chats right now. Your AI employee is covering WhatsApp on its own.
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {attention.map((conversation) => (
                <li key={conversation.uuid}>
                  <Link
                    href="/dashboard/inbox"
                    className="flex items-start justify-between gap-3 py-3 transition hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">
                          {customerLabel(conversation.customer)}
                        </p>
                        <StatusChip
                          status={conversation.status}
                          aiPaused={conversation.ai_paused}
                        />
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--ink-soft)]">
                        {truncate(conversation.latest_message?.body) || "Open to review"}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono-ui text-[10px] text-[var(--ink-faint)]">
                      {relativeTime(conversation.last_message_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[var(--radius)] border border-[var(--line)] bg-[var(--card)] px-[26px] py-6">
          <div className="mb-[22px]">
            <h2 className="font-display text-[19px] font-semibold">Activity</h2>
            <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
              Message volume and who is handling chats.
            </p>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-3">
            <StatTile
              label="Today"
              value={loading ? "—" : String(analytics?.messages_today ?? 0)}
            />
            <StatTile
              label="7-day in"
              value={loading ? "—" : String(analytics?.inbound_7d ?? 0)}
            />
            <StatTile
              label="7-day out"
              value={loading ? "—" : String(analytics?.outbound_7d ?? 0)}
            />
          </div>

          <p className="mb-2 font-mono-ui text-[10px] uppercase tracking-wide text-[var(--ink-faint)]">
            Last 7 days · {loading ? "—" : messages7d} messages
          </p>
          <div className="mb-6 flex h-28 items-end gap-1.5">
            {loading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div className="h-16 w-full animate-pulse rounded-sm bg-[var(--canvas)]" />
                    <span className="font-mono-ui text-[9px] text-[var(--ink-faint)]">—</span>
                  </div>
                ))
              : series.map((day) => {
                  const height = Math.round((day.total / seriesMax) * 100);
                  return (
                    <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-20 w-full items-end">
                        <div
                          className="w-full rounded-sm bg-[var(--safe)]/85"
                          style={{ height: `${Math.max(day.total > 0 ? 8 : 2, height)}%` }}
                          title={`${day.date}: ${day.inbound} in / ${day.outbound} out`}
                        />
                      </div>
                      <span className="font-mono-ui text-[9px] text-[var(--ink-faint)]">
                        {day.label}
                      </span>
                    </div>
                  );
                })}
          </div>

          <div className="mb-4 space-y-2.5">
            <MixRow
              label="Bot"
              count={analytics?.by_status.bot ?? 0}
              pct={((analytics?.by_status.bot ?? 0) / statusTotal) * 100}
              loading={loading}
            />
            <MixRow
              label="Human"
              count={analytics?.by_status.human ?? 0}
              pct={((analytics?.by_status.human ?? 0) / statusTotal) * 100}
              loading={loading}
            />
            <MixRow
              label="Paused"
              count={analytics?.by_status.paused ?? 0}
              pct={((analytics?.by_status.paused ?? 0) / statusTotal) * 100}
              loading={loading}
              accent="attn"
            />
          </div>

          <div className="border-t border-[var(--line)] pt-4">
            <p className="mb-2 font-mono-ui text-[10px] uppercase tracking-wide text-[var(--ink-faint)]">
              Senders · 7 days
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono-ui text-xs text-[var(--ink-soft)]">
              <span>Customer {loading ? "—" : analytics?.by_sender_7d.customer ?? 0}</span>
              <span>AI {loading ? "—" : analytics?.by_sender_7d.ai ?? 0}</span>
              <span>Agent {loading ? "—" : analytics?.by_sender_7d.agent ?? 0}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Signal({
  label,
  value,
  amber = false,
  showDot,
  last = false,
}: {
  label: string;
  value: string;
  amber?: boolean;
  showDot: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap px-[22px] ${
        last ? "" : "border-r border-[var(--shell-line)]"
      } first:pl-0.5`}
    >
      {showDot ? <span className={`signal-dot ${amber ? "amber" : ""}`} /> : null}
      <span className="font-mono-ui text-xs text-[#8B9188]">{label}</span>
      <span className="text-[13.5px] font-medium text-[#EDEAE1]">{value}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  href,
  linkLabel,
  accent,
  valueSafe = false,
  tag,
}: {
  label: string;
  value: number | null;
  href: string;
  linkLabel: string;
  accent?: "safe" | "attn";
  valueSafe?: boolean;
  tag?: string;
}) {
  const border =
    accent === "safe"
      ? "border-l-[var(--safe)]"
      : accent === "attn"
        ? "border-l-[var(--attn)]"
        : "border-l-[var(--line)]";

  return (
    <div
      className={`rounded-[var(--radius)] border border-[var(--line)] border-l-[3px] ${border} bg-[var(--card)] px-[22px] py-5 transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(20,24,20,0.06)]`}
    >
      <p className="mb-3.5 font-mono-ui text-[11px] uppercase tracking-[0.06em] text-[var(--ink-faint)]">
        {label}
      </p>
      {value === null ? (
        <div className="mb-3.5 h-9 w-14 animate-pulse rounded bg-[var(--canvas)]" />
      ) : (
        <p
          className={`mb-3.5 font-display text-[38px] font-medium leading-none ${
            valueSafe ? "text-[var(--safe)]" : "text-[var(--ink)]"
          }`}
        >
          {value}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={href}
          className="border-b border-[var(--ink-faint)] pb-px text-[13px] font-medium text-[var(--ink)]"
        >
          {linkLabel}
        </Link>
        {tag ? (
          <span className="rounded-[5px] bg-[var(--safe-bg)] px-2 py-0.5 font-mono-ui text-[10.5px] text-[var(--safe)]">
            {tag}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-[var(--canvas)] px-3 py-2.5">
      <p className="font-mono-ui text-[10px] uppercase tracking-wide text-[var(--ink-faint)]">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl font-medium leading-none text-[var(--ink)]">
        {value}
      </p>
    </div>
  );
}

function MixRow({
  label,
  count,
  pct,
  loading,
  accent = "safe",
}: {
  label: string;
  count: number;
  pct: number;
  loading: boolean;
  accent?: "safe" | "attn";
}) {
  const bar = accent === "attn" ? "bg-[var(--attn)]" : "bg-[var(--safe)]";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-[var(--ink-soft)]">{label}</span>
        <span className="font-mono-ui text-[var(--ink-faint)]">
          {loading ? "—" : count}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
        <div
          className={`h-full rounded-full ${bar} transition-all`}
          style={{ width: `${loading ? 0 : Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}
