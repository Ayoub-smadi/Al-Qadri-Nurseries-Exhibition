import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, CircleDollarSign, ClipboardList, FilePlus2, LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { navigate } from "@/App";
import { loadSavedToken } from "@/lib/storage";
import { toast } from "sonner";

type PurchaseInvoice = {
  id: string; type: string; number: string; entity: string; amount: string;
  registrationDate: string; duration: string; transferred: boolean; createdAt: string;
};
const LEGACY_STORAGE_KEY = "alqadri_purchase_invoices_v1";
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const blankInvoice = (): PurchaseInvoice => ({ id: `purchase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type: "", number: "", entity: "", amount: "", registrationDate: today(), duration: "", transferred: false, createdAt: new Date().toISOString() });
function readLegacyInvoices(): PurchaseInvoice[] {
  try { const parsed = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
const formatAmount = (value: string) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
function elapsedDays(date: string) {
  if (!date) return "—";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return "—";
  const start = Date.UTC(year, month - 1, day);
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return `${Math.max(1, Math.floor((todayUtc - start) / 86400000) + 1)} يوم`;
}
function formatAmountInput(value: string) {
  if (!value) return "";
  const [integer, fraction] = value.split(".");
  const grouped = (integer || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700";

export default function PurchasesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [invoice, setInvoice] = useState<PurchaseInvoice>(blankInvoice);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "transferred" | "pending">("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [error, setError] = useState("");
  const token = loadSavedToken();

  async function api(path: string, init: RequestInit = {}) {
    const response = await fetch(`/api/purchase-invoices${path}`, {
      ...init,
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}`, ...init.headers },
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error("انتهت جلسة الإدارة. ارجع إلى الصفحة الرئيسية وسجّل الدخول مرة أخرى.");
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.error || "تعذر التواصل مع قاعدة البيانات");
    }
    return response.status === 204 ? null : response.json();
  }
  async function loadInvoices() {
    if (!token) { setError("يلزم تسجيل الدخول كمسؤول لعرض فواتير المشتريات."); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const result = await api("") as { invoices: PurchaseInvoice[] };
      let records = result.invoices || [];
      // Idempotent migration: API inserts ignore duplicate IDs so interrupted imports can resume.
      const legacy = readLegacyInvoices();
      if (legacy.length) {
        for (const record of legacy) await api("", { method: "POST", body: JSON.stringify(record) });
        const refreshed = await api("") as { invoices: PurchaseInvoice[] };
        records = refreshed.invoices || [];
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        toast.success("تم نقل الفواتير السابقة إلى قاعدة البيانات");
      }
      setInvoices(records);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل الفواتير"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadInvoices(); /* token is read on page entry */ }, []);
  const filtered = useMemo(() => invoices.filter(item => {
    const matchesSearch = [item.type, item.number, item.entity].some(value => value.toLocaleLowerCase("ar").includes(search.trim().toLocaleLowerCase("ar")));
    return matchesSearch && (statusFilter === "all" || item.transferred === (statusFilter === "transferred"));
  }), [invoices, search, statusFilter]);
  const total = invoices.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const transferredCount = invoices.filter(item => item.transferred).length;
  function openNew() { setInvoice(blankInvoice()); setFormOpen(true); }
  function edit(item: PurchaseInvoice) { setInvoice({ ...item }); setFormOpen(true); }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (invoice.amount.trim() && (!Number.isFinite(Number(invoice.amount)) || Number(invoice.amount) < 0)) {
      toast.error("يرجى إدخال مبلغ صحيح وغير سالب"); return;
    }
    setSaving(true);
    try {
      const exists = invoices.some(item => item.id === invoice.id);
      await api(exists ? `/${encodeURIComponent(invoice.id)}` : "", { method: exists ? "PUT" : "POST", body: JSON.stringify(invoice) });
      setInvoices(current => exists ? current.map(item => item.id === invoice.id ? invoice : item) : [invoice, ...current]);
      setFormOpen(false); toast.success("تم حفظ الفاتورة في قاعدة البيانات");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "تعذر حفظ الفاتورة"); }
    finally { setSaving(false); }
  }
  async function remove(id: string) {
    try { await api(`/${encodeURIComponent(id)}`, { method: "DELETE" }); setInvoices(current => current.filter(item => item.id !== id)); setDeleteId(null); toast.success("تم حذف الفاتورة"); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "تعذر حذف الفاتورة"); }
  }
  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-800">
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-8">
      <div className="flex items-center gap-3"><button onClick={() => navigate("/")} className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold hover:bg-slate-200"><ArrowRight className="h-4 w-4"/>رجوع</button><div><h1 className="text-lg font-extrabold sm:text-xl">المشتريات</h1><p className="text-xs text-slate-500">إدارة فواتير المشتريات وحالة النقل</p></div></div>
      <button onClick={openNew} disabled={loading || !token} className="flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-900 disabled:opacity-50"><Plus className="h-4 w-4"/><span className="hidden sm:inline">إضافة فاتورة</span><span className="sm:hidden">إضافة</span></button>
    </header>
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-800"><ClipboardList className="h-6 w-6"/></div><div><p className="text-sm text-slate-500">إجمالي الفواتير</p><p className="text-2xl font-black">{invoices.length}</p></div></div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Check className="h-6 w-6"/></div><div><p className="text-sm text-slate-500">تم النقل</p><p className="text-2xl font-black">{transferredCount}</p></div></div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="rounded-xl bg-amber-50 p-3 text-amber-700"><CircleDollarSign className="h-6 w-6"/></div><div><p className="text-sm text-slate-500">إجمالي المبالغ</p><p className="text-xl font-black">{formatAmount(String(total))} <span className="text-xs font-semibold text-slate-400">د.أ</span></p></div></div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-sm"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالنوع أو الرقم أو الجهة..." className={`${inputClass} pr-9`}/></div><select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className={`${inputClass} sm:w-48`}><option value="all">كل الحالات</option><option value="transferred">تم النقل</option><option value="pending">لم يتم النقل</option></select></div>
        {loading ? <div className="flex items-center justify-center gap-2 px-6 py-16 text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin"/>جارٍ تحميل البيانات من قاعدة البيانات...</div> : error ? <div className="px-6 py-14 text-center"><p className="font-bold text-red-700">{error}</p><button onClick={() => void loadInvoices()} className="mt-4 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white">إعادة المحاولة</button></div> : filtered.length === 0 ? <div className="px-6 py-16 text-center"><div className="mx-auto mb-4 w-fit rounded-2xl bg-slate-100 p-4 text-slate-400"><FilePlus2 className="h-8 w-8"/></div><h2 className="font-bold">{invoices.length ? "لا توجد نتائج مطابقة" : "لا توجد فواتير مشتريات بعد"}</h2><p className="mt-1 text-sm text-slate-500">{invoices.length ? "جرّب تغيير كلمات البحث أو الحالة." : "أضف أول فاتورة لتبدأ بتنظيم مشترياتك."}</p>{!invoices.length && token && <button onClick={openNew} className="mt-5 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white">إضافة أول فاتورة</button>}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["النوع", "الرقم", "الجهة", "المبلغ", "تاريخ التسجيل", "المدة (تتجدد يوميًا)", "الحالة", "الإجراءات"].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 font-bold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(item => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-semibold">{item.type || "—"}</td><td className="px-4 py-3 font-mono">{item.number || "—"}</td><td className="px-4 py-3">{item.entity || "—"}</td><td className="whitespace-nowrap px-4 py-3 font-bold">{formatAmount(item.amount)} <span className="text-xs font-normal text-slate-400">د.أ</span></td><td className="whitespace-nowrap px-4 py-3">{item.registrationDate || "—"}</td><td className="px-4 py-3">{elapsedDays(item.registrationDate)}</td><td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${item.transferred ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.transferred ? "تم النقل" : "لم يتم النقل"}</span></td><td className="px-4 py-3"><div className="flex items-center gap-1"><button aria-label="تعديل" title="تعديل" onClick={() => edit(item)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><Pencil className="h-4 w-4"/></button>{deleteId === item.id ? <><button onClick={() => void remove(item.id)} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white">تأكيد</button><button onClick={() => setDeleteId(null)} className="p-2 text-slate-500" aria-label="إلغاء"><X className="h-4 w-4"/></button></> : <button aria-label="حذف" title="حذف" onClick={() => setDeleteId(item.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4"/></button>}</div></td></tr>)}</tbody></table></div>}
        {filtered.length > 0 && <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">عرض {filtered.length} من أصل {invoices.length} فاتورة محفوظة في قاعدة البيانات</div>}
      </section>
    </div>
    {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={e => { if (e.target === e.currentTarget) setFormOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="purchase-dialog-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><form onSubmit={save}><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="purchase-dialog-title" className="text-lg font-extrabold">{invoices.some(item => item.id === invoice.id) ? "تعديل فاتورة" : "إضافة فاتورة مشتريات"}</h2><p className="mt-0.5 text-xs text-slate-500">أدخل تفاصيل الفاتورة وحالة نقلها</p></div><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="إغلاق"><X className="h-5 w-5"/></button></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2"><label><span className={labelClass}>النوع <span className="font-normal text-slate-400">(اختياري)</span></span><input autoFocus value={invoice.type} onChange={e => setInvoice({ ...invoice, type: e.target.value })} placeholder="مثال: مشتريات" className={inputClass}/></label><label><span className={labelClass}>الرقم <span className="font-normal text-slate-400">(اختياري)</span></span><input value={invoice.number} onChange={e => setInvoice({ ...invoice, number: e.target.value })} placeholder="رقم الفاتورة" className={inputClass}/></label><label><span className={labelClass}>الجهة <span className="font-normal text-slate-400">(اختياري)</span></span><input value={invoice.entity} onChange={e => setInvoice({ ...invoice, entity: e.target.value })} placeholder="اسم الجهة أو المورد" className={inputClass}/></label><label><span className={labelClass}>المبلغ <span className="font-normal text-slate-400">(اختياري)</span></span><div className="relative"><input type="text" inputMode="decimal" dir="ltr" value={amountFocused ? invoice.amount : formatAmountInput(invoice.amount)} onFocus={() => setAmountFocused(true)} onBlur={() => setAmountFocused(false)} onChange={e => { const raw = e.target.value.replace(/,/g, "").replace(/[^0-9.]/g, ""); const [whole, ...decimals] = raw.split("."); setInvoice({ ...invoice, amount: decimals.length ? `${whole}.${decimals.join("").slice(0, 2)}` : whole }); }} placeholder="0.00" className={`${inputClass} pl-14 text-left font-mono text-base`} /><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">د.أ</span></div><span className="mt-1 block text-xs text-slate-400">أدخل رقمًا؛ مثال: 1,250.00</span></label><label><span className={labelClass}>تاريخ التسجيل</span><input type="date" value={invoice.registrationDate} onChange={e => setInvoice({ ...invoice, registrationDate: e.target.value })} className={inputClass}/><span className="mt-1 block text-xs text-slate-400">المدة تبدأ من يوم التسجيل</span></label><div><span className={labelClass}>المدة</span><div className={`${inputClass} flex h-[42px] items-center bg-slate-50 text-slate-500`}>تُحسب تلقائيًا من تاريخ التسجيل</div></div><label className="sm:col-span-2"><span className={labelClass}>الحالة</span><select value={invoice.transferred ? "yes" : "no"} onChange={e => setInvoice({ ...invoice, transferred: e.target.value === "yes" })} className={inputClass}><option value="no">لم يتم النقل</option><option value="yes">تم النقل</option></select></label></div>
      <div className="flex justify-start gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4"><button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-60">{saving && <LoaderCircle className="h-4 w-4 animate-spin"/>}حفظ الفاتورة</button><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">إلغاء</button></div>
      </form></section></div>}
  </main>;
}
