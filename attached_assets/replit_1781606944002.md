# Arabic Quotation Generator (نظام إنشاء عروض الأسعار الذكي)

## Project Overview
A modern Arabic quotation generator that allows users to paste unorganized text containing product details (name, quantity, price), which the app automatically parses into a structured, editable table. Users can export quotations as PDF, Excel, and Word files.

## Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite, Shadcn UI (Radix UI), TanStack Query, Wouter
- **Backend**: Node.js, Express 5, TypeScript (tsx)
- **Database**: PostgreSQL via Drizzle ORM
- **Exports**: jsPDF + html2canvas (PDF), xlsx (Excel), docx (Word)
- **Animations**: Framer Motion
- **Icons**: Lucide React, React Icons

## Project Structure
```
client/           # React frontend
  src/
    pages/        # Main views (create-quotation, history)
    components/   # UI components
    lib/          # Utilities (export-utils, queryClient)
    hooks/        # Custom hooks (use-quotations)
server/           # Express backend
  index.ts        # App entry point
  routes.ts       # API endpoints + smart text parser
  storage.ts      # Data access layer (Drizzle ORM)
  db.ts           # PostgreSQL connection
  vite.ts         # Vite dev middleware
  static.ts       # Static file serving (production)
shared/           # Shared TypeScript types
  schema.ts       # Database schema (quotations, quotation_items)
script/           # Build scripts
```

## Running the Project
- **Development**: `npm run dev` (starts Express + Vite middleware on port 5000)
- **Database sync**: `npm run db:push`
- **Build**: `npm run build`
- **Production**: `npm run start`

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (set via Replit database)
- `PORT` - Server port (default: 5000)

## Key Features
- Smart text parser that extracts item names, quantities, and prices from Arabic text
- Full RTL support with Cairo font
- Editable quotation table
- PDF, Excel, and Word export
- Quotation history saved to PostgreSQL database
