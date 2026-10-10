"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, EmptyState, PageHeader, fieldClass, panelClass, tableHeadClass } from "@/components/ui";
import { apiFetch, Paginated } from "@/lib/api";
import { customerLabel } from "@/lib/labels";

type Customer = {
  id: number;
  uuid: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  wa_id: string;
  conversations_count?: number;
  updated_at: string;
};

export default function CustomersPageClient() {
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const load = useCallback(async (search = "") => {
    setLoading(true);
    setError(null);
    try {
      const qs = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const data = await apiFetch<Paginated<Customer>>(`/api/v1/customers${qs}`);
      setCustomers(data.data);
      if (focus) {
        const match = data.data.find((c) => c.uuid === focus);
        if (match) {
          setEditing(match);
          setForm({
            name: match.name ?? "",
            phone: match.phone ?? "",
            email: match.email ?? "",
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [focus]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(customer: Customer) {
    setEditing(customer);
    setForm({
      name: customer.name ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
    });
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<Customer>(`/api/v1/customers/${editing.uuid}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.name || null,
          phone: form.phone || null,
          email: form.email || null,
        }),
      });
      setCustomers((prev) => prev.map((c) => (c.uuid === updated.uuid ? { ...c, ...updated } : c)));
      setEditing({ ...editing, ...updated });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save customer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        description="People who messaged your WhatsApp number."
      />

      <div className="mb-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load(q);
          }}
          placeholder="Search name, phone, WhatsApp ID"
          className={`max-w-sm ${fieldClass}`}
        />
        <Button variant="secondary" onClick={() => void load(q)}>
          Search
        </Button>
      </div>

      {error ? <p className="mb-4 text-sm text-[var(--urgent)]">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className={`overflow-hidden ${panelClass}`}>
          {loading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-[var(--canvas)]" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <EmptyState
              title="No customers yet"
              description="When someone messages your WhatsApp number, they will appear here."
            />
          ) : (
            <table className="w-full text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">WhatsApp ID</th>
                  <th className="px-4 py-3 font-medium">Chats</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.uuid}
                    className={`border-b border-[var(--line)] last:border-0 ${
                      editing?.uuid === customer.uuid ? "bg-[var(--safe-bg)]" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--ink)]">{customerLabel(customer)}</p>
                      <p className="text-xs text-[var(--ink-soft)]">
                        {customer.email || customer.phone || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono-ui text-xs">{customer.wa_id}</td>
                    <td className="px-4 py-3">{customer.conversations_count ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(customer)}
                        className="text-xs font-medium text-[var(--safe)] hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={`${panelClass} p-5`}>
          {!editing ? (
            <EmptyState
              title="Select a customer"
              description="Choose someone from the list to edit their profile."
              className="px-0 py-4"
            />
          ) : (
            <form onSubmit={onSave} className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">{customerLabel(editing)}</p>
                <p className="font-mono-ui text-xs text-[var(--ink-faint)]">WA ID: {editing.wa_id}</p>
              </div>
              <label className="block space-y-1 text-sm">
                <span>Name</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>Phone</span>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={fieldClass}
                />
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Link
                  href="/dashboard/inbox"
                  className="inline-flex items-center rounded-lg border border-[var(--line)] bg-[var(--card)] px-3.5 py-2 text-sm font-medium text-[var(--ink)] hover:border-[var(--safe)]"
                >
                  Open inbox
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
