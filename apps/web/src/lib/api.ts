export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function authHeaders(extra: HeadersInit = {}): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("awe_token") : null;
  const tenant = typeof window !== "undefined" ? localStorage.getItem("awe_tenant") : null;

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenant ? { "X-Tenant-ID": tenant } : {}),
    ...extra,
  };
}

export function clearSession(): void {
  localStorage.removeItem("awe_token");
  localStorage.removeItem("awe_tenant");
  localStorage.removeItem("awe_user_name");
}

export function requireSession(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem("awe_token") && localStorage.getItem("awe_tenant"));
}

export function getUserInitial(): string {
  if (typeof window === "undefined") return "·";
  const name = localStorage.getItem("awe_user_name")?.trim();
  if (name) return name.charAt(0).toUpperCase();
  return "·";
}

export function setSession(token: string, tenantUuid: string, userName?: string | null): void {
  localStorage.setItem("awe_token", token);
  localStorage.setItem("awe_tenant", tenantUuid);
  if (userName?.trim()) {
    localStorage.setItem("awe_user_name", userName.trim());
  }
}

type ApiErrorBody = {
  message?: string;
  errors?: Record<string, string[]>;
};

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401) {
    clearSession();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = (await res.json().catch(() => ({}))) as T & ApiErrorBody;

  if (!res.ok) {
    const validation = data.errors
      ? Object.values(data.errors).flat().join(" ")
      : null;
    throw new Error(validation || data.message || `Request failed (${res.status})`);
  }

  return data;
}

export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
};
