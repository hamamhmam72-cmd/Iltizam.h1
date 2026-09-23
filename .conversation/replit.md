# التزام — إدارة الرحلات وذمم الكباتن

منصة عربية لإدارة طلبات النقل والتوصيل، تشغيل الكباتن، ومتابعة العمولات والتسويات المالية بدقة.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/eltizam/src/App.tsx` — الواجهة العربية ومسارات العميل والإدارة والكابتن.
- `artifacts/eltizam/src/index.css` — tokens وهوية الواجهة RTL.
- `lib/api-spec/openapi.yaml` — المصدر الوحيد لعقود API.
- `lib/db/src/schema/eltizam.ts` — جداول الطلبات والكباتن والتسويات.
- `artifacts/api-server/src/routes/eltizam.ts` — مسارات التشغيل والتقارير المالية.
- `artifacts/api-server/src/lib/eltizam.ts` — احتساب العمولة، seed التجريبي، وتجميع الأرصدة.

## Architecture decisions

- العمولة ثابتة بقيمة 0.50 دينار وتُسجل عند الانتقال الأول إلى `completed` فقط لمنع التكرار.
- رصيد الكابتن = مجموع عمولات الطلبات المنجزة ناقص مجموع التسويات، مع دعم التسوية الجزئية.
- الواجهة تستخدم الخطافات المولدة من OpenAPI، ولا توجد نسخ يدوية لعقود الطلبات.
- مسارات الإدارة والكابتن محمية ببوابة دور داخلية في الواجهة؛ طبقة الهوية المؤسسية يمكن ربطها لاحقًا بـ Clerk.

## Product

- نموذج عام سريع لإنشاء طلب مشوار أو توصيل دون حساب.
- لوحة إدارة للطلبات، التعيين، الإنهاء، وتقرير ذمم الكباتن.
- لوحة كابتن تعرض طلباته وعدد الرحلات اليوم/هذا الشهر والعمولة المعلقة.
- تسويات كاملة أو جزئية مع سجل ملاحظات وتاريخ العملية.

## User preferences

واجهة عربية RTL، وهوية لونية كحلية وذهبية/فيروزية تعكس الثقة في خدمة النقل.

## Gotchas

- بعد تعديل `lib/api-spec/openapi.yaml` شغّل codegen قبل typecheck للواجهة أو الخادم.
- لا تغيّر عمولة الإنهاء من الواجهة؛ الخادم يشتقها ويثبتها عند الإنهاء لحماية الحسابات.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
