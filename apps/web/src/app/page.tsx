import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--canvas)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(47,111,78,0.08)_42%,transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-16 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(47,111,78,0.16),transparent_68%)]"
      />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <div className="animate-brand-rise">
          <BrandMark size="lg" href="/" />
        </div>

        <h1 className="font-display animate-brand-rise-delay mt-10 max-w-3xl text-4xl font-semibold tracking-tight text-[var(--ink)] sm:text-6xl">
          WhatsApp support that sells for you
        </h1>

        <p className="animate-brand-fade mt-5 max-w-xl text-lg text-[var(--ink-soft)]">
          An AI employee for your shop — answers buyers, finds products, and hands off to humans
          when it matters.
        </p>

        <div className="animate-brand-fade mt-10 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-[var(--safe)] px-5 py-3 text-sm font-semibold text-[#EDEAE1] transition hover:bg-[var(--teal-deep)]"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg border border-[var(--line)] bg-[var(--card)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--safe)]"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
