# التزام — Eltizam

منصة عربية لإدارة طلبات النقل والتوصيل، تشغيل الكباتن، ومتابعة العمولات والتسويات المالية.

## ما يتضمنه المشروع

- بوابة عامة لإنشاء طلب مشوار أو توصيل.
- لوحة إدارة للطلبات والكباتن.
- لوحة مالية تعرض الرحلات المنجزة، العمولات، المدفوعات، وصافي الرصيد.
- لوحة كابتن تعرض الرحلات اليومية والشهرية والعمولة المعلقة.
- عمولة ثابتة بقيمة `0.50 JOD` تضاف مرة واحدة عند إتمام الطلب.
- تسويات كاملة أو جزئية مع منع تجاوز الرصيد المستحق.
- قاعدة بيانات PostgreSQL عبر Drizzle ORM.
- واجهة React + Vite عربية RTL.

## المتطلبات

- Node.js 20 أو أحدث.
- pnpm 9 أو أحدث.
- PostgreSQL 14 أو أحدث.

## التشغيل محليًا

```bash
pnpm install
cp .env.example .env
```

ضع قيمة PostgreSQL حقيقية في `DATABASE_URL`، ثم طبّق المخطط:

```bash
pnpm --filter @workspace/db run push
```

شغّل خادم API والواجهة في نافذتين:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/eltizam run dev
```

أو شغّل فحص الأنواع والبناء:

```bash
pnpm run typecheck
pnpm run build
```

## رفع المشروع على GitHub

من مجلد المشروع:

```bash
git init
git add .
git commit -m "Build Eltizam ride and captain finance platform"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

استبدل `USERNAME/REPOSITORY` برابط المستودع الحقيقي.

## النشر على Vercel

1. أنشئ مشروعًا جديدًا في Vercel.
2. اختر مستودع GitHub.
3. اترك **Root Directory** في جذر المستودع.
4. سيقرأ Vercel إعداد `vercel.json` تلقائيًا:
   - Build Command: `pnpm run vercel-build`
   - Output Directory: `artifacts/eltizam/dist/public`
   - API Function: `api/[...path].ts`
5. أضف متغيرات البيئة في Vercel لكل من **Preview** و **Production**:
   - `DATABASE_URL`: رابط PostgreSQL الإنتاجي.
   - `SESSION_SECRET`: قيمة عشوائية طويلة، حتى لو لم تُستخدم في وضع الدخول التجريبي الحالي.
6. اضغط Deploy.

بعد النشر، اختبر:

```text
https://YOUR-DOMAIN.vercel.app/
https://YOUR-DOMAIN.vercel.app/api/healthz
```

## قاعدة البيانات في Vercel

قاعدة Replit المحلية ليست قاعدة إنتاج مناسبة لتطبيق مستضاف على Vercel. استخدم PostgreSQL إنتاجيًا، مثل Neon أو Supabase أو Railway، ثم ضع رابط الاتصال في `DATABASE_URL`.

بعد تجهيز قاعدة البيانات الإنتاجية، شغّل المخطط عليها من جهازك:

```bash
DATABASE_URL="YOUR_PRODUCTION_DATABASE_URL" pnpm --filter @workspace/db run push
```

لا ترفع ملف `.env` أو أي كلمة مرور إلى GitHub. ارفع `.env.example` فقط.

## المسارات

- `/` — إنشاء طلب عام.
- `/login` — الدخول حسب الدور.
- `/admin` — لوحة الإدارة.
- `/admin/orders` — إدارة الطلبات.
- `/admin/finance` — تقرير الذمم والتسويات.
- `/captain` — لوحة الكابتن.
- `/captain/orders` — طلبات الكابتن.

## ملاحظات الأمان

الدخول الحالي في وضع العرض يعتمد اختيار الدور من شاشة الدخول. قبل الاستخدام التجاري، اربط الشاشة بمزود هوية حقيقي مثل Clerk، وأضف تحققًا من الدور داخل API وليس الواجهة فقط.