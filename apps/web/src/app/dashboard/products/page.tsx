"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, EmptyState, PageHeader, fieldClass, panelClass, tableHeadClass } from "@/components/ui";
import { apiFetch, Paginated } from "@/lib/api";

type Category = {
  id: number;
  uuid: string;
  name: string;
};

type Product = {
  id: number;
  uuid: string;
  sku: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  stock_qty: number | null;
  status: string;
  category?: Category | null;
  category_id?: number | null;
};

const emptyForm = {
  sku: "",
  name: "",
  description: "",
  price: "",
  currency: "USD",
  stock_qty: "0",
  status: "active",
  category_uuid: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadCategories = useCallback(async () => {
    try {
      const data = await apiFetch<Paginated<Category>>("/api/v1/categories");
      setCategories(data.data);
    } catch {
      // non-blocking
    }
  }, []);

  const load = useCallback(async (search = "", categoryUuid = categoryFilter) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (categoryUuid) params.set("category_uuid", categoryUuid);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await apiFetch<Paginated<Product>>(`/api/v1/products${qs}`);
      setProducts(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    void loadCategories();
    void load();
  }, [load, loadCategories]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch<Product>("/api/v1/products", {
        method: "POST",
        body: JSON.stringify({
          sku: form.sku,
          name: form.name,
          description: form.description || null,
          price: Number(form.price),
          currency: form.currency || "USD",
          stock_qty: Number(form.stock_qty || 0),
          status: form.status,
          category_uuid: form.category_uuid || null,
        }),
      });
      setForm(emptyForm);
      setShowForm(false);
      await load(q, categoryFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(product: Product) {
    if (!confirm(`Delete ${product.name}?`)) return;
    setError(null);
    try {
      await apiFetch(`/api/v1/products/${product.uuid}`, { method: "DELETE" });
      await load(q, categoryFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
    }
  }

  return (
    <div>
      <PageHeader
        title="Catalog"
        description="Products your AI employee can search and recommend."
        actions={
          <>
            <Link
              href="/dashboard/categories"
              className="inline-flex items-center rounded-lg border border-[var(--line)] bg-[var(--card)] px-3.5 py-2 text-sm font-medium text-[var(--ink)] hover:border-[var(--safe)]"
            >
              Categories
            </Link>
            <Button
              variant={showForm ? "secondary" : "primary"}
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Cancel" : "Add product"}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or SKU"
          className={`max-w-sm ${fieldClass}`}
        />
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            void load(q, e.target.value);
          }}
          className={`w-auto ${fieldClass}`}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.uuid} value={category.uuid}>
              {category.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={() => void load(q, categoryFilter)}>
          Search
        </Button>
      </div>

      {showForm ? (
        <form
          onSubmit={onCreate}
          className={`mb-4 grid gap-3 p-5 sm:grid-cols-2 ${panelClass}`}
        >
          <label className="space-y-1 text-sm">
            <span>SKU</span>
            <input
              required
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={fieldClass}
              rows={2}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Category</span>
            <select
              value={form.category_uuid}
              onChange={(e) => setForm({ ...form, category_uuid: e.target.value })}
              className={fieldClass}
            >
              <option value="">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.uuid} value={category.uuid}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span>Price</span>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Stock</span>
            <input
              type="number"
              min="0"
              value={form.stock_qty}
              onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
              className={fieldClass}
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Create product"}
            </Button>
          </div>
        </form>
      ) : null}

      {error ? <p className="mb-4 text-sm text-[var(--urgent)]">{error}</p> : null}

      <div className={`overflow-hidden ${panelClass}`}>
        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-[var(--canvas)]" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            title="No products yet"
            description="Add catalog items so the AI can search and recommend them."
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className={tableHeadClass}>
              <tr>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.uuid} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-4 py-3 font-mono-ui text-xs">{product.sku}</td>
                  <td className="px-4 py-3">{product.name}</td>
                  <td className="px-4 py-3">{product.category?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    {product.currency} {product.price}
                  </td>
                  <td className="px-4 py-3">{product.stock_qty ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{product.status}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void onDelete(product)}
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
