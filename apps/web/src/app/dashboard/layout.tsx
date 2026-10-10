"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { apiFetch, clearSession, getUserInitial, requireSession } from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/products", label: "Catalog" },
  { href: "/dashboard/knowledge", label: "Knowledge" },
  { href: "/dashboard/ai", label: "AI Employee" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

function linkActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/products") {
    return pathname.startsWith("/dashboard/products") || pathname.startsWith("/dashboard/categories");
  }
  return pathname.startsWith(href);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [initial, setInitial] = useState("·");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!requireSession()) {
      window.location.href = "/login";
      return;
    }
    setInitial(getUserInitial());
    setReady(true);
  }, []);

  async function logout() {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // still clear local session
    }
    clearSession();
    window.location.href = "/login";
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] text-sm text-[var(--ink-soft)]">
        Checking session…
      </div>
    );
  }

  const inboxFullBleed = pathname.startsWith("/dashboard/inbox");

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <header className="bg-[var(--shell)] text-[#EDEAE1]">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-6 sm:px-8">
          <BrandMark href="/dashboard" size="sm" variant="onDark" />

          <nav className="hidden items-center gap-0.5 text-[13.5px] md:flex">
            {nav.map((item) => {
              const active = linkActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3.5 py-2 transition ${
                    active
                      ? "bg-[#EDEAE1] font-medium text-[var(--shell)]"
                      : "text-[#B7BEB6] hover:bg-white/5 hover:text-[#EDEAE1]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#3A4340] font-mono-ui text-xs text-[#EDEAE1]"
              aria-label="Account menu"
            >
              {initial}
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-10 z-30 min-w-[140px] rounded-lg border border-[var(--line)] bg-[var(--card)] py-1 text-sm text-[var(--ink)] shadow-lg">
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="block w-full px-3 py-2 text-left hover:bg-[var(--canvas)]"
                >
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
          {nav.map((item) => {
            const active = linkActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs transition ${
                  active
                    ? "bg-[#EDEAE1] font-medium text-[var(--shell)]"
                    : "text-[#B7BEB6]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main
        className={
          inboxFullBleed
            ? "mx-auto max-w-[1240px] px-4 py-4 sm:px-8"
            : "mx-auto max-w-[1240px] px-6 py-11 sm:px-8"
        }
      >
        {children}
      </main>
    </div>
  );
}
