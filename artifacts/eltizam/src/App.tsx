import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArrowLeft, Banknote, Bell, Bike, CalendarClock,
  Check, CheckCircle2, ChevronLeft, CircleDollarSign, Clock3, FileText, Headphones,
  LayoutDashboard, LogIn, LogOut, MapPin, Menu, Package, Phone, RefreshCw, Search,
  ShieldCheck, Truck, UserRound, UsersRound, WalletCards, X,
} from 'lucide-react';
import {
  getGetCaptainFinancialSummaryQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetFinancialReportQueryKey,
  getHealthCheckQueryKey,
  getListCaptainsQueryKey,
  getListOrdersQueryKey,
  useCreateCaptainSettlement,
  useCreateOrder,
  useGetCaptainFinancialSummary,
  useGetDashboardSummary,
  useGetFinancialReport,
  useHealthCheck,
  useListCaptains,
  useListOrders,
  useUpdateOrderStatus,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

type Role = 'admin' | 'captain';
type Icon = typeof LayoutDashboard;

const labels = {
  pending: 'بانتظار كابتن',
  claimed: 'تم الاستلام',
  in_progress: 'في الطريق',
  completed: 'مكتمل',
};

const money = (value: number | undefined | null) =>
  new Intl.NumberFormat('ar-JO', {
    style: 'currency',
    currency: 'JOD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const timeLabel = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(value)) : 'الآن';

function Initials({ name = 'التزام', dark = false }: { name?: string | null; dark?: boolean }) {
  const parts = (name ?? 'التزام').trim().split(/\s+/).filter(Boolean);
  const text = parts.slice(0, 2).map((part) => part[0]).join('') || 'ت';
  return <span className={`initials ${dark ? 'initials-dark' : ''}`}>{text}</span>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand-lockup" data-testid="brand-eltizam">
      <div className="brand-mark"><span /><span /><span /></div>
      {!compact && <div><strong>التزام</strong><small>غرفة العمليات</small></div>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = status === 'completed' ? 'success' : status === 'in_progress' ? 'warm' : status === 'claimed' ? 'navy' : 'pending';
  return <span className={`status-pill ${tone}`} data-testid={`status-order-${status}`}>{labels[status as keyof typeof labels] || status}</span>;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-label="جار التحميل" />;
}

function StateMessage({ error, onRetry, empty = false }: { error?: boolean; onRetry?: () => void; empty?: boolean }) {
  return (
    <div className="state-message" data-testid={error ? 'state-error' : 'state-empty'}>
      <div className="state-icon">{error ? <RefreshCw size={20} /> : <FileText size={20} />}</div>
      <strong>{error ? 'تعذر تحميل البيانات' : 'لا توجد طلبات هنا بعد'}</strong>
      <p>{error ? 'تحقق من اتصال غرفة العمليات وحاول مرة أخرى.' : 'ستظهر العمليات الجديدة في هذه المساحة فور وصولها.'}</p>
      {error && onRetry && <button className="button button-ghost" onClick={onRetry} data-testid="button-retry">إعادة المحاولة</button>}
      {empty && <div className="state-rule" />}
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="public-header">
      <Link href="/" className="plain-link"><Brand /></Link>
      <div className="public-header-actions">
        <span className="live-dot"><i /> نسخة تجريبية</span>
        <Link href="/login" className="button button-quiet" data-testid="link-login"><LogIn size={16} /> دخول الفريق</Link>
      </div>
    </header>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', icon: FieldIcon, required = true, testId, autoComplete, maxLength, inputMode }: {
  label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; icon?: Icon; required?: boolean; testId: string; autoComplete?: string; maxLength?: number; inputMode?: 'text' | 'tel' | 'numeric' | 'decimal';
}) {
  return (
    <label className="field" htmlFor={testId}>
      <span>{label}{required && <b> *</b>}</span>
      <div className="field-control">
        {FieldIcon && <FieldIcon size={17} aria-hidden="true" />}
        <input id={testId} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} data-testid={testId} autoComplete={autoComplete} maxLength={maxLength} inputMode={inputMode} />
      </div>
    </label>
  );
}

function PublicHome() {
  const createOrder = useCreateOrder();
  const [created, setCreated] = useState<any>(null);
  const [form, setForm] = useState({ type: 'ride', customerName: '', customerPhone: '', pickup: '', destination: '', scheduledAt: '', notes: '' });
  const update = (key: string) => (value: string) => setForm((old) => ({ ...old, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    createOrder.mutate({ data: { ...form, type: form.type as 'ride' | 'delivery', scheduledAt: form.scheduledAt || null, notes: form.notes || null } }, { onSuccess: setCreated });
  };
  return (
    <div className="public-page" dir="rtl">
      <PublicHeader />
      <main className="public-main">
        <section className="public-hero">
          <div className="hero-copy">
            <div className="eyebrow"><span>01</span> طلبك في أيدٍ تعرف الطريق</div>
            <h1>تنقّل، أوصل.<br /><em>والباقي علينا.</em></h1>
            <p>أرسل طلبك لفريق التزام، وتابع الرحلة من لحظة الاستلام حتى الوصول. خدمة محلية هادئة، حتى في أكثر الأيام ازدحاماً.</p>
            <div className="trust-row"><span><ShieldCheck size={17} /> نسخة عرض تجريبية</span><span><Clock3 size={17} /> متابعة الطلبات في اللوحة</span></div>
          </div>
          <div className="request-panel">
            {!created ? (
              <form onSubmit={submit}>
                <div className="panel-heading"><div><span className="section-kicker">ابدأ من هنا</span><h2>ما الذي تحتاجه اليوم؟</h2></div><div className="panel-number">/ 01</div></div>
                <div className="segmented" role="group">
                  <button type="button" className={form.type === 'ride' ? 'selected' : ''} onClick={() => setForm({ ...form, type: 'ride' })} data-testid="button-type-ride"><Bike size={17} /> مشوار</button>
                  <button type="button" className={form.type === 'delivery' ? 'selected' : ''} onClick={() => setForm({ ...form, type: 'delivery' })} data-testid="button-type-delivery"><Package size={17} /> توصيل</button>
                </div>
                <div className="form-grid">
                  <Field label="الاسم" value={form.customerName} onChange={update('customerName')} placeholder="الاسم الكامل" icon={UserRound} testId="input-customer-name" autoComplete="name" maxLength={80} />
                  <Field label="رقم الجوال" value={form.customerPhone} onChange={update('customerPhone')} placeholder="07X XXX XXXX" type="tel" icon={Phone} testId="input-customer-phone" autoComplete="tel" maxLength={24} inputMode="tel" />
                  <Field label="من" value={form.pickup} onChange={update('pickup')} placeholder="موقع الاستلام" icon={MapPin} testId="input-pickup" maxLength={160} />
                  <Field label="إلى" value={form.destination} onChange={update('destination')} placeholder="الوجهة" icon={MapPin} testId="input-destination" maxLength={160} />
                </div>
                <div className="form-grid">
                  <Field label="وقت الرحلة" value={form.scheduledAt} onChange={update('scheduledAt')} type="datetime-local" icon={CalendarClock} required={false} testId="input-scheduled-at" />
                  <Field label="ملاحظات للسائق" value={form.notes} onChange={update('notes')} placeholder="اختياري" icon={FileText} required={false} testId="input-notes" maxLength={500} />
                </div>
                {createOrder.isError && <div className="inline-error">تعذر إرسال الطلب. حاول مرة أخرى.</div>}
                <button className="button button-primary button-wide" type="submit" disabled={createOrder.isPending} data-testid="button-submit-order">{createOrder.isPending ? 'جارٍ الإرسال...' : <>أرسل الطلب <ArrowLeft size={17} /></>}</button>
                <small className="form-footnote">هذه نسخة تجريبية؛ لا تُدخل بيانات شخصية حقيقية أثناء المعاينة.</small>
              </form>
            ) : (
              <div className="confirmation" data-testid="order-confirmation">
                <div className="confirmation-seal"><Check size={26} /></div>
                <span className="section-kicker">تم تسجيل الطلب</span>
                <h2>وصلنا طلبك، {created.customerName}</h2>
                <p>سيعمل فريقنا على إسناد أقرب كابتن لك. احتفظ برقم الطلب للمتابعة.</p>
                <div className="tracking-code"><span>رقم الطلب</span><strong>#{created.id}</strong></div>
                <button className="button button-secondary button-wide" onClick={() => setCreated(null)} data-testid="button-new-order">إرسال طلب آخر</button>
              </div>
            )}
          </div>
        </section>
        <section className="public-strip">
          <div><span className="big-mark">02</span><strong>وضوح من البداية</strong><p>كل طلب له حالة واضحة وكابتن معروف وموعد محدد.</p></div>
          <div><span className="big-mark">03</span><strong>دعم قريب</strong><p>غرفة عمليات حاضرة للعميل والكابتن طوال اليوم.</p></div>
          <div className="strip-note">التزام<br /><small>رحلتك، بوضوح.</small></div>
        </section>
      </main>
    </div>
  );
}

function Login() {
  const [, setLocation] = useLocation();
  const [role, setRole] = useState<Role>('admin');
  const [name, setName] = useState('');
  const login = (event: React.FormEvent) => {
    event.preventDefault();
    localStorage.setItem('eltizam-role', role);
    localStorage.setItem('eltizam-name', name || (role === 'admin' ? 'مدير العمليات' : 'كابتن التزام'));
    setLocation(role === 'admin' ? '/admin' : '/captain');
  };
  return (
    <div className="login-page" dir="rtl">
      <div className="login-side"><Brand /><div className="login-side-copy"><span className="section-kicker">غرفة العمليات</span><h1>القرار الصحيح،<br /><em>في الوقت الصحيح.</em></h1><p>منصة التزام تجمع حركة الطلبات، الكباتن، والذمم المالية في شاشة واحدة.</p></div><div className="login-side-footer">هذه النسخة للعرض التجريبي فقط (DEMO)</div></div>
      <div className="login-card-wrap"><Link href="/" className="back-home" data-testid="link-back-home"><ArrowLeft size={16} /> العودة للواجهة العامة</Link><div className="login-card"><div className="login-card-heading"><span className="section-kicker">دخول تجريبي</span><h2>أهلاً بعودتك</h2><p>اختر مساحتك للوصول إلى لوحة العمل.</p></div><div className="role-switch"><button className={role === 'admin' ? 'selected' : ''} onClick={() => setRole('admin')} data-testid="button-role-admin"><ShieldCheck size={18} /><span>مدير العمليات<small>إدارة ومتابعة</small></span></button><button className={role === 'captain' ? 'selected' : ''} onClick={() => setRole('captain')} data-testid="button-role-captain"><Truck size={18} /><span>كابتن<small>طلباتي وذممتي</small></span></button></div><form onSubmit={login}><Field label="الاسم أو رقم الجوال" value={name} onChange={setName} placeholder="اكتب اسمك للمتابعة" icon={UserRound} required={false} testId="input-login-name" /><button className="button button-primary button-wide" type="submit" data-testid="button-login">متابعة إلى اللوحة <ArrowLeft size={17} /></button></form><p className="login-demo">العرض التجريبي — بدون تشفير أو حماية أمنية</p></div></div>
    </div>
  );
}

function useRoleGuard(required: Role): boolean {
  const [location, setLocation] = useLocation();
  const role = localStorage.getItem('eltizam-role');
  if (!role || role !== required) {
    if (location !== '/login') setLocation('/login');
    return false;
  }
  return true;
}

function AppShell({ children, role }: { children: ReactNode; role: Role }) {
  const [location, setLocation] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const name = localStorage.getItem('eltizam-name') || (role === 'admin' ? 'مدير العمليات' : 'كابتن التزام');
  const adminItems = [{ href: '/admin', label: 'نظرة عامة', icon: LayoutDashboard }, { href: '/admin/orders', label: 'الطلبات', icon: ClipboardIcon }, { href: '/admin/finance', label: 'الذمم المالية', icon: CircleDollarSign }];
  const captainItems = [{ href: '/captain', label: 'لوحتي', icon: LayoutDashboard }, { href: '/captain/orders', label: 'طلباتي', icon: ClipboardIcon }];
  const items = role === 'admin' ? adminItems : captainItems;
  const logout = () => { localStorage.removeItem('eltizam-role'); localStorage.removeItem('eltizam-name'); setLocation('/login'); };
  return (
    <div className="app-frame" dir="rtl">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="sidebar-top"><Brand compact /><button className="mobile-close" onClick={() => setMobileNav(false)} data-testid="button-close-nav"><X size={19} /></button></div>
        <div className="workspace-label"><span className="live-dot"><i /> متصل</span><small>{role === 'admin' ? 'مساحة الإدارة' : 'مساحة الكابتن'}</small></div>
        <nav className="side-nav">{items.map((item) => <Link key={item.href} href={item.href} className={location === item.href ? 'active' : ''} onClick={() => setMobileNav(false)} data-testid={`link-nav-${item.label}`}><item.icon size={18} /><span>{item.label}</span>{location === item.href && <ChevronLeft size={15} />}</Link>)}</nav>
        <div className="sidebar-divider" />
        <div className="sidebar-service"><Headphones size={17} /><div><strong>مركز الإسناد</strong><small>نحن هنا عند الحاجة</small></div><span className="service-dot" /></div>
        <div className="sidebar-bottom"><div className="user-mini"><Initials name={name} dark /><div><strong>{name}</strong><small>{role === 'admin' ? 'مدير العمليات' : 'كابتن'}</small></div></div><button className="logout-button" onClick={logout} title="تسجيل الخروج" data-testid="button-logout"><LogOut size={17} /></button></div>
      </aside>
      {mobileNav && <button className="mobile-scrim" onClick={() => setMobileNav(false)} aria-label="إغلاق القائمة" data-testid="button-nav-scrim" />}
      <div className="app-content"><header className="topbar"><button className="mobile-menu" onClick={() => setMobileNav(true)} data-testid="button-open-nav"><Menu size={21} /></button><div className="breadcrumb"><span>التزام</span><ChevronLeft size={14} /><strong>{location.includes('finance') ? 'الذمم المالية' : location.includes('orders') ? 'الطلبات' : role === 'captain' ? 'لوحتي' : 'نظرة عامة'}</strong></div><div className="topbar-actions"><div className="topbar-date">{new Intl.DateTimeFormat('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</div><button className="icon-button" data-testid="button-notifications" title="التنبيهات"><Bell size={18} /><i /></button><div className="topbar-avatar"><Initials name={name} /></div></div></header><main className="workspace">{children}</main></div>
    </div>
  );
}

function ClipboardIcon(props: { size?: number }) {
  return <FileText {...props} />;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-header"><div><span className="section-kicker">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function MetricCard({ label, value, note, icon: MetricIcon, accent = 'teal', loading = false }: { label: string; value?: string | number; note?: string; icon: Icon; accent?: string; loading?: boolean }) {
  return <div className={`metric-card accent-${accent}`} data-testid={`metric-${label}`}><div className="metric-top"><span>{label}</span><div className="metric-icon"><MetricIcon size={18} /></div></div>{loading ? <Skeleton className="metric-skeleton" /> : <><strong>{value}</strong><small>{note}</small></>}</div>;
}

function OrderRow({ order, onStatus, onAssign, showActions = true }: { order: any; onStatus?: (status: 'claimed' | 'in_progress' | 'completed', captainId?: number) => void; onAssign?: () => void; showActions?: boolean }) {
  return <div className="order-row" data-testid={`row-order-${order.id}`}><div className="order-id"><span className={`type-icon ${order.type === 'delivery' ? 'delivery' : ''}`}>{order.type === 'delivery' ? <Package size={17} /> : <Bike size={17} />}</span><div><strong>#{order.id}</strong><small>{order.type === 'delivery' ? 'توصيل' : 'مشوار'} · {timeLabel(order.createdAt)}</small></div></div><div className="order-route"><div><i />{order.pickup}</div><div><i />{order.destination}</div></div><div className="order-customer"><strong>{order.customerName}</strong><small>{order.customerPhone}</small></div><div className="order-captain">{order.captainName ? <><Initials name={order.captainName} /><span>{order.captainName}</span></> : <span className="unassigned">لم يُسند بعد</span>}</div><StatusPill status={order.status} />{showActions && onStatus && <div className="row-actions">{order.status === 'pending' && <button onClick={onAssign ?? (() => onStatus('claimed'))} className="mini-action" data-testid={`button-claim-${order.id}`}>إسناد</button>}{order.status === 'claimed' && <button onClick={() => onStatus('in_progress')} className="mini-action" data-testid={`button-start-${order.id}`}>بدء الرحلة</button>}{order.status === 'in_progress' && <button onClick={() => onStatus('completed')} className="mini-action done" data-testid={`button-complete-${order.id}`}>إنهاء</button>}</div>}</div>;
}

function AdminOverview() {
  const summary = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey(), refetchInterval: 20000 } });
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 30000 } });
  const data: any = summary.data;
  const recent = data?.recentOrders || [];
  return <><PageHeader eyebrow="نظرة اليوم" title="صباح الخير، يا مدير." description="الصورة التشغيلية في مكان واحد — تابع الحركة واتخذ القرار بهدوء." action={<div className="health-badge"><span className={health.data ? 'healthy' : 'checking'} /><span>{health.data ? 'النظام يعمل بشكل طبيعي' : 'نتحقق من الاتصال'}</span></div>} /><div className="metric-grid">{[['طلبات نشطة', data?.activeOrders, 'في مسار التنفيذ الآن', Activity, 'teal'], ['مكتملة اليوم', data?.completedToday, 'رحلة أُغلقت بنجاح', CheckCircle2, 'navy'], ['الكباتن', data?.totalCaptains, 'في شبكة التزام', UsersRound, 'warm'], ['ذمم معلقة', money(data?.pendingBalance), `عمولة ${data?.commissionRate ?? 0}%`, WalletCards, 'orange']].map(([label, value, note, icon, accent]) => <MetricCard key={String(label)} label={String(label)} value={value as any} note={String(note)} icon={icon as Icon} accent={String(accent)} loading={summary.isLoading} />)}</div><div className="dashboard-grid"><section className="surface recent-surface"><div className="surface-heading"><div><span className="section-kicker">النبض التشغيلي</span><h2>آخر الطلبات</h2></div><Link href="/admin/orders" className="text-link" data-testid="link-all-orders">كل الطلبات <ArrowLeft size={15} /></Link></div>{summary.isLoading ? <div className="skeleton-list"><Skeleton /><Skeleton /><Skeleton /></div> : summary.isError ? <StateMessage error onRetry={() => summary.refetch()} /> : recent.length ? <div className="compact-orders">{recent.slice(0, 5).map((order: any) => <OrderRow key={order.id} order={order} showActions={false} />)}</div> : <StateMessage empty />}</section><section className="surface pulse-surface"><div className="surface-heading"><div><span className="section-kicker">الحساب المالي</span><h2>مؤشر اليوم</h2></div><CircleDollarSign size={20} className="heading-icon" /></div><div className="pulse-visual"><div className="pulse-ring"><span>{data?.commissionRate ?? 0}%</span><small>نسبة العمولة</small></div><div className="pulse-lines"><div><span>المستحق للكباتن</span><strong>{money(data?.pendingBalance)}</strong></div><div><span>حالة التسويات</span><strong className="text-teal">تحت السيطرة</strong></div></div></div><Link href="/admin/finance" className="button button-secondary button-wide" data-testid="link-finance">فتح الذمم المالية <ArrowLeft size={16} /></Link></section></div></>;
}

function AssignmentModal({ order, captains, pending, onAssign, onClose }: { order: any; captains: any[]; pending: boolean; onAssign: (captainId: number) => void; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-card assignment-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-title"><button ref={closeRef} className="modal-close" onClick={onClose} aria-label="إغلاق نافذة الإسناد"><X size={18} /></button><div className="modal-heading"><span className="section-kicker">إسناد ذكي</span><h2 id="assignment-title">اختر كابتن للطلب #{order.id}</h2><p>{order.pickup} ← {order.destination}</p></div><div className="captain-picker">{captains.map((captain) => <button key={captain.id} className="captain-option" onClick={() => onAssign(captain.id)} disabled={pending} data-testid={`button-assign-captain-${captain.id}`}><Initials name={captain.name} /><span><strong>{captain.name}</strong><small>{captain.status === 'online' ? 'متصل الآن' : 'غير متصل'} · {captain.totalTrips} رحلة</small></span><i className={captain.status} /></button>)}</div>{!captains.length && <StateMessage empty />}</div></div>;
}

function AdminOrders() {
  const [filter, setFilter] = useState<'all' | 'today' | 'scheduled' | 'recurring' | 'completed'>('all');
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState<any>(null);
  const orders = useListOrders({ filter }, { query: { queryKey: getListOrdersQueryKey({ filter }), refetchInterval: 15000 } });
  const captains = useListCaptains({ query: { queryKey: getListCaptainsQueryKey(), staleTime: 30000 } });
  const updateOrder = useUpdateOrderStatus();
  const queryClient = useQueryClient();
  const handleStatus = (id: number, status: 'claimed' | 'in_progress' | 'completed', captainId?: number) => updateOrder.mutate({ id, data: { status, captainId: captainId ?? null } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey({ filter }) }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); setAssigning(null); } });
  const normalizedSearch = search.trim().toLocaleLowerCase('ar');
  const visibleOrders = useMemo(() => (orders.data || []).filter((order: any) => !normalizedSearch || [String(order.id), order.customerName, order.customerPhone, order.pickup, order.destination, order.captainName].some((value) => String(value || '').toLocaleLowerCase('ar').includes(normalizedSearch))), [orders.data, normalizedSearch]);
  const filterLabels = [['all', 'كل الطلبات'], ['today', 'اليوم'], ['scheduled', 'مجدولة'], ['recurring', 'متكررة'], ['completed', 'مكتملة']] as const;
  return <><PageHeader eyebrow="غرفة الطلبات" title="كل الرحلات، بوضوح." description="تابع حالة كل طلب وانتقل به للخطوة التالية دون مغادرة الشاشة." action={<button className="button button-primary" onClick={() => orders.refetch()} data-testid="button-refresh-orders"><RefreshCw size={16} /> تحديث القائمة</button>} /><div className="toolbar"><div className="filter-tabs">{filterLabels.map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)} data-testid={`button-filter-${key}`}>{label}</button>)}</div><div className="toolbar-side"><label className="search-control"><Search size={16} aria-hidden="true" /><span className="sr-only">البحث في الطلبات</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="اسم، رقم، أو موقع..." data-testid="input-search-orders" /></label><span className="result-count">{visibleOrders.length} طلب</span></div></div><section className="surface orders-table"><div className="orders-table-head"><span>الطلب</span><span>المسار</span><span>العميل</span><span>الكابتن</span><span>الحالة</span><span>إجراء</span></div>{orders.isLoading ? <div className="skeleton-list"><Skeleton /><Skeleton /><Skeleton /><Skeleton /></div> : orders.isError ? <StateMessage error onRetry={() => orders.refetch()} /> : visibleOrders.length ? visibleOrders.map((order: any) => <OrderRow key={order.id} order={order} onAssign={() => setAssigning(order)} onStatus={(status, captainId) => handleStatus(order.id, status, captainId)} />) : <StateMessage empty />}</section>{updateOrder.isError && <div className="toast-like error" role="alert">تعذر تحديث حالة الطلب. حاول مرة أخرى.</div>}{assigning && <AssignmentModal order={assigning} captains={[...(captains.data || [])].sort((a: any, b: any) => Number(b.status === 'online') - Number(a.status === 'online'))} pending={updateOrder.isPending} onAssign={(captainId) => handleStatus(assigning.id, 'claimed', captainId)} onClose={() => setAssigning(null)} />}</>;
}

