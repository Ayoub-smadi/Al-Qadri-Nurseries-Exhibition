import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, CircleDollarSign, ClipboardList, Download, FilePlus2, LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { navigate } from "@/App";
import { loadSavedToken } from "@/lib/storage";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { sliceCanvasToPdf } from "@/lib/pdfMultiPage";

type PurchaseLineItem = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
};
type PurchaseInvoice = {
  id: string; type: string; number: string; entity: string; amount: string;
  registrationDate: string; duration: string; transferred: boolean; createdAt: string;
  driverName: string; items: PurchaseLineItem[];
};
const LEGACY_STORAGE_KEY = "alqadri_purchase_invoices_v1";
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const blankLineItem = (): PurchaseLineItem => ({ id: makeId(), description: "", quantity: "1", unitPrice: "" });
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const blankInvoice = (): PurchaseInvoice => ({ id: `purchase-${makeId()}`, type: "", number: "", entity: "", amount: "0", registrationDate: today(), duration: "", transferred: false, createdAt: new Date().toISOString(), driverName: "", items: [blankLineItem()] });
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
function cleanNumberInput(value: string, decimals = 2) {
  const raw = value.replace(/,/g, "").replace(/[^0-9.]/g, "");
  const [whole, ...parts] = raw.split(".");
  return parts.length ? `${whole}.${parts.join("").slice(0, decimals)}` : whole;
}
function calculateItemsTotal(items: PurchaseLineItem[]) {
  return items.reduce((total, item) => total + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
}
function normalizeInvoice(item: PurchaseInvoice): PurchaseInvoice {
  return { ...item, driverName: item.driverName || "", items: Array.isArray(item.items) ? item.items : [] };
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
  const [pdfId, setPdfId] = useState<string | null>(null);
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
      let records = (result.invoices || []).map(normalizeInvoice);
      // Idempotent migration: API inserts ignore duplicate IDs so interrupted imports can resume.
      const legacy = readLegacyInvoices();
      if (legacy.length) {
        for (const record of legacy) await api("", { method: "POST", body: JSON.stringify(record) });
        const refreshed = await api("") as { invoices: PurchaseInvoice[] };
        records = (refreshed.invoices || []).map(normalizeInvoice);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        toast.success("تم نقل الفواتير السابقة إلى قاعدة البيانات");
      }
      setInvoices(records);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل الفواتير"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadInvoices(); /* token is read on page entry */ }, []);
  const filtered = useMemo(() => invoices.filter(item => {
    const itemText = item.items.map(line => line.description).join(" ");
    const matchesSearch = [item.type, item.number, item.entity, item.driverName, itemText].some(value => value.toLocaleLowerCase("ar").includes(search.trim().toLocaleLowerCase("ar")));
    return matchesSearch && (statusFilter === "all" || item.transferred === (statusFilter === "transferred"));
  }), [invoices, search, statusFilter]);
  const total = invoices.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const transferredCount = invoices.filter(item => item.transferred).length;
  const formTotal = invoice.items.length ? calculateItemsTotal(invoice.items) : Number(invoice.amount) || 0;
  function openNew() { setInvoice(blankInvoice()); setAmountFocused(false); setFormOpen(true); }
  function edit(item: PurchaseInvoice) { setInvoice(normalizeInvoice(item)); setAmountFocused(false); setFormOpen(true); }
  function updateLine(lineId: string, key: keyof Omit<PurchaseLineItem, "id">, value: string) {
    setInvoice(current => ({ ...current, items: current.items.map(line => line.id === lineId ? { ...line, [key]: value } : line) }));
  }
  function addLine() { setInvoice(current => ({ ...current, items: [...current.items, blankLineItem()] })); }
  function removeLine(lineId: string) { setInvoice(current => ({ ...current, items: current.items.filter(line => line.id !== lineId) })); }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const enteredLines = invoice.items.filter(item => item.description.trim());
    if (invoice.items.some(item => !item.description.trim() && (item.unitPrice.trim() || item.quantity !== "1"))) {
      toast.error("أدخل اسم الصنف لكل بند تمت تعبئته"); return;
    }
    for (const line of enteredLines) {
      if (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0) { toast.error("يرجى إدخال كمية أكبر من صفر لكل بند"); return; }
      if (line.unitPrice.trim() && (!Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) < 0)) { toast.error("يرجى إدخال سعر صحيح وغير سالب لكل بند"); return; }
    }
    const amount = invoice.items.length ? calculateItemsTotal(enteredLines).toFixed(2) : invoice.amount;
    if (amount.trim() && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) {
      toast.error("يرجى إدخال مبلغ صحيح وغير سالب"); return;
    }
    const payload: PurchaseInvoice = { ...invoice, items: enteredLines, amount };
    setSaving(true);
    try {
      const exists = invoices.some(item => item.id === invoice.id);
      await api(exists ? `/${encodeURIComponent(invoice.id)}` : "", { method: exists ? "PUT" : "POST", body: JSON.stringify(payload) });
      setInvoices(current => exists ? current.map(item => item.id === invoice.id ? payload : item) : [payload, ...current]);
      setFormOpen(false); toast.success("تم حفظ الفاتورة في قاعدة البيانات");
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "تعذر حفظ الفاتورة"); }
    finally { setSaving(false); }
  }
  async function downloadPdf(item: PurchaseInvoice) {
    setPdfId(item.id);
    let host: HTMLDivElement | null = null;
    try {
      const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char] ?? char));
      const lines = Array.isArray(item.items) ? item.items : [];
      const lineRows = lines.length ? lines.map((line, index) => {
        const quantity = Number(line.quantity) || 0;
        const unitPrice = Number(line.unitPrice) || 0;
        return `<tr><td style="text-align:center">${index + 1}</td><td>${escapeHtml(line.description || "—")}</td><td style="text-align:center;direction:ltr">${escapeHtml(line.quantity || "0")}</td><td style="text-align:left;direction:ltr">${formatAmount(String(unitPrice))} د.أ</td><td style="text-align:left;direction:ltr;font-weight:700">${formatAmount(String(quantity * unitPrice))} د.أ</td></tr>`;
      }).join("") : `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:22px">لا توجد تفاصيل بنود مسجلة لهذه الفاتورة</td></tr>`;
      host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-12000px;top:0;z-index:-1;width:794px;background:#fff;";
      host.innerHTML = `<article dir="rtl" style="box-sizing:border-box;width:794px;min-height:1122px;padding:52px 54px;background:#fff;color:#17212b;font-family:Cairo,Arial,sans-serif;direction:rtl;unicode-bidi:plaintext;font-size:14px;line-height:1.6">
        <header style="border-bottom:4px double #176548;padding-bottom:20px;margin-bottom:24px;text-align:center">
          <div style="font-size:15px;font-weight:700;color:#64748b">مؤسسة القادري الزراعية</div>
          <h1 style="font-size:30px;line-height:1.25;color:#14583f;margin:8px 0 4px;font-weight:900">فاتورة مشتريات</h1>
          <div style="font-size:13px;color:#64748b">${escapeHtml(item.type || "")}</div>
        </header>
        <table dir="rtl" style="width:100%;border-collapse:collapse;margin-bottom:24px"><tbody>
          <tr><td style="width:50%;border:1px solid #dbe3e8;padding:10px"><b>رقم الفاتورة:</b> ${escapeHtml(item.number || "—")}</td><td style="width:50%;border:1px solid #dbe3e8;padding:10px"><b>تاريخ التسجيل:</b> ${escapeHtml(item.registrationDate || "—")}</td></tr>
          <tr><td style="border:1px solid #dbe3e8;padding:10px"><b>الجهة / المورد:</b> ${escapeHtml(item.entity || "—")}</td><td style="border:1px solid #dbe3e8;padding:10px"><b>اسم السائق:</b> ${escapeHtml(item.driverName || "—")}</td></tr>
          <tr><td style="border:1px solid #dbe3e8;padding:10px"><b>حالة النقل:</b> ${item.transferred ? "تم النقل" : "لم يتم النقل"}</td><td style="border:1px solid #dbe3e8;padding:10px"><b>عدد البنود:</b> ${lines.length}</td></tr>
        </tbody></table>
        <h2 style="font-size:17px;color:#14583f;margin:0 0 10px;font-weight:800">تفاصيل البنود</h2>
        <table dir="rtl" style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#eaf4ef;color:#14583f"><th style="border:1px solid #cbd9d1;padding:10px">#</th><th style="border:1px solid #cbd9d1;padding:10px;text-align:right">الصنف</th><th style="border:1px solid #cbd9d1;padding:10px">الكمية</th><th style="border:1px solid #cbd9d1;padding:10px">سعر الوحدة</th><th style="border:1px solid #cbd9d1;padding:10px">الإجمالي</th></tr></thead><tbody>${lineRows}</tbody></table>
        <div style="margin-top:22px;border:2px solid #176548;border-radius:8px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;background:#f3faf6"><strong style="font-size:17px;color:#14583f">المبلغ الإجمالي</strong><strong style="font-size:20px;color:#14583f;direction:ltr">${formatAmount(item.amount)} د.أ</strong></div>
        <footer style="margin-top:44px;border-top:1px solid #dbe3e8;padding-top:12px;text-align:center;font-size:11px;color:#64748b">تم إنشاء هذه الفاتورة إلكترونيًا من نظام مؤسسة القادري الزراعية</footer>
      </article>`;
      document.body.appendChild(host);
      await document.fonts.ready;
      const paper = host.firstElementChild as HTMLElement;
      const canvas = await html2canvas(paper, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff", logging: false, width: paper.scrollWidth, height: paper.scrollHeight, scrollX: 0, scrollY: 0 });
      const safeNumber = (item.number || item.id).replace(/[^\u0600-\u06FFa-zA-Z0-9_-]/g, "_");
      await sliceCanvasToPdf(canvas, paper, `فاتورة_مشتريات_${safeNumber}.pdf`, paper.scrollWidth);
      toast.success("تم تنزيل الفاتورة بصيغة PDF");
    } catch (cause) {
      toast.error(`تعذر إنشاء ملف PDF: ${cause instanceof Error ? cause.message : "خطأ غير معروف"}`);
    } finally {
      host?.remove();
      setPdfId(null);
    }
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
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-sm"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالنوع أو الرقم أو الجهة أو السائق..." className={`${inputClass} pr-9`}/></div><select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className={`${inputClass} sm:w-48`}><option value="all">كل الحالات</option><option value="transferred">تم النقل</option><option value="pending">لم يتم النقل</option></select></div>
        {loading ? <div className="flex items-center justify-center gap-2 px-6 py-16 text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin"/>جارٍ تحميل البيانات من قاعدة البيانات...</div> : error ? <div className="px-6 py-14 text-center"><p className="font-bold text-red-700">{error}</p><button onClick={() => void loadInvoices()} className="mt-4 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white">إعادة المحاولة</button></div> : filtered.length === 0 ? <div className="px-6 py-16 text-center"><div className="mx-auto mb-4 w-fit rounded-2xl bg-slate-100 p-4 text-slate-400"><FilePlus2 className="h-8 w-8"/></div><h2 className="font-bold">{invoices.length ? "لا توجد نتائج مطابقة" : "لا توجد فواتير مشتريات بعد"}</h2><p className="mt-1 text-sm text-slate-500">{invoices.length ? "جرّب تغيير كلمات البحث أو الحالة." : "أضف أول فاتورة لتبدأ بتنظيم مشترياتك."}</p>{!invoices.length && token && <button onClick={openNew} className="mt-5 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white">إضافة أول فاتورة</button>}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["النوع", "الرقم", "الجهة", "السائق", "عدد البنود", "المبلغ", "تاريخ التسجيل", "المدة", "الحالة", "الإجراءات"].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 font-bold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(item => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-semibold">{item.type || "—"}</td><td className="px-4 py-3 font-mono">{item.number || "—"}</td><td className="px-4 py-3">{item.entity || "—"}</td><td className="px-4 py-3">{item.driverName || "—"}</td><td className="px-4 py-3">{item.items.length || "—"}</td><td className="whitespace-nowrap px-4 py-3 font-bold">{formatAmount(item.amount)} <span className="text-xs font-normal text-slate-400">د.أ</span></td><td className="whitespace-nowrap px-4 py-3">{item.registrationDate || "—"}</td><td className="px-4 py-3">{elapsedDays(item.registrationDate)}</td><td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${item.transferred ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.transferred ? "تم النقل" : "لم يتم النقل"}</span></td><td className="px-4 py-3"><div className="flex items-center gap-1"><button aria-label="تنزيل PDF" title="تنزيل PDF" onClick={() => void downloadPdf(item)} disabled={pdfId === item.id} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">{pdfId === item.id ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}</button><button aria-label="تعديل" title="تعديل" onClick={() => edit(item)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><Pencil className="h-4 w-4"/></button>{deleteId === item.id ? <><button onClick={() => void remove(item.id)} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white">تأكيد</button><button onClick={() => setDeleteId(null)} className="p-2 text-slate-500" aria-label="إلغاء"><X className="h-4 w-4"/></button></> : <button aria-label="حذف" title="حذف" onClick={() => setDeleteId(item.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4"/></button>}</div></td></tr>)}</tbody></table></div>}
      </section>
    </div>
    {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={e => { if (e.target === e.currentTarget) setFormOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="purchase-dialog-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><form onSubmit={save}><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="purchase-dialog-title" className="text-lg font-extrabold">{invoices.some(item => item.id === invoice.id) ? "تعديل فاتورة" : "إضافة فاتورة مشتريات"}</h2><p className="mt-0.5 text-xs text-slate-500">أدخل بيانات الفاتورة والبنود والكميات واسم السائق</p></div><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="إغلاق"><X className="h-5 w-5"/></button></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2"><label><span className={labelClass}>النوع <span className="font-normal text-slate-400">(اختياري)</span></span><input autoFocus value={invoice.type} onChange={e => setInvoice({ ...invoice, type: e.target.value })} placeholder="مثال: مشتريات" className={inputClass}/></label><label><span className={labelClass}>الرقم <span className="font-normal text-slate-400">(اختياري)</span></span><input value={invoice.number} onChange={e => setInvoice({ ...invoice, number: e.target.value })} placeholder="رقم الفاتورة" className={inputClass}/></label><label><span className={labelClass}>الجهة <span className="font-normal text-slate-400">(اختياري)</span></span><input value={invoice.entity} onChange={e => setInvoice({ ...invoice, entity: e.target.value })} placeholder="اسم الجهة أو المورد" className={inputClass}/></label><label><span className={labelClass}>اسم السائق <span className="font-normal text-slate-400">(اختياري)</span></span><input value={invoice.driverName} onChange={e => setInvoice({ ...invoice, driverName: e.target.value })} placeholder="اسم سائق النقل" className={inputClass}/></label>
      <label><span className={labelClass}>تاريخ التسجيل</span><input type="date" value={invoice.registrationDate} onChange={e => setInvoice({ ...invoice, registrationDate: e.target.value })} className={inputClass}/><span className="mt-1 block text-xs text-slate-400">المدة تبدأ من يوم التسجيل</span></label><div><span className={labelClass}>المدة</span><div className={`${inputClass} flex h-[42px] items-center bg-slate-50 text-slate-500`}>تُحسب تلقائيًا من تاريخ التسجيل</div></div>
      <div className="sm:col-span-2"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-slate-800">بنود الفاتورة</h3><p className="mt-0.5 text-xs text-slate-500">أضف صنفًا أو أكثر؛ المجموع يُحسب تلقائيًا من الكمية وسعر الوحدة.</p></div><button type="button" onClick={addLine} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"><Plus className="h-4 w-4"/>إضافة بند</button></div>
        <div className="space-y-3">{invoice.items.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">لا توجد بنود مضافة. يمكنك إضافة بند أو إدخال مبلغ الفاتورة يدويًا.</div>}{invoice.items.map((line, index) => <div key={line.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_110px_150px_40px] sm:items-end"><label className="sm:col-span-1"><span className="mb-1 block text-xs font-semibold text-slate-600">الصنف {index + 1}</span><input value={line.description} onChange={e => updateLine(line.id, "description", e.target.value)} placeholder="اسم الصنف أو وصفه" className={inputClass}/></label><label><span className="mb-1 block text-xs font-semibold text-slate-600">الكمية</span><input type="number" min="0.01" step="0.01" inputMode="decimal" dir="ltr" value={line.quantity} onChange={e => updateLine(line.id, "quantity", e.target.value)} className={`${inputClass} text-left font-mono`}/></label><label><span className="mb-1 block text-xs font-semibold text-slate-600">سعر الوحدة (د.أ)</span><input type="number" min="0" step="0.01" inputMode="decimal" dir="ltr" value={line.unitPrice} onChange={e => updateLine(line.id, "unitPrice", e.target.value)} placeholder="0.00" className={`${inputClass} text-left font-mono`}/></label><button type="button" onClick={() => removeLine(line.id)} disabled={invoice.items.length === 1} aria-label={`حذف البند ${index + 1}`} title="حذف البند" className="flex h-[42px] items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"><Trash2 className="h-4 w-4"/></button></div>)}</div>
      </div>
      <div className="sm:col-span-2">{invoice.items.length ? <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3"><span className="text-sm font-bold text-emerald-900">إجمالي الفاتورة</span><span className="text-lg font-black text-emerald-900">{formatAmount(String(formTotal))} <span className="text-xs">د.أ</span></span></div> : <label><span className={labelClass}>المبلغ الإجمالي <span className="font-normal text-slate-400">(فاتورة قديمة بلا تفاصيل بنود)</span></span><div className="relative"><input type="text" inputMode="decimal" dir="ltr" value={amountFocused ? invoice.amount : formatAmountInput(invoice.amount)} onFocus={() => setAmountFocused(true)} onBlur={() => setAmountFocused(false)} onChange={e => setInvoice({ ...invoice, amount: cleanNumberInput(e.target.value) })} placeholder="0.00" className={`${inputClass} pl-14 text-left font-mono text-base`}/><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">د.أ</span></div></label>}</div>
      <label className="sm:col-span-2"><span className={labelClass}>الحالة</span><select value={invoice.transferred ? "yes" : "no"} onChange={e => setInvoice({ ...invoice, transferred: e.target.value === "yes" })} className={inputClass}><option value="no">لم يتم النقل</option><option value="yes">تم النقل</option></select></label></div>
      <div className="flex justify-start gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4"><button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-60">{saving && <LoaderCircle className="h-4 w-4 animate-spin"/>}حفظ الفاتورة</button><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">إلغاء</button></div>
      </form></section></div>}
  </main>;
}
