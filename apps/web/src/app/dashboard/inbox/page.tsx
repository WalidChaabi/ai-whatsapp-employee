"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button, EmptyState, PageHeader, StatusChip } from "@/components/ui";
import { apiFetch, Paginated } from "@/lib/api";
import { relativeTime, truncate } from "@/lib/format";
import { customerLabel } from "@/lib/labels";

const POLL_MS = 4_000;

type Customer = {
  uuid: string;
  name: string | null;
  phone: string | null;
  wa_id: string;
};

type AssignedUser = {
  id: number;
  name: string;
  email: string;
};

type LatestMessage = {
  uuid: string;
  direction: string;
  body: string | null;
  sender_type: string;
  created_at: string;
};

type Conversation = {
  id: number;
  uuid: string;
  status: string;
  ai_paused: boolean;
  unread: boolean;
  last_message_at: string | null;
  customer: Customer | null;
  assigned_user?: AssignedUser | null;
  latest_message?: LatestMessage | null;
};

type Message = {
  uuid: string;
  direction: string;
  body: string | null;
  sender_type: string;
  created_at: string;
};

type ConversationMeta = {
  all: number;
  bot: number;
  human: number;
  paused: number;
  unread: number;
};

const filters = [
  { value: "all", label: "All", countKey: "all" },
  { value: "bot", label: "Bot", countKey: "bot" },
  { value: "human", label: "Human", countKey: "human" },
  { value: "paused", label: "AI paused", countKey: "paused" },
  { value: "unread", label: "Unread", countKey: "unread" },
] as const;

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [meta, setMeta] = useState<ConversationMeta | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof filters)[number]["value"]>("all");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const actionInFlightRef = useRef(false);
  const selectedIdRef = useRef<string | null>(null);
  const qRef = useRef(q);
  const statusRef = useRef(status);

  selectedIdRef.current = selectedId;
  qRef.current = q;
  statusRef.current = status;

  const selected = conversations.find((c) => c.uuid === selectedId) ?? null;

  const loadMeta = useCallback(async () => {
    try {
      const data = await apiFetch<ConversationMeta>("/api/v1/conversations/meta");
      setMeta(data);
    } catch {
      // Non-blocking for list load
    }
  }, []);

  const loadConversations = useCallback(
    async (
      preferUuid?: string | null,
      search = q,
      filter = status,
      options?: { silent?: boolean },
    ) => {
      const silent = options?.silent === true;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("q", search.trim());
        if (filter !== "all") params.set("status", filter);
        const qs = params.toString() ? `?${params.toString()}` : "";
        const [data] = await Promise.all([
          apiFetch<Paginated<Conversation>>(`/api/v1/conversations${qs}`),
          loadMeta(),
        ]);

        if (silent) {
          const keepId = selectedIdRef.current;
          setConversations((prev) => {
            if (keepId && !data.data.some((c) => c.uuid === keepId)) {
              const kept = prev.find((c) => c.uuid === keepId);
              return kept ? [kept, ...data.data] : data.data;
            }
            return data.data;
          });
        } else {
          setConversations(data.data);
          setSelectedId((current) => {
            const preferred = preferUuid ?? current;
            if (preferred && data.data.some((c) => c.uuid === preferred)) {
              return preferred;
            }
            return data.data[0]?.uuid ?? null;
          });
        }
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : "Failed to load inbox");
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [q, status, loadMeta],
  );

  const loadMessages = useCallback(
    async (conversationUuid: string, options?: { silent?: boolean; markRead?: boolean }) => {
      const silent = options?.silent === true;
      const markRead = options?.markRead !== false;
      if (!silent) {
        setThreadLoading(true);
        setError(null);
      }
      try {
        const qs = markRead ? "" : "?mark_read=0";
        const data = await apiFetch<Paginated<Message>>(
          `/api/v1/conversations/${conversationUuid}/messages${qs}`,
        );
        if (selectedIdRef.current !== conversationUuid) {
          return;
        }
        setMessages(data.data);
        if (markRead) {
          setConversations((prev) =>
            prev.map((c) => (c.uuid === conversationUuid ? { ...c, unread: false } : c)),
          );
          void loadMeta();
        }
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : "Failed to load messages");
        }
      } finally {
        if (!silent) {
          setThreadLoading(false);
        }
      }
    },
    [loadMeta],
  );

  const silentRefresh = useCallback(async () => {
    if (actionInFlightRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

    const id = selectedIdRef.current;
    await loadConversations(id, qRef.current, statusRef.current, { silent: true });
    if (id) {
      await loadMessages(id, { silent: true, markRead: false });
    }
  }, [loadConversations, loadMessages]);

  useEffect(() => {
    void loadConversations(null, "", "all");
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadMessages(selectedId, { markRead: true });
    } else {
      setMessages([]);
    }
  }, [selectedId, loadMessages]);

  useEffect(() => {
    let timer: number | null = null;

    const clear = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const start = () => {
      clear();
      timer = window.setInterval(() => {
        void silentRefresh();
      }, POLL_MS);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void silentRefresh();
        start();
      } else {
        clear();
      }
    };

    if (document.visibilityState === "visible") {
      start();
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clear();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [silentRefresh]);

  async function withAction(run: () => Promise<void>) {
    actionInFlightRef.current = true;
    try {
      await run();
    } finally {
      actionInFlightRef.current = false;
    }
  }

  async function onReply(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    setError(null);
    await withAction(async () => {
      try {
        await apiFetch(`/api/v1/conversations/${selectedId}/messages`, {
          method: "POST",
          body: JSON.stringify({ body: reply.trim() }),
        });
        setReply("");
        await Promise.all([
          loadMessages(selectedId, { markRead: true }),
          loadConversations(selectedId),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send reply");
      }
    });
    setSending(false);
  }

  async function onEscalate() {
    if (!selectedId) return;
    setError(null);
    await withAction(async () => {
      try {
        await apiFetch(`/api/v1/conversations/${selectedId}/escalate`, {
          method: "POST",
          body: JSON.stringify({ reason: "Manual escalation from inbox" }),
        });
        await loadConversations(selectedId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to escalate");
      }
    });
  }

  async function onResumeAi() {
    if (!selectedId) return;
    setError(null);
    await withAction(async () => {
      try {
        await apiFetch(`/api/v1/conversations/${selectedId}/resume-ai`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        await loadConversations(selectedId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to resume AI");
      }
    });
  }

  async function onClaim() {
    if (!selectedId) return;
    setError(null);
    await withAction(async () => {
      try {
        const updated = await apiFetch<Conversation>(
          `/api/v1/conversations/${selectedId}/assign`,
          { method: "POST", body: JSON.stringify({}) },
        );
        setConversations((prev) =>
          prev.map((c) => (c.uuid === selectedId ? { ...c, ...updated } : c)),
        );
        void loadMeta();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to claim");
      }
    });
  }

  async function onUnassign() {
    if (!selectedId) return;
    setError(null);
    await withAction(async () => {
      try {
        const updated = await apiFetch<Conversation>(
          `/api/v1/conversations/${selectedId}/assign`,
          { method: "POST", body: JSON.stringify({ user_id: null }) },
        );
        setConversations((prev) =>
          prev.map((c) => (c.uuid === selectedId ? { ...c, ...updated } : c)),
        );
        void loadMeta();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to unassign");
      }
    });
  }

  function countFor(key: keyof ConversationMeta): string {
    if (!meta) return "";
    return ` ${meta[key]}`;
  }

  const allVisibleChecked =
    conversations.length > 0 && conversations.every((c) => checkedIds.includes(c.uuid));

  function toggleChecked(uuid: string) {
    setCheckedIds((prev) =>
      prev.includes(uuid) ? prev.filter((id) => id !== uuid) : [...prev, uuid],
    );
  }

  function toggleSelectAllVisible() {
    if (allVisibleChecked) {
      setCheckedIds((prev) => prev.filter((id) => !conversations.some((c) => c.uuid === id)));
      return;
    }
    setCheckedIds((prev) => {
      const next = new Set(prev);
      conversations.forEach((c) => next.add(c.uuid));
      return Array.from(next);
    });
  }

  async function runBulk(action: "read" | "claim" | "unassign" | "pause" | "resume") {
    if (checkedIds.length === 0) return;
    setBulkBusy(true);
    setError(null);
    await withAction(async () => {
      try {
        await apiFetch("/api/v1/conversations/bulk", {
          method: "POST",
          body: JSON.stringify({ uuids: checkedIds, action }),
        });
        setCheckedIds([]);
        await loadConversations(selectedIdRef.current, qRef.current, statusRef.current);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bulk action failed");
      }
    });
    setBulkBusy(false);
  }

  return (
    <div className="flex min-h-[calc(100vh-5.5rem)] flex-col">
      <PageHeader
        title="Inbox"
        description="WhatsApp conversations — AI handles the queue; you take over when it matters."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void loadConversations(selectedId);
          }}
          placeholder="Search name, phone, WhatsApp ID"
          className="max-w-sm rounded-lg border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--safe)]"
        />
        <Button variant="secondary" onClick={() => void loadConversations(selectedId)}>
          Search
        </Button>
        <div className="flex flex-wrap gap-1">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => {
                setStatus(filter.value);
                setCheckedIds([]);
                void loadConversations(selectedId, q, filter.value);
              }}
              className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                status === filter.value
                  ? "bg-[var(--shell)] text-[#EDEAE1]"
                  : "border border-[var(--line)] bg-[var(--card)] text-[var(--ink-soft)] hover:border-[var(--safe)]"
              }`}
            >
              {filter.label}
              <span className="font-mono-ui opacity-70">{countFor(filter.countKey)}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mb-3 text-sm text-[var(--urgent)]">{error}</p> : null}

      {checkedIds.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--card)] px-3 py-2">
          <span className="font-mono-ui text-xs text-[var(--ink-soft)]">
            {checkedIds.length} selected
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={bulkBusy}
            onClick={() => void runBulk("read")}
          >
            Mark read
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={bulkBusy}
            onClick={() => void runBulk("claim")}
          >
            Claim
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={bulkBusy}
            onClick={() => void runBulk("unassign")}
          >
            Unassign
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={bulkBusy}
            onClick={() => void runBulk("pause")}
          >
            Pause AI
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={bulkBusy}
            onClick={() => void runBulk("resume")}
          >
            Resume AI
          </Button>
          <button
            type="button"
            className="ml-auto text-xs text-[var(--ink-soft)] hover:underline"
            onClick={() => setCheckedIds([])}
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--card)] md:grid-cols-[320px_1fr]">
        <aside className="flex min-h-[16rem] flex-col border-b border-[var(--line)] md:min-h-0 md:border-b-0 md:border-r">
          {loading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--canvas)]" />
                  <div className="h-3 w-full animate-pulse rounded bg-[var(--canvas)]" />
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <EmptyState
              title="No conversations"
              description="Nothing matches this filter. New WhatsApp messages will show up here."
            />
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-2">
                <input
                  type="checkbox"
                  checked={allVisibleChecked}
                  onChange={toggleSelectAllVisible}
                  aria-label="Select all visible conversations"
                  className="h-3.5 w-3.5 accent-[var(--safe)]"
                />
                <span className="font-mono-ui text-[10px] text-[var(--ink-faint)]">
                  Select all
                </span>
              </div>
              <ul className="flex-1 divide-y divide-[var(--line)] overflow-y-auto">
                {conversations.map((conversation) => {
                  const active = conversation.uuid === selectedId;
                  const checked = checkedIds.includes(conversation.uuid);
                  const preview =
                    truncate(conversation.latest_message?.body) || "No messages yet";
                  return (
                    <li key={conversation.uuid}>
                      <div
                        className={`flex items-start gap-2 px-3 py-3 transition ${
                          active ? "bg-[var(--safe-bg)]" : "hover:bg-[var(--canvas)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleChecked(conversation.uuid)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${customerLabel(conversation.customer)}`}
                          className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--safe)]"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedId(conversation.uuid)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`flex min-w-0 items-center gap-2 truncate text-sm ${
                                conversation.unread
                                  ? "font-bold text-[var(--ink)]"
                                  : "font-semibold text-[var(--ink)]"
                              }`}
                            >
                              {conversation.unread ? (
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--attn)]"
                                  aria-label="Unread"
                                />
                              ) : null}
                              <span className="truncate">
                                {customerLabel(conversation.customer)}
                              </span>
                            </p>
                            <span className="shrink-0 font-mono-ui text-[10px] text-[var(--ink-faint)]">
                              {relativeTime(conversation.last_message_at)}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <StatusChip
                              status={conversation.status}
                              aiPaused={conversation.ai_paused}
                            />
                            {conversation.assigned_user ? (
                              <span className="font-mono-ui text-[10px] text-[var(--ink-faint)]">
                                {conversation.assigned_user.name}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1.5 truncate text-xs text-[var(--ink-soft)]">
                            {preview}
                          </p>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </aside>

        <section className="flex min-h-[24rem] flex-col md:min-h-0">
          {!selected ? (
            <EmptyState
              className="flex-1"
              title="Select a conversation"
              description="Pick a chat from the left to read the thread and reply as a human."
            />
          ) : (
            <>
              <div className="border-b border-[var(--line)] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--ink)]">
                        {customerLabel(selected.customer)}
                      </p>
                      <StatusChip status={selected.status} aiPaused={selected.ai_paused} />
                      {selected.assigned_user ? (
                        <span className="rounded-md bg-[var(--canvas)] px-2 py-0.5 font-mono-ui text-[10px] text-[var(--ink-soft)]">
                          Assigned · {selected.assigned_user.name}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono-ui text-xs text-[var(--ink-faint)]">
                      {selected.customer?.phone ? (
                        <span>Phone · {selected.customer.phone}</span>
                      ) : null}
                      {selected.customer?.wa_id ? (
                        <span>WhatsApp · {selected.customer.wa_id}</span>
                      ) : (
                        <span>WhatsApp</span>
                      )}
                      {selected.last_message_at ? (
                        <span>{relativeTime(selected.last_message_at)}</span>
                      ) : null}
                    </div>
                    {selected.customer?.uuid ? (
                      <Link
                        href={`/dashboard/customers?focus=${selected.customer.uuid}`}
                        className="mt-1.5 inline-block text-xs font-medium text-[var(--safe)] hover:underline"
                      >
                        Edit customer
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.assigned_user ? (
                      <Button variant="secondary" size="sm" onClick={() => void onUnassign()}>
                        Unassign
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => void onClaim()}>
                        Claim
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => void onEscalate()}>
                      Escalate
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => void onResumeAi()}>
                      Resume AI
                    </Button>
                  </div>
                </div>
                {selected.ai_paused || selected.status === "human" ? (
                  <div className="mt-3 rounded-[10px] border border-transparent bg-[var(--attn-bg)] px-3 py-2 text-xs text-[var(--attn)]">
                    AI paused — human takeover. Resume AI when you want the bot to continue.
                  </div>
                ) : null}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-[var(--canvas)]/40 p-4">
                {threadLoading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`h-14 w-2/3 animate-pulse rounded-[10px] bg-[var(--line)]/60 ${
                          i % 2 === 0 ? "" : "ml-auto"
                        }`}
                      />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <EmptyState
                    title="No messages yet"
                    description="When the customer or AI sends a message, it will appear here."
                  />
                ) : (
                  messages.map((message) => {
                    const outbound = message.direction === "outbound";
                    return (
                      <div
                        key={message.uuid}
                        className={`max-w-[80%] rounded-[10px] px-3 py-2 text-sm ${
                          outbound
                            ? "ml-auto bg-[var(--safe)] text-[#EDEAE1]"
                            : "border border-[var(--line)] bg-[var(--card)] text-[var(--ink)]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.body}</p>
                        <p
                          className={`mt-1 font-mono-ui text-[10px] ${
                            outbound ? "text-[#EDEAE1]/75" : "text-[var(--ink-faint)]"
                          }`}
                        >
                          {message.sender_type} · {relativeTime(message.created_at)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                onSubmit={onReply}
                className="flex gap-2 border-t border-[var(--line)] bg-[var(--card)] p-4"
              >
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type a human reply…"
                  className="flex-1 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 text-sm outline-none focus:border-[var(--safe)]"
                />
                <Button type="submit" disabled={sending || !reply.trim()}>
                  {sending ? "Sending…" : "Send"}
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