function SettlementModal({ captain, onClose }: { captain: any; onClose: () => void }) {
  const [amount, setAmount] = useState(String(captain.balance || ''));
  const [note, setNote] = useState('');
  const settlement = useCreateCaptainSettlement();
  const queryClient = useQueryClient();
  const submit = (event: React.FormEvent) => { event.preventDefault(); settlement.mutate({ id: captain.id, data: { amount: Number(amount), note: note || null } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetFinancialReportQueryKey() }); queryClient.invalidateQueries({ queryKey: getListCaptainsQueryKey() }); onClose(); } }); };
  return <div className="modal-scrim" role="presentation"><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="settlement-title"><button className="modal-close" onClick={onClose} data-testid="button-close-settlement" aria-label="إغلاق نافذة التسوية"><X size={18} /></button><div className="modal-heading"><span className="section-kicker">تسوية جديدة</span><h2 id="settlement-title">تسوية ذمة {captain.name}</h2><p>سيتم تسجيل المبلغ ضمن سجل التسويات فور التأكيد.</p></div><div className="settlement-balance"><span>الرصيد المستحق</span><strong>{money(captain.balance)}</strong></div><form onSubmit={submit}><Field label="المبلغ المسدد" value={amount} onChange={setAmount} type="number" icon={Banknote} testId="input-settlement-amount" inputMode="decimal" /><Field label="ملاحظة" value={note} onChange={setNote} placeholder="مثال: تحويل بنكي" icon={FileText} required={false} testId="input-settlement-note" maxLength={240} />{settlement.isError && <div className="inline-error" role="alert">تعذر تسجيل التسوية.</div>}<button className="button button-primary button-wide" disabled={settlement.isPending} data-testid="button-submit-settlement">{settlement.isPending ? 'جارٍ الحفظ...' : 'تأكيد التسوية'} <Check size={17} /></button></form></div></div>;
}

