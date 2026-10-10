# n8n Phase 1 runbook — WA Text Agent

The dashboard never talks to n8n. n8n only calls Laravel internal APIs.

## Prerequisites

1. Meta WhatsApp Cloud App with webhook URL pointing to the n8n webhook node.
2. Laravel API reachable from n8n Cloud (`APP_URL`).
3. Shared secret in both places:
   - Laravel: `N8N_HMAC_SECRET`
   - n8n: workflow env / credential `N8N_HMAC_SECRET`
4. At least one `whatsapp_accounts` row with `phone_number_id` mapped to a tenant.

## HMAC signing (n8n Function node)

Before every Laravel HTTP request:

```js
const secret = $env.N8N_HMAC_SECRET;
const timestamp = Math.floor(Date.now() / 1000).toString();
const body = JSON.stringify($json); // or raw body string for POST
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', secret)
  .update(`${timestamp}.${body}`)
  .digest('hex');

return [{
  json: {
    ...($json),
    _headers: {
      'X-N8n-Timestamp': timestamp,
      'X-N8n-Signature': signature,
      'Content-Type': 'application/json',
    },
  },
}];
```

For GET tool calls, use `timestamp.` + empty string or canonical query string — must match Laravel `VerifyN8nHmac` (body = raw request content).

## Workflow steps

1. **Webhook** — Meta challenge verify + message events.
2. **Verify signature** — Meta `X-Hub-Signature-256`.
3. **Normalize** — extract `phone_number_id`, `wamid`, `from`, `type`, `text`.
4. **Non-text gate** — Phase 1: ignore or canned reply for non-text.
5. **POST** `/internal/v1/ingress/message` — persist + context pack.
6. If `ai_paused === true` — stop (human owns thread).
7. **AI Agent** — system prompt + recent messages from pack; tools:
   - `GET /internal/v1/tools/products/search?phone_number_id=&q=`
   - `POST /internal/v1/tools/escalate`
8. **Send** WhatsApp reply via Graph API.
9. **POST** `/internal/v1/egress/message` — log outbound.

## Idempotency

- Meta may retry. Laravel enforces `UNIQUE(tenant_id, wamid)`.
- Treat HTTP 409 as success/no-op for ingress.

## Local test without Meta

```bash
# After HMAC headers are generated:
curl -X POST http://localhost:8000/internal/v1/ingress/message \
  -H "Content-Type: application/json" \
  -H "X-N8n-Timestamp: ..." \
  -H "X-N8n-Signature: ..." \
  -d '{
    "phone_number_id":"YOUR_PHONE_NUMBER_ID",
    "wamid":"wamid.test.1",
    "from_wa_id":"15551234567",
    "type":"text",
    "text":"Do you have blue sneakers?"
  }'
```
