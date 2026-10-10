"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { apiUrl, setSession } from "@/lib/api";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch(apiUrl("/api/v1/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          password_confirmation: form.get("password_confirmation"),
          company_name: form.get("company_name"),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? "Registration failed");
      }

      setSession(data.token, data.tenant.uuid, data.user?.name ?? data.user?.email);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_20px_50px_rgba(20,24,20,0.06)]"
      >
        <div className="space-y-3">
          <BrandMark size="sm" href="/" />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--ink)]">
              Create account
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Set up your user and first business tenant.
            </p>
          </div>
        </div>
        {[
          ["name", "Your name", "text"],
          ["company_name", "Company name", "text"],
          ["email", "Email", "email"],
          ["password", "Password", "password"],
          ["password_confirmation", "Confirm password", "password"],
        ].map(([name, label, type]) => (
          <label key={name} className="block space-y-1 text-sm text-[var(--ink)]">
            <span>{label}</span>
            <input
              name={name}
              type={type}
              required
              className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 outline-none ring-[var(--safe)] focus:ring-2"
            />
          </label>
        ))}
        {error ? <p className="text-sm text-[var(--urgent)]">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--safe)] px-3 py-2.5 text-sm font-semibold text-[#EDEAE1] transition hover:bg-[var(--teal-deep)] disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-sm text-[var(--ink-soft)]">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-[var(--safe)] hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