function AdminFinance() {
  const report = useGetFinancialReport();
  const captainsQuery = useListCaptains();
  const [selected, setSelected] = useState<any>(null);
  const data: any = report.data;
  const captainRows = data?.captains || captainsQuery.data || [];
  return <><PageHeader eyebrow="الذمم المالية" title="المال جزء من التشغيل." description="رؤية صريحة للعمولات والتسويات — لأن الثقة تُبنى بالأرقام." action={<button className="button button-secondary" onClick={() => { report.refetch(); captainsQuery.refetch(); }} data-testid="button-refresh-finance"><RefreshCw size={16} /> تحديث التقرير</button>} /><div className="finance-banner"><div className="finance-banner-copy"><span className="section-kicker">ملخص التسويات</span><h2>الرصيد المفتوح الآن</h2><strong>{money(data?.totalOutstanding)}</strong><p>يتوزع على {captainRows.length} كابتن ضمن شبكة التزام.</p></div><div className="finance-stat"><span>نسبة العمولة</span><strong>{data?.commissionRate ?? 0}%</strong><small>ثابتة على كل رحلة مكتملة</small></div><div className="finance-stat"><span>رحلات مكتملة</span><strong>{data?.totalCompletedTrips ?? 0}</strong><small>منذ بدء التشغيل</small></div></div><div className="finance-metrics"><MetricCard label="إجمالي العمولات" value={money(data?.totalAccrued)} note="مستحق للكباتن" icon={CircleDollarSign} accent="teal" loading={report.isLoading} /><MetricCard label="تم تسديده" value={money(data?.totalPaid)} note="دفعات موثقة" icon={CheckCircle2} accent="navy" loading={report.isLoading} /><MetricCard label="المتبقي" value={money(data?.totalOutstanding)} note="جاهز للتسوية" icon={WalletCards} accent="orange" loading={report.isLoading} /></div><section className="surface finance-table"><div className="surface-heading"><div><span className="section-kicker">كشف الكباتن</span><h2>من يستحق ماذا؟</h2></div><span className="table-caption">آخر تحديث قبل لحظات</span></div>{report.isLoading || captainsQuery.isLoading ? <div className="skeleton-list"><Skeleton /><Skeleton /><Skeleton /></div> : report.isError ? <StateMessage error onRetry={() => report.refetch()} /> : captainRows.length ? <div className="captains-list">{captainRows.map((captain: any) => <div className="captain-finance-row" key={captain.id} data-testid={`row-captain-${captain.id}`}><div className="captain-identity"><Initials name={captain.name} /><div><strong>{captain.name}</strong><small>{captain.phone} · {captain.totalTrips} رحلة</small></div></div><div className="money-column"><span>المكتسب</span><strong>{money(captain.totalCommission)}</strong></div><div className="money-column"><span>المسدد</span><strong>{money(captain.totalPaid)}</strong></div><div className="money-column outstanding"><span>المتبقي</span><strong>{money(captain.balance)}</strong></div><button className="button button-settle" disabled={captain.balance <= 0} onClick={() => setSelected(captain)} data-testid={`button-settle-${captain.id}`}><Banknote size={16} /> تسوية</button></div>)}</div> : <StateMessage empty />}</section>{selected && <SettlementModal captain={selected} onClose={() => setSelected(null)} />}</>;
}

