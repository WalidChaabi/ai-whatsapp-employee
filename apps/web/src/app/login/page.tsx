"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { apiUrl, setSession } from "@/lib/api";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);

    try {
      const res = await fetch(apiUrl("/api/v1/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? "Login failed");
      }

      if (!data.tenants?.[0]?.uuid) {
        throw new Error("No tenant on this account");
      }
      setSession(data.token, data.tenants[0].uuid, data.user?.name ?? data.user?.email);
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
              Sign in
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              WhatsApp support that sells for you.
            </p>
          </div>
        </div>
        <label className="block space-y-1 text-sm text-[var(--ink)]">
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 outline-none ring-[var(--safe)] focus:ring-2"
            defaultValue="owner@awe.test"
          />
        </label>
        <label className="block space-y-1 text-sm text-[var(--ink)]">
          <span>Password</span>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 outline-none ring-[var(--safe)] focus:ring-2"
            defaultValue="password"
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[var(--safe)] px-3 py-2.5 text-sm font-semibold text-[#EDEAE1] transition hover:bg-[var(--teal-deep)] disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm text-[var(--ink-soft)]">
          No account?{" "}
          <Link href="/register" className="font-medium text-[var(--safe)] hover:underline">
            Register
          </Link>
        </p>
      </form>
    </main>
  );
}
