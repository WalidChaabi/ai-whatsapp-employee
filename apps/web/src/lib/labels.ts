export function customerLabel(customer?: {
  name?: string | null;
  phone?: string | null;
  wa_id?: string | null;
} | null): string {
  if (!customer) return "Unknown";
  if (customer.name?.trim()) return customer.name.trim();
  if (customer.phone?.trim()) return customer.phone.trim();
  if (customer.wa_id?.trim()) return formatWaId(customer.wa_id);
  return "Unknown";
}

export function conversationStatusLabel(status: string, aiPaused: boolean): string {
  if (aiPaused || status === "human") return "Human · AI paused";
  if (status === "bot") return "Bot";
  return status;
}

function formatWaId(waId: string): string {
  if (waId.startsWith("+")) return waId;
  if (/^\d+$/.test(waId) && waId.length >= 10) return `+${waId}`;
  return waId;
}
