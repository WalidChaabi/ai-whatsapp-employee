"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button, EmptyState, PageHeader, fieldClass, panelClass } from "@/components/ui";
import { apiFetch, Paginated } from "@/lib/api";
import { truncate } from "@/lib/format";

type Article = {
  uuid: string;
  title: string;
  body: string;
  status: string;
  updated_at: string;
};

const emptyForm = {
  title: "",
  body: "",
  status: "active",
};

export default function KnowledgePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async (search = q) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await apiFetch<Paginated<Article>>(`/api/v1/knowledge-articles${qs}`);
      setArticles(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load knowledge base");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startCreate() {
    setEditingUuid(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(article: Article) {
    setEditingUuid(article.uuid);
    setForm({
      title: article.title,
      body: article.body,
      status: article.status,
    });
    setShowForm(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        status: form.status,
      };
      if (editingUuid) {
        await apiFetch(`/api/v1/knowledge-articles/${editingUuid}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/v1/knowledge-articles", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      setEditingUuid(null);
      setForm(emptyForm);
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save article");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(article: Article) {
    if (!confirm(`Delete “${article.title}”?`)) return;
    setError(null);
    try {
      await apiFetch(`/api/v1/knowledge-articles/${article.uuid}`, { method: "DELETE" });
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete article");
    }
  }

  return (
    <div>
      <PageHeader
        title="Knowledge"
        description="FAQs and policies your AI can search when answering customers."
        actions={
          <Button type="button" onClick={startCreate}>
            New article
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load(q);
          }}
          placeholder="Search title or body"
          className={`max-w-sm ${fieldClass}`}
        />
        <Button variant="secondary" onClick={() => void load(q)}>
          Search
        </Button>
      </div>

      {error ? <p className="mb-3 text-sm text-[var(--urgent)]">{error}</p> : null}

      {showForm ? (
        <form onSubmit={onSave} className={`mb-6 space-y-3 ${panelClass} p-4`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--ink)]">
              {editingUuid ? "Edit article" : "New article"}
            </p>
            <button
              type="button"
              className="text-xs text-[var(--ink-soft)] hover:underline"
              onClick={() => {
                setShowForm(false);
                setEditingUuid(null);
              }}
            >
              Cancel
            </button>
          </div>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title (e.g. Shipping policy)"
            className={fieldClass}
          />
          <textarea
            required
            rows={8}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder="Answer the AI should use…"
            className={fieldClass}
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className={`max-w-[10rem] ${fieldClass}`}
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </select>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editingUuid ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-20 animate-pulse ${panelClass}`} />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <EmptyState
          title="No articles yet"
          description="Add shipping, returns, hours, and FAQ answers so the AI can look them up."
        />
      ) : (
        <ul className="space-y-3">
          {articles.map((article) => (
            <li key={article.uuid} className={`${panelClass} p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--ink)]">{article.title}</p>
                    <span
                      className={`rounded-md px-2 py-0.5 font-mono-ui text-[10px] ${
                        article.status === "active"
                          ? "bg-[var(--safe-bg)] text-[var(--safe)]"
                          : "bg-[var(--canvas)] text-[var(--ink-faint)]"
                      }`}
                    >
                      {article.status}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--ink-soft)]">
                    {truncate(article.body, 160)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => startEdit(article)}>
                    Edit
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => void onDelete(article)}>
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
