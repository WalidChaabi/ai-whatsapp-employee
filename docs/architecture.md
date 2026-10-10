# Architecture notes

See also the Cursor canvases:

- Architecture blueprint
- Phase 1 implementation plan

## Boundaries

| System | Owns |
|--------|------|
| Laravel | Tenancy, data, tools, billing (later), audit |
| n8n | WhatsApp I/O + LLM orchestration |
| Next.js | Operator UI |

## Tenancy

Shared DB + `tenant_id`. `EnsureTenantAccess` + `BelongsToTenant` global scope.

## Phase 1 code map

- `apps/api/app/Domain/*` — models by bounded context
- `apps/api/app/Support/Tenancy` — context + scope trait
- `apps/api/routes/api.php` — Sanctum dashboard API
- `apps/api/routes/internal.php` — n8n HMAC API
- `apps/web/src/app/dashboard/*` — UI shell