function CaptainDashboard() {
  const captainId = Number(localStorage.getItem('eltizam-captain-id') || 1);
  const summary = useGetCaptainFinancialSummary(captainId, { query: { queryKey: getGetCaptainFinancialSummaryQueryKey(captainId) } });
  const orders = useListOrders({ filter: 'today' });
  const updateOrder = useUpdateOrderStatus();
  const queryClient = useQueryClient();
  const mine = useMemo(() => (orders.data || []).filter((order: any) => !order.captainId || order.captainId === captainId), [orders.data, captainId]);
  const captain: any = summary.data?.captain;
  const handle = (id: number, status: 'claimed' | 'in_progress' | 'completed') => updateOrder.mutate({ id, data: { status, captainId } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey({ filter: 'today' }) }) });
  return <><PageHeader eyebrow="مساحة الكابتن" title={`أهلاً، ${captain?.name || 'كابتن التزام'}.`} description="هذه رحلاتك وذمتك المالية في لمحة واحدة." action={<div className="health-badge"><span className="healthy" /> متصل الآن</div>} /><div className="captain-hero"><div className="captain-hero-avatar"><Initials name={captain?.name} /></div><div className="captain-hero-copy"><span>الرصيد المستحق لك</span><strong>{money(summary.data?.pendingCommission)}</strong><small>يتم تحديثه بعد كل رحلة مكتملة</small></div><div className="captain-hero-trips"><span>رحلات اليوم</span><strong>{summary.data?.tripsToday ?? '—'}</strong><span>هذا الشهر {summary.data?.tripsThisMonth ?? '—'}</span></div></div><div className="metric-grid captain-metrics"><MetricCard label="رحلات اليوم" value={summary.data?.tripsToday} note="رحلات مكتملة" icon={Bike} accent="teal" loading={summary.isLoading} /><MetricCard label="رحلات الشهر" value={summary.data?.tripsThisMonth} note="إجمالي نشاطك" icon={CalendarClock} accent="navy" loading={summary.isLoading} /><MetricCard label="ذمتك الحالية" value={money(summary.data?.pendingCommission)} note="بانتظار التسوية" icon={WalletCards} accent="orange" loading={summary.isLoading} /></div><section className="surface captain-orders"><div className="surface-heading"><div><span className="section-kicker">المسار اليومي</span><h2>طلباتك الحالية</h2></div><Link href="/captain/orders" className="text-link" data-testid="link-captain-orders">عرض الكل <ArrowLeft size={15} /></Link></div>{orders.isLoading ? <div className="skeleton-list"><Skeleton /><Skeleton /></div> : orders.isError ? <StateMessage error onRetry={() => orders.refetch()} /> : mine.length ? mine.slice(0, 4).map((order: any) => <OrderRow key={order.id} order={order} onStatus={(status) => handle(order.id, status)} />) : <StateMessage empty />}</section></>;
}

