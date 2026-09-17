import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Download, Eye, FilePlus2, Pencil, Save, Trash2, Plus, X } from "lucide-react";
import { navigate } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type PurchaseItem = {
  id: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  origin: string;
  notes: string;
};

type PurchaseOrder = {
  id: string;
  number: string;
  orderDate: string;
  deliveryDate: string;
  currency: string;
  supplier: { name: string; contact: string; phone: string; email: string; address: string };
  items: PurchaseItem[];
  tax: string;
  deliveryFees: string;
  notes: string;
  paymentMethod: string;
  paymentTerms: string;
  createdAt: string;
};

const ORDERS_KEY = "alqadri_purchase_orders";
const DRAFT_KEY = "alqadri_purchase_order_draft";
const LAST_NUMBER_KEY = "alqadri_purchase_order_last_number";
const today = () => new Date().toISOString().slice(0, 10);
const id = () => `po-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const blankSupplier = () => ({ name: "", contact: "", phone: "", email: "", address: "" });
const blankItem = (): PurchaseItem => ({ id: id(), description: "", unit: "", quantity: "", unitPrice: "", origin: "", notes: "" });

function nextNumber() {
  const last = Number(localStorage.getItem(LAST_NUMBER_KEY) || "0") + 1;
  localStorage.setItem(LAST_NUMBER_KEY, String(last));
  return `PO ${String(last).padStart(6, "0")}`;
}

function newOrder(): PurchaseOrder {
  return {
    id: id(), number: nextNumber(), orderDate: today(), deliveryDate: "", currency: "",
    supplier: blankSupplier(), items: [], tax: "", deliveryFees: "", notes: "", paymentMethod: "", paymentTerms: "", createdAt: new Date().toISOString(),
  };
}

function readOrders(): PurchaseOrder[] {
  try { const value = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
}
function money(value: string) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function fmt(value: number) { return value.toLocaleString("ar-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function orderTotal(order: PurchaseOrder) {
  const subtotal = order.items.reduce((sum, item) => sum + money(item.quantity) * money(item.unitPrice), 0);
  return subtotal + money(order.tax) + money(order.deliveryFees);
}

const fieldClass = "h-11 rounded-xl border-slate-200 bg-white text-right focus-visible:ring-[#0d5c43]";
const labelClass = "mb-2 block text-sm font-bold text-slate-700";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:rounded-none print:border-slate-300 print:shadow-none">
    <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-3"><span className="h-6 w-1 rounded-full bg-[#0d5c43]" /><h2 className="text-lg font-extrabold text-[#0d5c43]">{title}</h2></div>{children}
  </section>;
}

function TextField({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <label className="block"><span className={labelClass}>{label}</span><Input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className={fieldClass} /></label>;
}

export default function PurchaseOrdersPage() {
  const paperRef = useRef<HTMLElement>(null);
  const [order, setOrder] = useState<PurchaseOrder>(() => {
    try { const draft = localStorage.getItem(DRAFT_KEY); if (draft) return JSON.parse(draft); } catch { /* use new */ }
    return newOrder();
  });
  const [orders, setOrders] = useState<PurchaseOrder[]>(() => readOrders());
  const [showList, setShowList] = useState(false);

  useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify(order)); }, [order]);

  const subtotal = useMemo(() => order.items.reduce((sum, item) => sum + money(item.quantity) * money(item.unitPrice), 0), [order.items]);
  const total = subtotal + money(order.tax) + money(order.deliveryFees);
  const set = <K extends keyof PurchaseOrder>(key: K, value: PurchaseOrder[K]) => setOrder(prev => ({ ...prev, [key]: value }));
  const setSupplier = (key: keyof PurchaseOrder["supplier"], value: string) => setOrder(prev => ({ ...prev, supplier: { ...prev.supplier, [key]: value } }));
  const setItem = (itemId: string, key: keyof PurchaseItem, value: string) => setOrder(prev => ({ ...prev, items: prev.items.map(item => item.id === itemId ? { ...item, [key]: value } : item) }));

  function createNew() { setOrder(newOrder()); window.scrollTo({ top: 0, behavior: "smooth" }); toast.success("تم إنشاء طلب شراء جديد"); }
  function save() {
    const next = [...orders.filter(item => item.id !== order.id), order];
    setOrders(next); localStorage.setItem(ORDERS_KEY, JSON.stringify(next)); toast.success(`تم حفظ ${order.number}`);
  }
  function removeSaved(orderId: string) { const next = orders.filter(item => item.id !== orderId); setOrders(next); localStorage.setItem(ORDERS_KEY, JSON.stringify(next)); if (orderId === order.id) createNew(); toast.success("تم حذف الطلب"); }
  function loadSaved(saved: PurchaseOrder) { setOrder(saved); setShowList(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function downloadPdf() {
    if (!paperRef.current) return;
    const element = paperRef.current;
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    const pageWidth = 297;
    const pageHeight = 210;
    const margin = 7;
    const ratio = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
    const width = canvas.width * ratio;
    const height = canvas.height * ratio;
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height);
    pdf.save(`طلب_شراء_${order.number.replace(" ", "_")}.pdf`);
    toast.success("تم تنزيل ملف PDF بنجاح");
  }

  return <div dir="rtl" className="min-h-screen bg-[#f4f7f5] text-slate-800 print:bg-white">
    <style>{`.pdf-brand-image { object-fit: contain; } @media print { @page { size: A4 landscape; margin: 7mm; } .no-print { display:none!important } .po-page { padding:0!important; max-width:none!important } input,textarea { border:0!important; box-shadow:none!important; padding:0!important } section { break-inside: avoid; } }`}</style>
    <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
      <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="العودة"><ArrowRight className="h-5 w-5" /></Button><div><p className="text-xs font-semibold text-[#0d5c43]">مؤسسة القادري الزراعية</p><h1 className="text-xl font-black text-slate-900">طلبات الشراء</h1></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setShowList(true)} className="rounded-xl"><Eye className="ms-2 h-4 w-4" /> الطلبات المحفوظة</Button><Button variant="outline" onClick={createNew} className="rounded-xl"><FilePlus2 className="ms-2 h-4 w-4" /> طلب شراء جديد</Button><Button onClick={save} className="rounded-xl bg-[#0d5c43] hover:bg-[#084834]"><Save className="ms-2 h-4 w-4" /> حفظ الطلب</Button><Button onClick={downloadPdf} className="rounded-xl bg-slate-800 hover:bg-slate-700"><Download className="ms-2 h-4 w-4" /> تنزيل PDF</Button></div>
    </div></header>

    <main ref={paperRef} className="po-page mx-auto max-w-6xl space-y-5 bg-white px-4 py-7">
      <div className="rounded-2xl bg-[#0d5c43] p-6 text-white shadow-lg print:rounded-none print:bg-white print:p-0 print:text-slate-900 print:shadow-none"><div className="flex flex-wrap items-center justify-between gap-5"><div className="flex items-center gap-4"><img src="/logo-alkadri.jpg" alt="شعار مؤسسة القادري الزراعية" className="pdf-brand-image h-16 w-40 rounded-lg bg-white p-1" crossOrigin="anonymous" /><div><p className="mb-2 text-sm font-semibold text-emerald-100 print:text-[#0d5c43]">مؤسسة القادري الزراعية</p><h2 className="text-3xl font-black">طلب شراء</h2></div></div><div className="text-left"><p className="text-xs text-emerald-100 print:text-slate-500">رقم طلب الشراء</p><p className="mt-1 text-2xl font-black tracking-wider">{order.number}</p></div></div></div>

      <Section title="بيانات الطلب"><div className="grid gap-4 md:grid-cols-3"><TextField label="تاريخ الطلب" type="date" value={order.orderDate} onChange={v => set("orderDate", v)} /><TextField label="تاريخ التوريد المطلوب" type="date" value={order.deliveryDate} onChange={v => set("deliveryDate", v)} /><TextField label="العملة" value={order.currency} onChange={v => set("currency", v)} placeholder="مثال: دينار أردني" /></div></Section>

      <div className="grid gap-5 lg:grid-cols-2"><Section title="المشتري"><div className="space-y-2 text-sm leading-7"><p className="text-lg font-extrabold text-[#0d5c43]">مؤسسة القادري الزراعية</p><p><b>اسم المسؤول:</b> م. ثامر أحمد عبد الرحمن القادري</p><p><b>الوظيفة:</b> المدير العام</p><p><b>الهاتف:</b> 0795415159</p><p><b>البريد الإلكتروني:</b> tamerqadri@gmail.com</p><p><b>العنوان:</b> جرش – الأردن</p></div></Section><Section title="المورد"><div className="grid gap-4 sm:grid-cols-2"><TextField label="اسم المورد" value={order.supplier.name} onChange={v => setSupplier("name", v)} /><TextField label="اسم الشخص المسؤول" value={order.supplier.contact} onChange={v => setSupplier("contact", v)} /><TextField label="رقم الهاتف" value={order.supplier.phone} onChange={v => setSupplier("phone", v)} /><TextField label="البريد الإلكتروني" value={order.supplier.email} onChange={v => setSupplier("email", v)} /><div className="sm:col-span-2"><TextField label="العنوان" value={order.supplier.address} onChange={v => setSupplier("address", v)} /></div></div></Section></div>

      <Section title="الأصناف والخدمات"><div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-slate-500">أضف الأصناف والكميات واترك سعر الوحدة فارغاً ليتم تعبئته من الجهة الموردة.</p><Button variant="outline" onClick={() => setOrder(prev => ({ ...prev, items: [...prev.items, blankItem()] }))} className="no-print rounded-xl border-[#0d5c43] text-[#0d5c43]"><Plus className="ms-2 h-4 w-4" /> إضافة صنف</Button></div><div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[980px] text-right text-sm"><thead className="bg-[#edf5f1] text-[#0d5c43]"><tr><th className="w-10 p-3">م</th><th className="p-3">وصف الصنف / الخدمة</th><th className="w-28 p-3">الوحدة</th><th className="w-24 p-3">الكمية</th><th className="w-32 p-3">سعر الوحدة</th><th className="w-32 p-3">الإجمالي</th><th className="w-28 p-3">المنشأ</th><th className="w-36 p-3">ملاحظات</th><th className="no-print w-12 p-3" /></tr></thead><tbody>{order.items.length === 0 ? <tr><td colSpan={9} className="p-10 text-center text-slate-400">لا توجد أصناف — اضغط «إضافة صنف» للبدء</td></tr> : order.items.map((item, index) => <tr key={item.id} className="border-t border-slate-100"><td className="p-2 text-center font-bold">{index + 1}</td>{(["description", "unit", "quantity", "unitPrice", "origin", "notes"] as const).map(key => <td key={key} className="p-2"><input aria-label={key} value={item[key]} onChange={e => setItem(item.id, key, e.target.value)} type={key === "quantity" || key === "unitPrice" ? "number" : "text"} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 outline-none focus:border-[#0d5c43]" /></td>)}<td className="p-2 text-center font-bold text-[#0d5c43]">{fmt(money(item.quantity) * money(item.unitPrice))}</td><td className="no-print p-2 text-center"><button onClick={() => setOrder(prev => ({ ...prev, items: prev.items.filter(row => row.id !== item.id) }))} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label="حذف"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div><div className="mt-5 flex justify-end"><div className="w-full max-w-sm space-y-2 text-sm"><div className="flex justify-between"><span>المجموع الفرعي</span><b>{fmt(subtotal)}</b></div><div className="flex items-center justify-between gap-3"><span>الضريبة</span><input value={order.tax} onChange={e => set("tax", e.target.value)} type="number" className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-left" placeholder="0.00" /></div><div className="flex items-center justify-between gap-3"><span>رسوم التوصيل</span><input value={order.deliveryFees} onChange={e => set("deliveryFees", e.target.value)} type="number" className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-left" placeholder="0.00" /></div><div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-black text-[#0d5c43]"><span>الإجمالي النهائي</span><span>{fmt(total)}</span></div></div></div></Section>

      <Section title="ملاحظات"><textarea value={order.notes} onChange={e => set("notes", e.target.value)} rows={6} className="w-full resize-y rounded-xl border border-slate-200 p-3 outline-none focus:border-[#0d5c43]" /></Section>
      <Section title="شروط الدفع"><div className="grid gap-4 md:grid-cols-2"><TextField label="طريقة الدفع" value={order.paymentMethod} onChange={v => set("paymentMethod", v)} /><TextField label="شروط الدفع" value={order.paymentTerms} onChange={v => set("paymentTerms", v)} /></div></Section>
      <Section title="اعتماد طلب الشراء"><div className="grid gap-6 md:grid-cols-2"><div className="space-y-2 text-sm leading-7"><p><b>الاسم:</b> م. ثامر أحمد عبد الرحمن القادري</p><p><b>الوظيفة:</b> المدير العام</p><p><b>التاريخ:</b> {order.orderDate || ""}</p></div><div className="grid grid-cols-2 gap-4"><div className="relative min-h-28 rounded-xl border-2 border-dashed border-slate-300 p-3 text-sm text-slate-400">التوقيع<img src="/signature-thamer.png" alt="توقيع المسؤول" className="absolute bottom-1 left-1/2 h-20 w-32 -translate-x-1/2 object-contain" crossOrigin="anonymous" /></div><div className="relative min-h-28 rounded-xl border-2 border-dashed border-slate-300 p-3 text-sm text-slate-400">الختم<img src="/stamp-qadri.png" alt="ختم المؤسسة" className="absolute bottom-1 left-1/2 h-20 w-24 -translate-x-1/2 object-contain" crossOrigin="anonymous" /></div></div></div></Section>
    </main>

    {showList && <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><h2 className="text-xl font-black text-[#0d5c43]">طلبات الشراء المحفوظة</h2><button onClick={() => setShowList(false)}><X /></button></div><div className="max-h-[65vh] overflow-auto p-5">{orders.length === 0 ? <p className="py-12 text-center text-slate-400">لا توجد طلبات محفوظة بعد.</p> : <div className="space-y-3">{[...orders].reverse().map(saved => <div key={saved.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><b className="text-[#0d5c43]">{saved.number}</b><span className="mx-3 text-slate-400">|</span><span>{saved.orderDate || "بدون تاريخ"}</span><p className="mt-1 text-sm text-slate-500">{saved.supplier.name || "مورد غير محدد"} · الإجمالي {fmt(orderTotal(saved))}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => loadSaved(saved)}><Pencil className="ms-1 h-4 w-4" /> تعديل</Button><Button size="sm" variant="outline" onClick={() => { loadSaved(saved); setTimeout(downloadPdf, 150); }}><Download className="ms-1 h-4 w-4" /> تنزيل PDF</Button><Button size="sm" variant="ghost" onClick={() => removeSaved(saved.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}</div></div></div>}
  </div>;
}
