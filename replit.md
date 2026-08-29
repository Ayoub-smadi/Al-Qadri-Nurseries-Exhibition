# Al-Qadri Nurseries — Workspace

## Project overview
A pnpm monorepo for the Al-Qadri Agricultural Establishment (مؤسسة ومشاتل القادري الزراعية). It contains:

- **`artifacts/nursery-showcase`** — React + Vite + Tailwind frontend. The main customer-facing website with a gallery, quotation builder, and smart-text-to-table analysis.
- **`artifacts/api-server`** — Express + TypeScript API server. Connects to PostgreSQL (via `DATABASE_URL`). Handles quotations, site data, and admin routes.
- **`artifacts/mockup-sandbox`** — Vite sandbox used for design work and component previews on the canvas.
- **`lib/`** — Shared libraries (API client, Zod schemas, DB layer with Drizzle ORM).

## Running the project
| Workflow | Command | Port |
|---|---|---|
| Nursery website | `pnpm --filter @workspace/nursery-showcase run dev` | 5000 |
| API server | `pnpm --filter @workspace/api-server run dev` | 8080 |

The API server requires `DATABASE_URL` (PostgreSQL), `ADMIN_SETUP_SECRET`, and `SESSION_SECRET` (already set as a secret).

## Key pages (nursery-showcase)
- `/` — Gallery / home
- `/create-quotation` — New quotation builder (modern style)
- `/qadri-old-quotation` — Qadri legacy quotation (inline editing, PDF export, smart analysis side panel, delete-parts mode)
- `/quotation-history` — Saved quotations
- `/old-quotation` — OldStyle quotation template
- `/no-header-quotation` — Headerless quotation template
- `/official-documents` — Editable official letters, saved local history, logo/stamp controls, and PDF export

## User preferences
- Arabic-language UI throughout (RTL, Cairo font)
- Keep inline editing style — no modal popups for field edits
