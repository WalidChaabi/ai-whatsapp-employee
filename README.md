# AI WhatsApp Employee

Production-oriented multi-tenant SaaS for AI-powered WhatsApp support and sales.

Laravel owns the product. n8n is the WhatsApp automation engine only. Next.js is the operator dashboard.

## Stack

| Layer | Tech |
|-------|------|
| API | Laravel 12, PHP 8.4, Sanctum, Horizon |
| Web | Next.js 16, React 19, Tailwind CSS |
| Data | MySQL 8.4, Redis 7 |
| Automation | n8n Cloud (external) |
| AI | OpenAI / Gemini |
| Messaging | Meta WhatsApp Cloud API |

## Monorepo layout

```
apps/api      Laravel API (source of truth)
apps/web      Next.js dashboard
infra/docker  Dockerfiles
docs/         Architecture, OpenAPI, n8n runbook
packages/     Shared contracts (optional)
```

## Quick start (Docker)

```bash
cp apps/api/.env.example apps/api/.env
# Set APP_KEY after first api container boot, or run: docker compose run --rm api php artisan key:generate

docker compose up -d mysql redis
docker compose run --rm api composer install
docker compose run --rm api php artisan migrate --seed
docker compose up -d api horizon web
```

- API: http://localhost:8000  
- Web: http://localhost:3000  
- Horizon: http://localhost:8000/horizon (local only; protect in prod)

## Quick start (local without Docker for app code)

Prerequisites: PHP 8.3+/8.4, Composer, Node 20+, MySQL, Redis.

```bash
# API
cd apps/api
composer install
cp .env.example .env
php artisan key:generate
# Point DB_* and REDIS_* at your local services
php artisan migrate --seed
php artisan serve
php artisan horizon

# Web
cd apps/web
npm install
cp .env.example .env.local
npm run dev
```

## Phase 1 scope

Auth + tenancy, WhatsApp connect, catalog, inbox, AI text FAQ + product search via n8n, human escalate.

See `docs/` and the Cursor architecture canvases for the full blueprint.

## Security notes

- Dashboard never talks to n8n.
- Internal routes (`/internal/v1/*`) require HMAC (`X-N8n-Signature`).
- Every business row is scoped by `tenant_id`.
