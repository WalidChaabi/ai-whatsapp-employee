"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button, PageHeader, fieldClass, panelClass } from "@/components/ui";
import { apiFetch } from "@/lib/api";

type AiSettings = {
  provider: string;
  model: string;
  temperature: number;
  tools_enabled: string[] | null;
};

type AiPrompt = {
  content: string;
  version: number;
};

export default function AiSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    provider: "openai",
    model: "gpt-4.1-mini",
    temperature: "0.3",
    tools_enabled: "products.search, knowledge.search, escalate",
    system_prompt: "",
  });
  const [promptVersion, setPromptVersion] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ settings: AiSettings | null; prompt: AiPrompt | null }>(
          "/api/v1/ai-settings",
        );
        setForm({
          provider: data.settings?.provider ?? "openai",
          model: data.settings?.model ?? "gpt-4.1-mini",
          temperature: String(data.settings?.temperature ?? 0.3),
          tools_enabled: (data.settings?.tools_enabled ?? [
            "products.search",
            "knowledge.search",
            "escalate",
          ]).join(", "),
          system_prompt: data.prompt?.content ?? "",
        });
        setPromptVersion(data.prompt?.version ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load AI settings");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiFetch<{ settings: AiSettings; prompt: AiPrompt }>("/api/v1/ai-settings", {
        method: "PUT",
        body: JSON.stringify({
          provider: form.provider,
          model: form.model,
          temperature: Number(form.temperature),
          tools_enabled: form.tools_enabled
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          system_prompt: form.system_prompt,
        }),
      });
      setPromptVersion(data.prompt.version);
      setSuccess("AI settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI Employee"
        description="Provider, model, tools, and system prompt. Consumed by n8n via Laravel — never edited inside n8n."
      />

      {loading ? (
        <div className={`h-40 max-w-2xl animate-pulse ${panelClass}`} />
      ) : (
        <form onSubmit={onSubmit} className={`max-w-2xl space-y-4 p-6 ${panelClass}`}>
          {promptVersion ? (
            <p className="font-mono-ui text-xs text-[var(--ink-faint)]">
              Active system prompt version: {promptVersion}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>Provider</span>
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                className={fieldClass}
              >
                <option value="openai">openai</option>
                <option value="gemini">gemini</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span>Model</span>
              <input
                required
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Temperature</span>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                className={fieldClass}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Tools (comma-separated)</span>
              <input
                value={form.tools_enabled}
                onChange={(e) => setForm({ ...form, tools_enabled: e.target.value })}
                className={fieldClass}
              />
            </label>
          </div>

          <label className="block space-y-1 text-sm">
            <span>System prompt</span>
            <textarea
              required
              rows={8}
              value={form.system_prompt}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
              className={`${fieldClass} font-mono-ui text-xs`}
            />
          </label>

          {error ? <p className="text-sm text-[var(--urgent)]">{error}</p> : null}
          {success ? <p className="text-sm text-[var(--safe)]">{success}</p> : null}

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save AI settings"}
          </Button>
        </form>
      )}
    </div>
  );
}
