# AI WhatsApp Employee — Phase 1 checklist

## Done

- [x] Monorepo layout (`apps/api`, `apps/web`, `infra`, `docs`)
- [x] Docker Compose (MySQL, Redis, API, Horizon, Web)
- [x] Tenancy primitives (`TenantContext`, `BelongsToTenant`, `EnsureTenantAccess`)
- [x] Phase 1 migrations (tenants → AI tables + Sanctum tokens)
- [x] Auth register/login/me + dashboard session gate
- [x] Products CRUD API + live dashboard UI
- [x] Conversations inbox API + live UI (reply / escalate / resume-ai)
- [x] Inbox search + status filters (bot / human / AI paused)
- [x] Customers API + dashboard UI (list/search/edit)
- [x] Categories API + dashboard UI
- [x] Products can be assigned/filtered by category
- [x] WhatsApp account connect API + Settings UI
- [x] Real Meta Graph send in `WhatsAppCloudClient`
- [x] AI settings/prompts API + AI dashboard UI
- [x] Internal n8n ingress / tools / egress (+ HMAC middleware)
- [x] n8n Cloud workflow wired to Laravel (live WhatsApp loop verified)
- [x] OpenAPI stub + n8n runbook + tunnel checklist
- [x] Demo seed (owner + products; fake inbox chat removed)

## Still optional / later

- [ ] Horizon dashboard auth gate for production
- [ ] CORS / Sanctum SPA cookie mode if you prefer cookies over bearer tokens
- [ ] Branding pass (logo, colors, slogan)
- [ ] Stable tunnel/domain for demos (named Cloudflare tunnel or deploy)