function CaptainOrders() {
  const captainId = Number(localStorage.getItem('eltizam-captain-id') || 1);
  const orders = useListOrders({ filter: 'all' });
  const updateOrder = useUpdateOrderStatus();
  const queryClient = useQueryClient();
  const mine = (orders.data || []).filter((order: any) => order.captainId === captainId || !order.captainId);
  return <><PageHeader eyebrow="طلباتك" title="على الخط." description="كل ما تحتاجه لإتمام الرحلة القادمة، هنا." action={<button className="button button-primary" onClick={() => orders.refetch()} data-testid="button-refresh-captain-orders"><RefreshCw size={16} /> تحديث</button>} /><section className="surface orders-table"><div className="orders-table-head captain-head"><span>الطلب</span><span>المسار</span><span>العميل</span><span>الحالة</span><span>إجراء</span></div>{orders.isLoading ? <div className="skeleton-list"><Skeleton /><Skeleton /><Skeleton /></div> : orders.isError ? <StateMessage error onRetry={() => orders.refetch()} /> : mine.length ? mine.map((order: any) => <OrderRow key={order.id} order={order} onStatus={(status) => updateOrder.mutate({ id: order.id, data: { status, captainId } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey({ filter: 'all' }) }) })} />) : <StateMessage empty />}</section></>;
}

function AdminLayout({ children }: { children: ReactNode }) {
  const allowed = useRoleGuard('admin');
  return allowed ? <AppShell role="admin">{children}</AppShell> : null;
}

function CaptainLayout({ children }: { children: ReactNode }) {
  const allowed = useRoleGuard('captain');
  return allowed ? <AppShell role="captain">{children}</AppShell> : null;
}

function Router() {
  const [location] = useLocation();
  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/" component={PublicHome} />
        <Route path="/login" component={Login} />
        
        <Route path="/admin">
          {() => <AdminLayout><AdminOverview /></AdminLayout>}
        </Route>
        <Route path="/admin/orders">
          {() => <AdminLayout><AdminOrders /></AdminLayout>}
        </Route>
        <Route path="/admin/finance">
          {() => <AdminLayout><AdminFinance /></AdminLayout>}
        </Route>

        <Route path="/captain">
          {() => <CaptainLayout><CaptainDashboard /></CaptainLayout>}
        </Route>
        <Route path="/captain/orders">
          {() => <CaptainLayout><CaptainOrders /></CaptainLayout>}
        </Route>

        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;