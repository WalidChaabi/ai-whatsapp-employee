# n8n ↔ Laravel wiring (Phase 1)

Base URL (Cloudflare tunnel — keep cloudflared running):

`https://reflections-got-wayne-talks.trycloudflare.com`

Shared secret: copy `N8N_HMAC_SECRET` from `apps/api/.env` into n8n.

## 1) n8n variable

In n8n → **Settings → Variables** (or workflow static data):

- `LARAVEL_BASE_URL` = `https://reflections-got-wayne-talks.trycloudflare.com`
- `N8N_HMAC_SECRET` = value from Laravel `.env`
- `PHONE_NUMBER_ID` = `102014999591775`

## 2) Reusable Code node: “Sign Laravel Request”

Use before every Laravel HTTP Request. Put the **exact JSON body string** in `body` (empty string for GET).

```js
const crypto = require('crypto');
const secret = $env.N8N_HMAC_SECRET; // or hardcode from .env for local test
const timestamp = Math.floor(Date.now() / 1000).toString();
const body = $json.body ?? ''; // MUST match raw HTTP body exactly
const signature = crypto
  .createHmac('sha256', secret)
  .update(`${timestamp}.${body}`)
  .digest('hex');

return [{
  json: {
    ...$json,
    laravelHeaders: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-N8n-Timestamp': timestamp,
      'X-N8n-Signature': signature,
    },
  },
}];
```

## 3) Target workflow shape (adapt your existing one)

Keep: **WhatsApp Trigger → Only Incoming → Route by type**

### Text path (Phase 1 focus)

1. **Normalize Text** (Set / Code) → build:

```json
{
  "phone_number_id": "102014999591775",
  "wamid": "<whatsapp message id>",
  "from_wa_id": "<customer wa id>",
  "type": "text",
  "text": "<message text>"
}
```

Map from your WhatsApp Trigger fields (usually under `messages[0]` / `metadata.phone_number_id`).

2. **Build ingress body** (Code):

```js
const bodyObj = {
  phone_number_id: $json.phone_number_id,
  wamid: $json.wamid,
  from_wa_id: $json.from_wa_id,
  type: $json.type,
  text: $json.text,
};
const body = JSON.stringify(bodyObj);
return [{ json: { body, bodyObj } }];
```

3. **Sign Laravel Request** (Code above)

4. **HTTP Request — Ingress**
   - Method: `POST`
   - URL: `{{$env.LARAVEL_BASE_URL}}/internal/v1/ingress/message`
   - Headers: from `laravelHeaders`
   - Body: raw / JSON string = `{{$json.body}}` (same string you signed)
   - On **409**: treat as OK (duplicate wamid) — continue or stop gracefully

5. **IF ai_paused === true** → stop (human owns thread). Do not call AI.

6. **AI Agent (Gemini)**  
   - System prompt: use `system_prompt` from ingress response  
   - User/chat input: latest `text` + optional `recent_messages`  
   - Remove **Google Sheets Product Catalog** tool  
   - Add tools below

### Tools for AI Agent

**A) Product search (HTTP Request tool)**
- Method: `GET`
- URL:  
  `{{$env.LARAVEL_BASE_URL}}/internal/v1/tools/products/search?phone_number_id=102014999591775&q={{$fromAI}}&conversation_uuid={{conversation_uuid}}`
- Headers: HMAC for GET → sign with `body = ''` (empty string)
- Tip: use a small Code node before the tool call to sign GET, or a fixed credential middleware pattern in n8n

**A2) Knowledge search (HTTP Request tool)**
- Method: `GET`
- URL:  
  `{{$env.LARAVEL_BASE_URL}}/internal/v1/tools/knowledge/search?phone_number_id=102014999591775&q={{$fromAI}}&conversation_uuid={{conversation_uuid}}`
- Headers: same HMAC as product search (empty body)
- Returns active FAQ/policy articles (`title`, `body`) for the AI to cite

**B) Escalate (HTTP Request tool)**
- Method: `POST`
- URL: `{{$env.LARAVEL_BASE_URL}}/internal/v1/tools/escalate`
- Body:

```json
{
  "phone_number_id": "102014999591775",
  "conversation_uuid": "<from ingress>",
  "reason": "<from AI>"
}
```

- Sign with the exact JSON body string

### After AI reply

7. **WhatsApp Send message** (keep your existing node)

8. **Egress log** — POST  
   `{{$env.LARAVEL_BASE_URL}}/internal/v1/egress/message`

```json
{
  "phone_number_id": "102014999591775",
  "conversation_uuid": "<from ingress>",
  "body": "<AI reply text>",
  "type": "text",
  "wamid": "<outbound wamid if WhatsApp node returns it>"
}
```

Sign + send with HMAC headers.

### Audio / Image / Other (Phase 1)

Keep your normalize nodes, but for now either:
- send a canned WhatsApp reply: “Please send a text message for now.”, or  
- convert to text then hit the same ingress path (`type` can stay `text` with transcribed content)

## 4) Quick test without WhatsApp

In n8n, manually run Ingress HTTP node with a test body, or ask the agent to curl after signing.

Expected ingress success fields: `conversation_uuid`, `ai_paused`, `system_prompt`, `recent_messages`.

## 5) Checklist

- [ ] Tunnel still running (`cloudflared`)
- [ ] `N8N_HMAC_SECRET` matches Laravel `.env`
- [ ] WhatsApp account connected in dashboard DB
- [ ] Sheets product tool removed
- [ ] Ingress → AI → Send → Egress wired
- [ ] Send WhatsApp text → appears in dashboard Inbox
