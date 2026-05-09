# Al-Qadri Agricultural Nurseries Showcase

A bilingual (Arabic/English) showcase website for مشاتل القادري الزراعية (Al-Qadri Agricultural Nurseries). Features an admin mode, plant gallery, PDF export, dark mode, and RTL/LTR layout switching.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/nursery-showcase run dev` — run the frontend (assigned port)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, shadcn/ui
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (site_config table stores all site data as JSONB)
- Fonts: Cairo (Arabic), Cormorant Garamond (Latin)
- PDF export: html2canvas + jsPDF

## Where things live

- `artifacts/nursery-showcase/` — React + Vite frontend
- `artifacts/api-server/` — Express API server
- `artifacts/nursery-showcase/src/pages/GalleryPage.tsx` — main page component
- `artifacts/nursery-showcase/src/lib/storage.ts` — data types, fetch/persist helpers
- `artifacts/nursery-showcase/src/lib/context.tsx` — app-wide state (lang, dark, isAdmin, siteData)
- `artifacts/nursery-showcase/src/lib/pdfGen.ts` — PDF catalog export
- `artifacts/api-server/src/routes/siteData.ts` — GET/PUT /api/site-data
- `lib/db/src/schema/siteData.ts` — site_config table schema

## Architecture decisions

- All site content (title, photos, sections, branches, social links) stored as a single JSONB blob in `site_config` table. Simple and effective for a single-owner showcase site.
- Admin mode is toggled via a hidden dot in the top-right corner (no auth — suitable for a personal showcase).
- Images are stored as base64 data URLs in the JSONB blob (simpler than object storage for small-scale use).
- RTL/LTR switching done via `document.documentElement.dir` and `lang` attributes.
- PDF export uses html2canvas to render an off-screen DOM element, then jsPDF to create a paginated PDF.

## Product

A showcase website for Al-Qadri Agricultural Nurseries. Visitors can browse plant photos organized by section (Ornamental Trees, Citrus, etc.), view services, see branch locations, and access social links. An admin mode allows editing all content inline — titles, photos, sections, branches, social links — with changes persisted to the database. PDF catalog export is available per section or for the whole gallery.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Required secrets

Set these in Replit's Secrets panel (never in `.replit` as plaintext):
- `DATABASE_URL` — Postgres connection string (auto-set by Replit DB integration)
- `ADMIN_TOKEN` — admin password for the site editor (set to any strong value you choose)

## Gotchas

- The hidden admin button is a tiny dot in the top-right corner. Click it to open the login modal. Enter the value of your `ADMIN_TOKEN` secret as the password.
- Admin sessions last 8 hours and are stored server-side in memory (reset on server restart).
- Image uploads are stored as base64 data URLs, which means large images will inflate the JSONB blob size significantly.
- The `html2canvas` package needs `pnpm approve-builds` if prompted after install.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
