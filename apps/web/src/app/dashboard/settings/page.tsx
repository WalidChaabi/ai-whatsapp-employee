"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button, PageHeader, fieldClass, panelClass } from "@/components/ui";
import { apiFetch } from "@/lib/api";

type WhatsappAccount = {
  uuid: string;
  phone_number_id: string;
  waba_id: string | null;
  display_phone: string | null;
  status: string;
  has_token: boolean;
};

type Member = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
};

type Invitation = {
  uuid: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
};

export default function SettingsPage() {
  const [account, setAccount] = useState<WhatsappAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    phone_number_id: "",
    waba_id: "",
    display_phone: "",
    access_token: "",
    status: "connected",
  });

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [meId, setMeId] = useState<number | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("agent");
  const [lastInviteToken, setLastInviteToken] = useState<string | null>(null);
  const [acceptToken, setAcceptToken] = useState("");
  const [teamBusy, setTeamBusy] = useState(false);

  const isOwner = currentRole === "owner";

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    setTeamError(null);
    try {
      const me = await apiFetch<{ user: { id: number } }>("/api/v1/auth/me");
      setMeId(me.user.id);

      const memberRes = await apiFetch<{ data: Member[]; current_role: string }>(
        "/api/v1/team/members",
      );
      setMembers(memberRes.data);
      setCurrentRole(memberRes.current_role);

      if (memberRes.current_role === "owner") {
        const inviteRes = await apiFetch<{ data: Invitation[] }>("/api/v1/team/invitations");
        setInvites(inviteRes.data);
      } else {
        setInvites([]);
      }
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ account: WhatsappAccount | null }>(
          "/api/v1/whatsapp-account",
        );
        setAccount(data.account);
        if (data.account) {
          setForm({
            phone_number_id: data.account.phone_number_id,
            waba_id: data.account.waba_id ?? "",
            display_phone: data.account.display_phone ?? "",
            access_token: "",
            status: data.account.status,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }

    void load();
    void loadTeam();
  }, [loadTeam]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, string> = {
        phone_number_id: form.phone_number_id,
        waba_id: form.waba_id,
        display_phone: form.display_phone,
        status: form.status,
      };
      if (form.access_token.trim()) {
        payload.access_token = form.access_token.trim();
      }

      const data = await apiFetch<{ account: WhatsappAccount }>("/api/v1/whatsapp-account", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setAccount(data.account);
      setForm((prev) => ({ ...prev, access_token: "" }));
      setSuccess("WhatsApp connection saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setTeamBusy(true);
    setTeamError(null);
    setLastInviteToken(null);
    try {
      const data = await apiFetch<{ invitation: Invitation }>("/api/v1/team/invitations", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setInviteEmail("");
      setLastInviteToken(data.invitation.token);
      await loadTeam();
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setTeamBusy(false);
    }
  }

  async function onCancelInvite(uuid: string) {
    setTeamBusy(true);
    setTeamError(null);
    try {
      await apiFetch(`/api/v1/team/invitations/${uuid}`, { method: "DELETE" });
      await loadTeam();
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : "Failed to cancel invite");
    } finally {
      setTeamBusy(false);
    }
  }

  async function onChangeRole(member: Member, role: string) {
    setTeamBusy(true);
    setTeamError(null);
    try {
      await apiFetch(`/api/v1/team/members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await loadTeam();
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setTeamBusy(false);
    }
  }

  async function onRemove(member: Member) {
    if (!confirm(`Remove ${member.name} from this workspace?`)) return;
    setTeamBusy(true);
    setTeamError(null);
    try {
      await apiFetch(`/api/v1/team/members/${member.id}`, { method: "DELETE" });
      await loadTeam();
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setTeamBusy(false);
    }
  }

  async function onAcceptInvite(e: FormEvent) {
    e.preventDefault();
    if (!acceptToken.trim()) return;
    setTeamBusy(true);
    setTeamError(null);
    try {
      const data = await apiFetch<{ tenant: { uuid: string; name: string }; message: string }>(
        "/api/v1/auth/accept-invite",
        {
          method: "POST",
          body: JSON.stringify({ token: acceptToken.trim() }),
        },
      );
      setAcceptToken("");
      setSuccess(data.message + (data.tenant?.name ? ` · ${data.tenant.name}` : ""));
      await loadTeam();
    } catch (err) {
      setTeamError(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setTeamBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="WhatsApp connection and workspace team."
      />

      {loading ? (
        <div className={`mb-4 h-48 max-w-xl animate-pulse ${panelClass}`} />
      ) : (
        <form onSubmit={onSubmit} className={`mb-6 max-w-xl space-y-3 p-6 ${panelClass}`}>
          <h2 className="font-display text-lg font-semibold text-[var(--ink)]">WhatsApp</h2>
          <div className="rounded-[10px] border border-[var(--line)] bg-[var(--canvas)] px-3 py-2 font-mono-ui text-xs text-[var(--ink-soft)]">
            {account
              ? `Connected status: ${account.status}${account.has_token ? " · token stored" : " · no token"}`
              : "No WhatsApp account connected yet."}
          </div>

          <label className="block space-y-1 text-sm">
            <span>Phone number ID</span>
            <input
              required
              value={form.phone_number_id}
              onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>WABA ID</span>
            <input
              value={form.waba_id}
              onChange={(e) => setForm({ ...form, waba_id: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Display phone</span>
            <input
              value={form.display_phone}
              onChange={(e) => setForm({ ...form, display_phone: e.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Access token {account?.has_token ? "(leave blank to keep)" : ""}</span>
            <input
              type="password"
              value={form.access_token}
              onChange={(e) => setForm({ ...form, access_token: e.target.value })}
              className={fieldClass}
              placeholder={account?.has_token ? "••••••••" : "EAA..."}
              required={!account}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>Status</span>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className={fieldClass}
            >
              <option value="connected">connected</option>
              <option value="pending">pending</option>
              <option value="disabled">disabled</option>
            </select>
          </label>

          {error ? <p className="text-sm text-[var(--urgent)]">{error}</p> : null}
          {success ? <p className="text-sm text-[var(--safe)]">{success}</p> : null}

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save WhatsApp connection"}
          </Button>
        </form>
      )}

      <section className={`mb-6 max-w-xl space-y-4 p-6 ${panelClass}`}>
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--ink)]">Team</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Owners invite agents. Share the invite token — no email sending yet.
          </p>
        </div>

        {teamError ? <p className="text-sm text-[var(--urgent)]">{teamError}</p> : null}

        {teamLoading ? (
          <div className="h-24 animate-pulse rounded-[10px] bg-[var(--canvas)]" />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--ink)]">
                    {member.name}
                    {member.id === meId ? (
                      <span className="ml-2 font-mono-ui text-[10px] text-[var(--ink-faint)]">
                        you
                      </span>
                    ) : null}
                  </p>
                  <p className="font-mono-ui text-xs text-[var(--ink-faint)]">{member.email}</p>
                </div>
                {isOwner && member.id !== meId ? (
                  <select
                    value={member.role}
                    disabled={teamBusy}
                    onChange={(e) => void onChangeRole(member, e.target.value)}
                    className={`max-w-[7rem] ${fieldClass} py-1.5 text-xs`}
                  >
                    <option value="owner">owner</option>
                    <option value="agent">agent</option>
                  </select>
                ) : (
                  <span className="rounded-md bg-[var(--canvas)] px-2 py-1 font-mono-ui text-[10px] text-[var(--ink-soft)]">
                    {member.role}
                  </span>
                )}
                {isOwner && member.id !== meId ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={teamBusy}
                    onClick={() => void onRemove(member)}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {isOwner ? (
          <form onSubmit={onInvite} className="space-y-2 border-t border-[var(--line)] pt-4">
            <p className="text-sm font-medium text-[var(--ink)]">Invite teammate</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="agent@example.com"
                className={`min-w-[12rem] flex-1 ${fieldClass}`}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className={`max-w-[7rem] ${fieldClass}`}
              >
                <option value="agent">agent</option>
                <option value="owner">owner</option>
              </select>
              <Button type="submit" disabled={teamBusy}>
                Invite
              </Button>
            </div>
            {lastInviteToken ? (
              <div className="rounded-[10px] bg-[var(--canvas)] p-3">
                <p className="mb-1 text-xs text-[var(--ink-soft)]">
                  Share this accept token (valid 7 days):
                </p>
                <p className="break-all font-mono-ui text-[11px] text-[var(--ink)]">
                  {lastInviteToken}
                </p>
              </div>
            ) : null}
            {invites.length > 0 ? (
              <ul className="space-y-2 pt-2">
                {invites.map((invite) => (
                  <li
                    key={invite.uuid}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-[var(--ink-soft)]">
                      {invite.email} · {invite.role}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={teamBusy}
                      onClick={() => void onCancelInvite(invite.uuid)}
                    >
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </form>
        ) : null}

        <form onSubmit={onAcceptInvite} className="space-y-2 border-t border-[var(--line)] pt-4">
          <p className="text-sm font-medium text-[var(--ink)]">Accept an invite</p>
          <p className="text-xs text-[var(--ink-faint)]">
            Log in with the invited email, paste the token, then accept.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              value={acceptToken}
              onChange={(e) => setAcceptToken(e.target.value)}
              placeholder="64-character invite token"
              className={`min-w-[12rem] flex-1 font-mono-ui text-xs ${fieldClass}`}
            />
            <Button type="submit" variant="secondary" disabled={teamBusy || !acceptToken.trim()}>
              Accept
            </Button>
          </div>
        </form>
      </section>

      <aside className={`max-w-xl p-5 text-sm text-[var(--ink-soft)] ${panelClass}`}>
        <p className="font-medium text-[var(--ink)]">Local development</p>
        <p className="mt-1">
          n8n Cloud needs Cloudflare Tunnel running against the API. If the tunnel restarts,
          update the Laravel base URL inside your n8n Code/HTTP nodes.
        </p>
      </aside>
    </div>
  );
}
