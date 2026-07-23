# مشاتل القادري الزراعية — Al-Qadri Agricultural Nurseries

موقع عرض ثنائي اللغة (عربي/إنجليزي) لمشاتل القادري الزراعية. يتضمن وضع أدمن، معرض نباتات، تصدير PDF، وضع ليلي، وتبديل RTL/LTR.

## تشغيل المشروع

- `pnpm --filter @workspace/api-server run dev` — تشغيل API server (port 8080)
- `pnpm --filter @workspace/nursery-showcase run dev` — تشغيل الواجهة (port 5000)
- `pnpm run typecheck` — فحص الأنواع على كل الحزم
- `pnpm run build` — بناء كل الحزم

## المكدس التقني (Stack)

- pnpm workspaces, Node.js 20, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, shadcn/ui
- API: Express 5
- DB: PostgreSQL (Replit built-in) — `DATABASE_URL` تُضبط تلقائياً
- Fonts: Cairo (Arabic), Cormorant Garamond (Latin)
- PDF export: html2canvas + jsPDF

## هيكل المشروع

- `artifacts/nursery-showcase/` — واجهة React + Vite
- `artifacts/api-server/` — Express API server
- `artifacts/api-server/src/routes/nursery.ts` — جميع جداول قاعدة البيانات وإنشاؤها
- `artifacts/api-server/src/routes/quotations.ts` — عروض السعر الجديدة (aq_quotations)
- `artifacts/nursery-showcase/src/lib/storage.ts` — أنواع البيانات وعمليات الجلب
- `artifacts/nursery-showcase/src/lib/context.tsx` — الحالة العامة (lang, dark, isAdmin, siteData)
- `lib/db/` — Drizzle ORM schema

## قواعد البيانات (الجداول)

- `site_config` — بيانات الموقع كـ JSONB
- `admins` — بيانات الأدمن (كلمات المرور مشفرة)
- `qadri_old_quotations` — **عروض سعر قادري القديمة** (JSONB blobs مستقلة)
- `admin_quotations` + `admin_quotation_items` — عروض السعر الأدمن المفصلة
- `aq_quotations` + `aq_quotation_items` + `aq_products` — نظام عروض السعر الجديد
- `invoices` — الفواتير
- `receipts` — سندات القبض
- `disbursements` — سندات الصرف
- `quote_requests` — طلبات العروض من الزوار
- `images` — صور base64

## ملاحظات مهمة

- قاعدة البيانات ثابتة على Replit — `DATABASE_URL` تُضبط تلقائياً، لا تحتاج ضبطاً يدوياً
- البيانات تُحفظ في قاعدة البيانات وتظهر من أي جهاز
- الأدمن: زر صغير في الزاوية العلوية اليمنى
- جلسات الأدمن تدوم 8 ساعات وتُخزن في الذاكرة (تنتهي عند إعادة تشغيل الـ server)
- `ADMIN_SETUP_SECRET` مضبوطة كـ env var (ليست secret)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._
