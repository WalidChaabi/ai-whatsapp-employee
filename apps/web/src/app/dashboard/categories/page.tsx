"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, EmptyState, PageHeader, fieldClass, panelClass, tableHeadClass } from "@/components/ui";
import { apiFetch, Paginated } from "@/lib/api";

type Category = {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  sort_order: number;
  products_count?: number;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async (search = "") => {
    setLoading(true);
    setError(null);
    try {
      const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const data = await apiFetch<Paginated<Category>>(`/api/v1/categories${qs}`);
      setCategories(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/v1/categories", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editing || !editName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/categories/${editing.uuid}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim() }),
      });
      setEditing(null);
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(category: Category) {
    if (!confirm(`Delete category "${category.name}"? Products will become uncategorized.`)) {
      return;
    }
    setError(null);
    try {
      await apiFetch(`/api/v1/categories/${category.uuid}`, { method: "DELETE" });
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    }
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Organize products so AI search stays tidy."
        actions={
          <Link
            href="/dashboard/products"
            className="inline-flex items-center rounded-lg border border-[var(--line)] bg-[var(--card)] px-3.5 py-2 text-sm font-medium text-[var(--ink)] hover:border-[var(--safe)]"
          >
            Back to catalog
          </Link>
        }
      />

      <form onSubmit={onCreate} className="mb-4 flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          className={`max-w-sm ${fieldClass}`}
        />
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Add category"}
        </Button>
      </form>

      <div className="mb-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search categories"
          className={`max-w-sm ${fieldClass}`}
        />
        <Button variant="secondary" onClick={() => void load(q)}>
          Search
        </Button>
      </div>

      {error ? <p className="mb-4 text-sm text-[var(--urgent)]">{error}</p> : null}

      {editing ? (
        <form
          onSubmit={onUpdate}
          className={`mb-4 flex flex-wrap items-end gap-2 p-5 ${panelClass}`}
        >
          <label className="space-y-1 text-sm">
            <span>Rename category</span>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={`block w-64 ${fieldClass}`}
            />
          </label>
          <Button type="submit" disabled={saving}>
            Save
          </Button>
          <Button variant="secondary" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </form>
      ) : null}

      <div className={`overflow-hidden ${panelClass}`}>
        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-[var(--canvas)]" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            title="No categories yet"
            description="Add a category above to organize your catalog."
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className={tableHeadClass}>
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Products</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.uuid} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-4 py-3 font-medium">{category.name}</td>
                  <td className="px-4 py-3 font-mono-ui text-xs">{category.slug}</td>
                  <td className="px-4 py-3">{category.products_count ?? 0}</td>
                  <td className="space-x-3 px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(category);
                        setEditName(category.name);
                      }}
                      className="text-xs font-medium text-[var(--safe)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete(category)}
                      className="text-xs font-medium text-[var(--urgent)] hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
