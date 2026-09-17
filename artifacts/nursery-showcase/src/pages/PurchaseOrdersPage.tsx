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
  buyer: { institution: string; name: string; position: string; phone: string; email: string; address: string };
  supplier: { name: string; contact: string; phone: string; email: string; address: string };
  supplierApproval: { name: string; position: string; date: string };
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
const blankSupplierApproval = () => ({ name: "", position: "", date: "" });
const defaultBuyer = () => ({ institution: "مؤسسة القادري الزراعية", name: "م. ثامر أحمد عبد الرحمن القادري", position: "المدير العام", phone: "0777772211", email: "tamerqadri@gmail.com", address: "جرش – الأردن" });
const blankItem = (): PurchaseItem => ({ id: id(), description: "", unit: "", quantity: "", unitPrice: "", origin: "", notes: "" });

function nextNumber() {
  const last = Number(localStorage.getItem(LAST_NUMBER_KEY) || "0") + 1;
  localStorage.setItem(LAST_NUMBER_KEY, String(last));
  return `PO ${String(last).padStart(6, "0")}`;
}

function newOrder(): PurchaseOrder {
  return {
    id: id(), number: nextNumber(), orderDate: today(), deliveryDate: "", currency: "",
    buyer: defaultBuyer(), supplier: blankSupplier(), supplierApproval: blankSupplierApproval(), items: [], tax: "", deliveryFees: "", notes: "", paymentMethod: "", paymentTerms: "", createdAt: new Date().toISOString(),
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

async function imageAsDataUrl(src: string) {
  const response = await fetch(src, { cache: "force-cache" });
  if (!response.ok) throw new Error(`تعذر تحميل الصورة: ${src}`);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("تعذر قراءة الصورة"));
    reader.readAsDataURL(blob);
  });
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
    try { const draft = localStorage.getItem(DRAFT_KEY); if (draft) { const parsed = JSON.parse(draft); return { ...newOrder(), ...parsed, buyer: { ...defaultBuyer(), ...(parsed.buyer || {}), phone: "0777772211" }, supplier: { ...blankSupplier(), ...(parsed.supplier || {}) }, supplierApproval: { ...blankSupplierApproval(), ...(parsed.supplierApproval || {}) } }; } } catch { /* use new */ }
    return newOrder();
  });
  const [orders, setOrders] = useState<PurchaseOrder[]>(() => readOrders());
  const [showList, setShowList] = useState(false);

  useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify(order)); }, [order]);

  const subtotal = useMemo(() => order.items.reduce((sum, item) => sum + money(item.quantity) * money(item.unitPrice), 0), [order.items]);
  const total = subtotal + money(order.tax) + money(order.deliveryFees);
  const set = <K extends keyof PurchaseOrder>(key: K, value: PurchaseOrder[K]) => setOrder(prev => ({ ...prev, [key]: value }));
  const setBuyer = (key: keyof PurchaseOrder["buyer"], value: string) => setOrder(prev => ({ ...prev, buyer: { ...prev.buyer, [key]: value } }));
  const setSupplier = (key: keyof PurchaseOrder["supplier"], value: string) => setOrder(prev => ({ ...prev, supplier: { ...prev.supplier, [key]: value } }));
  const setSupplierApproval = (key: keyof PurchaseOrder["supplierApproval"], value: string) => setOrder(prev => ({ ...prev, supplierApproval: { ...prev.supplierApproval, [key]: value } }));
  const setItem = (itemId: string, key: keyof PurchaseItem, value: string) => setOrder(prev => ({ ...prev, items: prev.items.map(item => item.id === itemId ? { ...item, [key]: value } : item) }));

  function createNew() { setOrder(prev => { const blank = newOrder(); return { ...blank, buyer: { ...prev.buyer } }; }); window.scrollTo({ top: 0, behavior: "smooth" }); toast.success("تم إنشاء طلب شراء جديد برقم جديد"); }
  function save() {
    const next = [...orders.filter(item => item.id !== order.id), order];
    setOrders(next); localStorage.setItem(ORDERS_KEY, JSON.stringify(next)); toast.success(`تم حفظ ${order.number}`);
  }
  function removeSaved(orderId: string) { const next = orders.filter(item => item.id !== orderId); setOrders(next); localStorage.setItem(ORDERS_KEY, JSON.stringify(next)); if (orderId === order.id) createNew(); toast.success("تم حذف الطلب"); }
  function loadSaved(saved: PurchaseOrder) { setOrder({ ...saved, buyer: { ...defaultBuyer(), ...(saved.buyer || {}), phone: "0777772211" }, supplier: { ...blankSupplier(), ...(saved.supplier || {}) }, supplierApproval: { ...blankSupplierApproval(), ...(saved.supplierApproval || {}) } }); setShowList(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function downloadPdf() {
    if (!paperRef.current) return;
    let exportElement: HTMLElement | null = null;
    try {
      const sourceElement = paperRef.current;
      exportElement = sourceElement.cloneNode(true) as HTMLElement;
      exportElement.classList.add("pdf-export");
      exportElement.style.position = "absolute";
      exportElement.style.left = "0";
      exportElement.style.top = "0";
      exportElement.style.width = "1152px";
      exportElement.style.maxWidth = "1152px";
      exportElement.style.background = "#ffffff";
      exportElement.style.opacity = "1";
      exportElement.style.pointerEvents = "none";
      exportElement.style.zIndex = "-1";
      document.body.appendChild(exportElement);
      const sourceFields = Array.from(sourceElement.querySelectorAll("input, textarea, select"));
      const exportFields = Array.from(exportElement.querySelectorAll("input, textarea, select"));
      sourceFields.forEach((field, index) => {
        const copy = exportFields[index] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined;
        if (!copy) return;
        if (field instanceof HTMLInputElement && copy instanceof HTMLInputElement) {
          copy.value = field.value;
          copy.checked = field.checked;
        } else if (field instanceof HTMLTextAreaElement && copy instanceof HTMLTextAreaElement) {
          copy.value = field.value;
          copy.textContent = field.value;
        } else if (field instanceof HTMLSelectElement && copy instanceof HTMLSelectElement) {
          copy.value = field.value;
        }
      });
      const images = Array.from(exportElement.querySelectorAll("img"));
      await Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise<void>(resolve => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      })));
      const imageData = await Promise.all(images.map(async image => {
        try { return [image, await imageAsDataUrl(image.getAttribute("src") || "")] as const; } catch { return [image, "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" ] as const; }
      }));
      imageData.forEach(([image, dataUrl]) => { image.removeAttribute("crossorigin"); image.src = dataUrl; });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const exportWidth = Math.max(exportElement.scrollWidth, exportElement.offsetWidth, 1);
      const exportHeight = Math.max(exportElement.scrollHeight, exportElement.offsetHeight, 1);
      const render = (scale: number) => html2canvas(exportElement!, { width: exportWidth, height: exportHeight, windowWidth: exportWidth, windowHeight: exportHeight, scrollX: 0, scrollY: 0, scale, useCORS: false, allowTaint: false, backgroundColor: "#ffffff", logging: false, imageTimeout: 0 });
      let canvas: HTMLCanvasElement;
      try {
        canvas = await render(0.7);
      } catch {
        // If an image prevents the first capture, retry without images while
        // keeping the complete editable page and its layout.
        images.forEach(image => { image.style.display = "none"; });
        await new Promise(resolve => requestAnimationFrame(resolve));
        canvas = await render(0.5);
      }
      if (!canvas.width || !canvas.height) throw new Error("PDF canvas has no dimensions");

      // The content itself determines the page direction. A short order uses
      // portrait A4; a taller order uses landscape A4 as requested. The
      // rendered page is still one complete image, so the PDF cannot split or
      // omit fields from the form.
      const portraitContentRatio = (297 - 12) / (210 - 12);
      const isLandscape = canvas.height / canvas.width > portraitContentRatio;
      const orientation = isLandscape ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "mm", format: "a4", compress: true });
      const pageWidth = isLandscape ? 297 : 210;
      const pageHeight = isLandscape ? 210 : 297;
      const margin = 6;
      const ratio = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
      const width = canvas.width * ratio;
      const height = canvas.height * ratio;
      const image = canvas.toDataURL("image/png");
      pdf.addImage(image, "PNG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height);
      pdf.save(`طلب_شراء_${order.number.replace(/\s+/g, "_")}_${isLandscape ? "عرضي" : "طولي"}.pdf`);
      toast.success("تم تنزيل ملف PDF بنجاح");
    } catch (error) {
      console.error("Purchase order PDF error", error);
      try {
        const fallback = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        fallback.setFontSize(16);
        fallback.text("Purchase Order", 14, 18);
        fallback.setFontSize(11);
        fallback.text(`PO: ${order.number}`, 14, 28);
        fallback.text(`Date: ${order.orderDate || ""}`, 14, 36);
        fallback.text(`Supplier: ${order.supplier.name || ""}`, 14, 44);
        fallback.text("Items:", 14, 56);
        order.items.slice(0, 18).forEach((item, index) => {
          fallback.text(`${index + 1}. ${item.description || ""} | ${item.unit || ""} | Qty: ${item.quantity || ""} | Price: ${item.unitPrice || ""}`, 14, 64 + index * 7);
        });
        fallback.save(`طلب_شراء_${order.number.replace(/\s+/g, "_")}_طولي.pdf`);
        toast.success("تم تنزيل PDF بالنسخة الاحتياطية");
      } catch {
        toast.error("تعذر تنزيل PDF. حاول مرة أخرى أو حدّث الصفحة.");
      }
    } finally {
      exportElement?.remove();
    }
  }

  return <div dir="rtl" className="min-h-screen bg-[#f4f7f5] text-slate-800 print:bg-white">
    <style>{`.pdf-brand-image { object-fit: contain; } .pdf-export .no-print { display:none !important; } @media print { @page { size: A4; margin: 7mm; } .no-print { display:none!important } .po-page { padding:0!important; max-width:none!important } input,textarea { border:0!important; box-shadow:none!important; } }`}</style>
    <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
      <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="العودة"><ArrowRight className="h-5 w-5" /></Button><div><p className="text-xs font-semibold text-[#0d5c43]">مؤسسة القادري الزراعية</p><h1 className="text-xl font-black text-slate-900">طلبات الشراء</h1></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setShowList(true)} className="rounded-xl"><Eye className="ms-2 h-4 w-4" /> الطلبات المحفوظة</Button><Button variant="outline" onClick={createNew} className="rounded-xl"><FilePlus2 className="ms-2 h-4 w-4" /> طلب شراء جديد</Button><Button onClick={save} className="rounded-xl bg-[#0d5c43] hover:bg-[#084834]"><Save className="ms-2 h-4 w-4" /> حفظ الطلب</Button><Button onClick={downloadPdf} className="rounded-xl bg-slate-800 hover:bg-slate-700"><Download className="ms-2 h-4 w-4" /> تنزيل PDF</Button></div>
    </div></header>

    <main ref={paperRef} className="po-page mx-auto max-w-6xl space-y-5 bg-white px-4 py-7">
      <div className="rounded-2xl bg-[#0d5c43] p-6 text-white shadow-lg print:rounded-none print:bg-white print:p-0 print:text-slate-900 print:shadow-none"><div className="flex flex-wrap items-center justify-between gap-5"><div className="flex items-center gap-4"><img src="/logo-purchase-order.png" alt="شعار مؤسسة القادري الزراعية" className="pdf-brand-image h-24 w-20 rounded-lg bg-white object-contain p-1" crossOrigin="anonymous" /><div><p className="mb-2 text-sm font-semibold text-emerald-100 print:text-[#0d5c43]">{order.buyer.institution}</p><h2 className="text-3xl font-black">طلب شراء</h2></div></div><div className="text-left"><p className="text-xs text-emerald-100 print:text-slate-500">رقم طلب الشراء</p><input aria-label="رقم طلب الشراء" value={order.number} onChange={e => set("number", e.target.value)} className="mt-1 w-40 bg-transparent text-left text-2xl font-black tracking-wider text-white outline-none print:text-slate-900" /></div></div></div>

      <Section title="بيانات الطلب"><div className="grid gap-4 md:grid-cols-3"><TextField label="تاريخ الطلب" type="date" value={order.orderDate} onChange={v => set("orderDate", v)} /><TextField label="تاريخ التوريد المطلوب" type="date" value={order.deliveryDate} onChange={v => set("deliveryDate", v)} /><TextField label="العملة" value={order.currency} onChange={v => set("currency", v)} placeholder="مثال: دينار أردني" /></div></Section>

      <div className="grid gap-5 lg:grid-cols-2"><Section title="المشتري"><div className="grid gap-4 sm:grid-cols-2"><TextField label="اسم المؤسسة" value={order.buyer.institution} onChange={v => setBuyer("institution", v)} /><TextField label="اسم المسؤول" value={order.buyer.name} onChange={v => setBuyer("name", v)} /><TextField label="الوظيفة" value={order.buyer.position} onChange={v => setBuyer("position", v)} /><TextField label="الهاتف" value={order.buyer.phone} onChange={v => setBuyer("phone", v)} /><TextField label="البريد الإلكتروني" value={order.buyer.email} onChange={v => setBuyer("email", v)} /><TextField label="العنوان" value={order.buyer.address} onChange={v => setBuyer("address", v)} /></div></Section><Section title="المورد"><div className="grid gap-4 sm:grid-cols-2"><TextField label="اسم المورد" value={order.supplier.name} onChange={v => setSupplier("name", v)} /><TextField label="اسم الشخص المسؤول" value={order.supplier.contact} onChange={v => setSupplier("contact", v)} /><TextField label="رقم الهاتف" value={order.supplier.phone} onChange={v => setSupplier("phone", v)} /><TextField label="البريد الإلكتروني" value={order.supplier.email} onChange={v => setSupplier("email", v)} /><div className="sm:col-span-2"><TextField label="العنوان" value={order.supplier.address} onChange={v => setSupplier("address", v)} /></div></div></Section></div>

      <Section title="الأصناف والخدمات"><div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-slate-500">أضف الأصناف والكميات واترك سعر الوحدة فارغاً ليتم تعبئته من الجهة الموردة.</p><Button variant="outline" onClick={() => setOrder(prev => ({ ...prev, items: [...prev.items, blankItem()] }))} className="no-print rounded-xl border-[#0d5c43] text-[#0d5c43]"><Plus className="ms-2 h-4 w-4" /> إضافة صنف</Button></div><div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[980px] text-right text-sm"><thead className="bg-[#edf5f1] text-[#0d5c43]"><tr><th className="w-10 p-3">م</th><th className="p-3">وصف الصنف / الخدمة</th><th className="w-28 p-3">الوحدة</th><th className="w-24 p-3">الكمية</th><th className="w-32 p-3">سعر الوحدة</th><th className="w-32 p-3">الإجمالي</th><th className="w-28 p-3">المنشأ</th><th className="w-36 p-3">ملاحظات</th><th className="no-print w-12 p-3" /></tr></thead><tbody>{order.items.length === 0 ? <tr><td colSpan={9} className="p-10 text-center text-slate-400">لا توجد أصناف — اضغط «إضافة صنف» للبدء</td></tr> : order.items.map((item, index) => <tr key={item.id} className="border-t border-slate-100"><td className="p-2 text-center font-bold">{index + 1}</td>{(["description", "unit", "quantity", "unitPrice", "origin", "notes"] as const).map(key => <td key={key} className="p-2"><input aria-label={key} value={item[key]} onChange={e => setItem(item.id, key, e.target.value)} type={key === "quantity" || key === "unitPrice" ? "number" : "text"} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 outline-none focus:border-[#0d5c43]" /></td>)}<td className="p-2 text-center font-bold text-[#0d5c43]">{fmt(money(item.quantity) * money(item.unitPrice))}</td><td className="no-print p-2 text-center"><button onClick={() => setOrder(prev => ({ ...prev, items: prev.items.filter(row => row.id !== item.id) }))} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label="حذف"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div><div className="mt-5 flex justify-end"><div className="w-full max-w-sm space-y-2 text-sm"><div className="flex justify-between"><span>المجموع الفرعي</span><b>{fmt(subtotal)}</b></div><div className="flex items-center justify-between gap-3"><span>الضريبة</span><input value={order.tax} onChange={e => set("tax", e.target.value)} type="number" className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-left" placeholder="0.00" /></div><div className="flex items-center justify-between gap-3"><span>رسوم التوصيل</span><input value={order.deliveryFees} onChange={e => set("deliveryFees", e.target.value)} type="number" className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-left" placeholder="0.00" /></div><div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-black text-[#0d5c43]"><span>الإجمالي النهائي</span><span>{fmt(total)}</span></div></div></div></Section>

      <Section title="ملاحظات"><textarea value={order.notes} onChange={e => set("notes", e.target.value)} rows={6} className="w-full resize-y rounded-xl border border-slate-200 p-3 outline-none focus:border-[#0d5c43]" /></Section>
      <Section title="شروط الدفع"><div className="grid gap-4 md:grid-cols-2"><TextField label="طريقة الدفع" value={order.paymentMethod} onChange={v => set("paymentMethod", v)} /><TextField label="شروط الدفع" value={order.paymentTerms} onChange={v => set("paymentTerms", v)} /></div></Section>
      <Section title="اعتماد المشتري"><div className="grid gap-6 md:grid-cols-2"><div className="space-y-2 text-sm leading-7"><p><b>الاسم:</b> {order.buyer.name}</p><p><b>الوظيفة:</b> {order.buyer.position}</p><p><b>التاريخ:</b> {order.orderDate || ""}</p></div><div className="grid grid-cols-2 gap-4"><div className="relative min-h-28 rounded-xl border-2 border-dashed border-slate-300 p-3 text-sm text-slate-400">التوقيع<img src="/signature-thamer.png" alt="توقيع المسؤول" className="absolute bottom-1 left-1/2 h-20 w-32 -translate-x-1/2 object-contain" crossOrigin="anonymous" /></div><div className="relative min-h-28 rounded-xl border-2 border-dashed border-slate-300 p-3 text-sm text-slate-400">الختم<img src="/stamp-qadri.png" alt="ختم المؤسسة" className="absolute bottom-0 left-1/2 h-32 w-36 -translate-x-1/2 object-contain" crossOrigin="anonymous" /></div></div></div></Section>
      <Section title="اعتماد المورد"><div className="grid gap-4 md:grid-cols-3"><TextField label="الاسم" value={order.supplierApproval.name} onChange={v => setSupplierApproval("name", v)} /><TextField label="الوظيفة" value={order.supplierApproval.position} onChange={v => setSupplierApproval("position", v)} /><TextField label="التاريخ" type="date" value={order.supplierApproval.date} onChange={v => setSupplierApproval("date", v)} /></div><div className="mt-4 grid grid-cols-2 gap-4"><div className="min-h-24 rounded-xl border-2 border-dashed border-slate-300 p-3 text-sm text-slate-400">التوقيع</div><div className="min-h-24 rounded-xl border-2 border-dashed border-slate-300 p-3 text-sm text-slate-400">الختم</div></div></Section>
    </main>

    {showList && <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><h2 className="text-xl font-black text-[#0d5c43]">طلبات الشراء المحفوظة</h2><button onClick={() => setShowList(false)}><X /></button></div><div className="max-h-[65vh] overflow-auto p-5">{orders.length === 0 ? <p className="py-12 text-center text-slate-400">لا توجد طلبات محفوظة بعد.</p> : <div className="space-y-3">{[...orders].reverse().map(saved => <div key={saved.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><b className="text-[#0d5c43]">{saved.number}</b><span className="mx-3 text-slate-400">|</span><span>{saved.orderDate || "بدون تاريخ"}</span><p className="mt-1 text-sm text-slate-500">{saved.supplier.name || "مورد غير محدد"} · الإجمالي {fmt(orderTotal(saved))}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => loadSaved(saved)}><Pencil className="ms-1 h-4 w-4" /> تعديل</Button><Button size="sm" variant="outline" onClick={() => { loadSaved(saved); setTimeout(downloadPdf, 150); }}><Download className="ms-1 h-4 w-4" /> تنزيل PDF</Button><Button size="sm" variant="ghost" onClick={() => removeSaved(saved.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}</div></div></div>}
  </div>;
}
