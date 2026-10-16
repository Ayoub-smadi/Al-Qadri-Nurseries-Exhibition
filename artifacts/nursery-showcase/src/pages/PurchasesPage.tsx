import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, CircleDollarSign, ClipboardList, FilePlus2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { navigate } from "@/App";
import { toast } from "sonner";

type PurchaseInvoice = {
  id: string;
  type: string;
  number: string;
  entity: string;
  amount: string;
  registrationDate: string;
  duration: string;
  transferred: boolean;
  createdAt: string;
};
const STORAGE_KEY = "alqadri_purchase_invoices_v1";
const today = () => new Date().toISOString().slice(0, 10);
const blankInvoice = (): PurchaseInvoice => ({ id: `purchase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type: "", number: "", entity: "", amount: "", registrationDate: today(), duration: "", transferred: false, createdAt: new Date().toISOString() });
function readInvoices(): PurchaseInvoice[] {
  try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
const formatAmount = (value: string) => Number(value || 0).toLocaleString("ar-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700";

export default function PurchasesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>(readInvoices);
  const [invoice, setInvoice] = useState<PurchaseInvoice>(blankInvoice);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "transferred" | "pending">("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices)); }, [invoices]);
  const filtered = useMemo(() => invoices.filter(item => {
    const matchesSearch = [item.type, item.number, item.entity].some(value => value.toLocaleLowerCase("ar").includes(search.trim().toLocaleLowerCase("ar")));
    return matchesSearch && (statusFilter === "all" || item.transferred === (statusFilter === "transferred"));
  }), [invoices, search, statusFilter]);
  const total = invoices.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const transferredCount = invoices.filter(item => item.transferred).length;
  function openNew() { setInvoice(blankInvoice()); setFormOpen(true); }
  function edit(item: PurchaseInvoice) { setInvoice({ ...item }); setFormOpen(true); }
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoice.type.trim() || !invoice.number.trim() || !invoice.entity.trim() || !invoice.amount || Number(invoice.amount) < 0) {
      toast.error("يرجى تعبئة النوع والرقم والجهة والمبلغ بشكل صحيح"); return;
    }
    setInvoices(current => current.some(item => item.id === invoice.id) ? current.map(item => item.id === invoice.id ? invoice : item) : [invoice, ...current]);
    setFormOpen(false); toast.success("تم حفظ الفاتورة بنجاح");
  }
  function remove(id: string) { setInvoices(current => current.filter(item => item.id !== id)); setDeleteId(null); toast.success("تم حذف الفاتورة"); }
  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-800">
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-8">
      <div className="flex items-center gap-3"><button onClick={() => navigate("/")} className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold hover:bg-slate-200"><ArrowRight className="h-4 w-4"/>رجوع</button><div><h1 className="text-lg font-extrabold sm:text-xl">المشتريات</h1><p className="text-xs text-slate-500">إدارة فواتير المشتريات وحالة النقل</p></div></div>
      <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-900"><Plus className="h-4 w-4"/><span className="hidden sm:inline">إضافة فاتورة</span><span className="sm:hidden">إضافة</span></button>
    </header>
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-800"><ClipboardList className="h-6 w-6"/></div><div><p className="text-sm text-slate-500">إجمالي الفواتير</p><p className="text-2xl font-black">{invoices.length}</p></div></div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Check className="h-6 w-6"/></div><div><p className="text-sm text-slate-500">تم النقل</p><p className="text-2xl font-black">{transferredCount}</p></div></div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="rounded-xl bg-amber-50 p-3 text-amber-700"><CircleDollarSign className="h-6 w-6"/></div><div><p className="text-sm text-slate-500">إجمالي المبالغ</p><p className="text-xl font-black">{formatAmount(String(total))} <span className="text-xs font-semibold text-slate-400">د.أ</span></p></div></div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالنوع أو الرقم أو الجهة..." className={`${inputClass} pr-9`}/></div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className={`${inputClass} sm:w-48`}><option value="all">كل الحالات</option><option value="transferred">تم النقل</option><option value="pending">لم يتم النقل</option></select>
        </div>
        {filtered.length === 0 ? <div className="px-6 py-16 text-center"><div className="mx-auto mb-4 w-fit rounded-2xl bg-slate-100 p-4 text-slate-400"><FilePlus2 className="h-8 w-8"/></div><h2 className="font-bold">{invoices.length ? "لا توجد نتائج مطابقة" : "لا توجد فواتير مشتريات بعد"}</h2><p className="mt-1 text-sm text-slate-500">{invoices.length ? "جرّب تغيير كلمات البحث أو الحالة." : "أضف أول فاتورة لتبدأ بتنظيم مشترياتك."}</p>{!invoices.length && <button onClick={openNew} className="mt-5 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white">إضافة أول فاتورة</button>}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["النوع", "الرقم", "الجهة", "المبلغ", "تاريخ التسجيل", "المدة (يوم)", "الحالة", "الإجراءات"].map(label => <th key={label} className="whitespace-nowrap px-4 py-3 font-bold">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(item => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-semibold">{item.type}</td><td className="px-4 py-3 font-mono">{item.number}</td><td className="px-4 py-3">{item.entity}</td><td className="whitespace-nowrap px-4 py-3 font-bold">{formatAmount(item.amount)} <span className="text-xs font-normal text-slate-400">د.أ</span></td><td className="whitespace-nowrap px-4 py-3">{item.registrationDate || "—"}</td><td className="px-4 py-3">{item.duration ? `${item.duration} يوم` : "—"}</td><td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${item.transferred ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.transferred ? "تم النقل" : "لم يتم النقل"}</span></td><td className="px-4 py-3"><div className="flex items-center gap-1"><button aria-label="تعديل" title="تعديل" onClick={() => edit(item)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><Pencil className="h-4 w-4"/></button>{deleteId === item.id ? <><button onClick={() => remove(item.id)} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-bold text-white">تأكيد</button><button onClick={() => setDeleteId(null)} className="p-2 text-slate-500" aria-label="إلغاء"><X className="h-4 w-4"/></button></> : <button aria-label="حذف" title="حذف" onClick={() => setDeleteId(item.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4"/></button>}</div></td></tr>)}</tbody></table></div>}
        {filtered.length > 0 && <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">عرض {filtered.length} من أصل {invoices.length} فاتورة</div>}
      </section>
    </div>
    {formOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={e => { if (e.target === e.currentTarget) setFormOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="purchase-dialog-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><form onSubmit={save}><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 id="purchase-dialog-title" className="text-lg font-extrabold">{invoices.some(item => item.id === invoice.id) ? "تعديل فاتورة" : "إضافة فاتورة مشتريات"}</h2><p className="mt-0.5 text-xs text-slate-500">أدخل تفاصيل الفاتورة وحالة نقلها</p></div><button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="إغلاق"><X className="h-5 w-5"/></button></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2"><label><span className={labelClass}>النوع <b className="text-red-500">*</b></span><input autoFocus value={invoice.type} onChange={e => setInvoice({ ...invoice, type: e.target.value })} placeholder="مثال: فاتورة مواد زراعية" className={inputClass} required/></label><label><span className={labelClass}>الرقم <b className="text-red-500">*</b></span><input value={invoice.number} onChange={e => setInvoice({ ...invoice, number: e.target.value })} placeholder="رقم الفاتورة" className={inputClass} required/></label><label><span className={labelClass}>الجهة <b className="text-red-500">*</b></span><input value={invoice.entity} onChange={e => setInvoice({ ...invoice, entity: e.target.value })} placeholder="اسم الجهة أو المورد" className={inputClass} required/></label><label><span className={labelClass}>المبلغ (د.أ) <b className="text-red-500">*</b></span><input type="number" min="0" step="0.01" value={invoice.amount} onChange={e => setInvoice({ ...invoice, amount: e.target.value })} placeholder="0.00" className={inputClass} required/></label><label><span className={labelClass}>تاريخ التسجيل</span><input type="date" value={invoice.registrationDate} onChange={e => setInvoice({ ...invoice, registrationDate: e.target.value })} className={inputClass}/></label><label><span className={labelClass}>المدة (يوم)</span><input type="number" min="0" value={invoice.duration} onChange={e => setInvoice({ ...invoice, duration: e.target.value })} placeholder="عدد الأيام" className={inputClass}/></label><label className="sm:col-span-2"><span className={labelClass}>الحالة</span><select value={invoice.transferred ? "yes" : "no"} onChange={e => setInvoice({ ...invoice, transferred: e.target.value === "yes" })} className={inputClass}><option value="no">لم يتم النقل</option><option value="yes">تم النقل</option></select></label></div>
      <div className="flex justify-start gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4"><button type="submit" className="rounded-xl bg-emerald-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-900">حفظ الفاتورة</button><button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">إلغاء</button></div>
      </form></section></div>}
  </main>;
}
