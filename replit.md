# مشاتل القادري الزراعية — Al-Qadri Agricultural Nurseries

A bilingual Arabic/English nursery showcase website with an admin panel for managing plant sections, photos, and site content.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/nursery-showcase run dev` — run the frontend (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite + Tailwind CSS
- API: Express 5 (port 8080 dev, `/api/index` serverless on Vercel)
- DB: PostgreSQL + Drizzle ORM (Replit built-in for dev, Neon for Vercel prod)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/nursery-showcase/src/pages/GalleryPage.tsx` — main page (all UI, ~2500 lines)
- `artifacts/nursery-showcase/src/lib/storage.ts` — data types, fetch/persist, image upload
- `artifacts/nursery-showcase/src/lib/context.tsx` — React context, localStorage cache
- `artifacts/api-server/src/routes/nursery.ts` — API routes + auth (HMAC token, 8h TTL)
- `artifacts/db/src/schema.ts` — Drizzle schema (`site_config` JSONB table)
- `vercel.json` — deployment config (frontend static + API serverless)

## Architecture decisions

- All site data stored as JSONB in a single `site_config` row — simple, no migrations needed for content changes.
- Images stored as base64 in the JSON blob; compressed to max 800px / quality 0.55 to stay under Vercel's 4.5MB serverless body limit.
- `fetchSiteData` returns `SiteData | null` (null = no DB record), so localStorage cache is preserved on first load instead of being overwritten with defaults.
- Session tokens are HMAC-signed with a key derived from `DATABASE_URL`; stored in-memory only (no DB table needed).
- Frontend uses localStorage as a write-through cache so the UI is instant even on slow connections.

## Product

- Bilingual (Arabic RTL / English) plant gallery with sections
- Admin panel: add/edit/delete plants, reorder sections, manage photos
- Owner/manager section with optional background image and multiple photos carousel
- Branch locations map
- Quote request system
- PDF catalog download per section

## User preferences

- Admin credentials stored via `ADMIN_SETUP_SECRET` environment secret
- API runs on port 8080 in dev; frontend proxies `/api/*` to it via Vite config

## Gotchas

- Body size limit ~4.5MB on Vercel serverless — image compression is critical
- Token auth is in-memory only; server restart invalidates all sessions
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing the OpenAPI spec

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
