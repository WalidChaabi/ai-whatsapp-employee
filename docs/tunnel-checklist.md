# Local tunnel checklist (n8n Cloud ↔ Laravel)

n8n Cloud cannot call `localhost`. Keep a free Cloudflare quick tunnel running while testing.

## Start tunnel

```bash
cloudflared tunnel --url http://localhost:8000
```

Copy the printed `https://….trycloudflare.com` URL.

## Keep these in sync

1. Docker stack is up (`api` on port 8000)
2. Tunnel process stays open
3. n8n Code/HTTP nodes use that exact base URL
4. `N8N_HMAC_SECRET` in `apps/api/.env` matches all n8n Sign Code nodes

## If WhatsApp replies stop

1. Check tunnel still running
2. Check n8n execution → Laravel Ingress status (200 vs 401)
3. In Inbox, confirm conversation is not **AI paused** (click Resume AI)
4. If tunnel URL changed, update n8n base URL and save/publish
