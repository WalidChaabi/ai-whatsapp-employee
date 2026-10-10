"use client";

import { Suspense } from "react";
import CustomersPageClient from "./CustomersPageClient";

export default function CustomersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading customers…</p>}>
      <CustomersPageClient />
    </Suspense>
  );
}
