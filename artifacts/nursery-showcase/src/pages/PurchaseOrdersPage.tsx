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
  buyerApprovalDate: string;
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
    buyer: defaultBuyer(), supplier: blankSupplier(), supplierApproval: blankSupplierApproval(), buyerApprovalDate: today(), items: [], tax: "", deliveryFees: "", notes: "", paymentMethod: "", paymentTerms: "", createdAt: new Date().toISOString(),
  };
}

function readOrders(): PurchaseOrder[] {
  try { const value = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
}
function money(value: string) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function fmt(value: number) { return value === 0 ? "" : value.toLocaleString("ar-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
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

function replacePdfFieldsWithText(root: HTMLElement) {
  const fields = Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"));
  fields.forEach(field => {
    const replacement = document.createElement("div");
    replacement.className = field.className;
    replacement.textContent = field.value || field.getAttribute("placeholder") || "";
    replacement.style.minHeight = `${Math.max(field.getBoundingClientRect().height, 24)}px`;
    replacement.style.whiteSpace = field instanceof HTMLTextAreaElement ? "pre-wrap" : "nowrap";
    replacement.style.overflow = "hidden";
    replacement.style.display = field instanceof HTMLTextAreaElement ? "block" : "flex";
    if (!(field instanceof HTMLTextAreaElement)) replacement.style.alignItems = "center";
    field.replaceWith(replacement);
  });
}

function sanitizePdfColors(root: HTMLElement) {
  const colorProperties = [
    "color",
    "background-color",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
    "outline-color",
    "text-decoration-color",
    "column-rule-color",
    "box-shadow",
    "text-shadow",
    "fill",
    "stroke",
  ];
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];

  elements.forEach(element => {
    const computed = window.getComputedStyle(element);
    colorProperties.forEach(property => {
      const value = computed.getPropertyValue(property);
      if (!/(oklch|oklab|color-mix|lab\(|lch\()/i.test(value)) return;
      const fallback = property === "box-shadow" || property === "text-shadow"
        ? "none"
        : property === "background-color"
          ? "#ffffff"
          : property.includes("border") || property === "outline-color" || property === "column-rule-color"
            ? "#e2e8f0"
            : "#1e293b";
      element.style.setProperty(property, fallback);
    });
  });
}

const fieldClass = "po-field h-11 rounded-xl border-slate-200 bg-white text-right focus-visible:ring-[#0d5c43]";
const labelClass = "mb-2 block text-sm font-bold text-slate-700";

function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <section data-pdf-section className={`po-section rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:rounded-none print:border-slate-300 print:shadow-none ${className}`}>
    <div className="po-section-title mb-5 flex items-center gap-3 border-b border-slate-100 pb-3"><span className="h-6 w-1 rounded-full bg-[#0d5c43]" /><h2 className="text-lg font-extrabold text-[#0d5c43]">{title}</h2></div>{children}
  </section>;
}

function TextField({ label, value, onChange, type = "text", placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return <label className="block"><span className={labelClass}>{label}</span><Input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} className={fieldClass} /></label>;
}

export default function PurchaseOrdersPage() {
  const paperRef = useRef<HTMLElement>(null);
  const [order, setOrder] = useState<PurchaseOrder>(() => {
    try { const draft = localStorage.getItem(DRAFT_KEY); if (draft) { const parsed = JSON.parse(draft); return { ...newOrder(), ...parsed, buyerApprovalDate: parsed.buyerApprovalDate || today(), buyer: { ...defaultBuyer(), ...(parsed.buyer || {}), phone: "0777772211" }, supplier: { ...blankSupplier(), ...(parsed.supplier || {}) }, supplierApproval: { ...blankSupplierApproval(), ...(parsed.supplierApproval || {}) } }; } } catch { /* use new */ }
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
  function loadSaved(saved: PurchaseOrder) { setOrder({ ...saved, buyerApprovalDate: saved.buyerApprovalDate || today(), buyer: { ...defaultBuyer(), ...(saved.buyer || {}), phone: "0777772211" }, supplier: { ...blankSupplier(), ...(saved.supplier || {}) }, supplierApproval: { ...blankSupplierApproval(), ...(saved.supplierApproval || {}) } }); setShowList(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function downloadPdf() {
    if (!paperRef.current) return;
    let exportElement: HTMLElement | null = null;
    try {
      const sourceElement = paperRef.current;
      exportElement = sourceElement.cloneNode(true) as HTMLElement;
      exportElement.classList.add("pdf-export");
      if (order.items.length > 8) exportElement.classList.add("pdf-multipage", "po-page-multipage");
      exportElement.style.position = "absolute";
      exportElement.style.left = "0";
      exportElement.style.top = "0";
      // Render at the width of an A4 page instead of the desktop viewport.
      // This keeps the form readable when it is split across PDF pages.
      exportElement.style.width = "794px";
      exportElement.style.maxWidth = "794px";
      exportElement.style.height = order.items.length > 8 ? "auto" : "1123px";
      exportElement.style.minHeight = "1123px";
      exportElement.style.boxSizing = "border-box";
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
      // html2canvas is more reliable with ordinary text than native form
      // controls. The cloned document is only used for the PDF, so replacing
      // controls here does not affect the editable form on the page.
      replacePdfFieldsWithText(exportElement);
      // Tailwind v4 emits some palette and shadow values as oklch/color-mix.
      // html2canvas cannot parse those functions, so normalize them only in
      // the off-screen export copy while preserving the live page styling.
      sanitizePdfColors(exportElement);
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
      const exportWidth = Math.max(exportElement.offsetWidth, 1);
      const exportHeight = Math.max(exportElement.scrollHeight, exportElement.offsetHeight, 1);
       const render = (scale: number) => html2canvas(exportElement!, {
        width: exportWidth,
        height: exportHeight,
        windowWidth: exportWidth,
        windowHeight: exportHeight,
        scrollX: 0,
        scrollY: 0,
        scale,
        useCORS: false,
        allowTaint: false,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 0,
      });
      let canvas: HTMLCanvasElement;
      try {
         canvas = await render(2);
      } catch {
        // If an image prevents the first capture, retry without images while
        // keeping the complete editable page and its layout.
        images.forEach(image => { image.style.display = "none"; });
        await new Promise(resolve => requestAnimationFrame(resolve));
         canvas = await render(1);
      }
      if (!canvas.width || !canvas.height) throw new Error("PDF canvas has no dimensions");

      // One-page orders stay on one A4 sheet. Long item lists are sliced into
      // consecutive A4 pages; notes and approvals remain after the table.
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
      const pagePixelHeight = Math.max(1, Math.round(canvas.width * 297 / 210));
      const pageCount = Math.max(1, Math.ceil(canvas.height / pagePixelHeight));
      for (let page = 0; page < pageCount; page += 1) {
        if (page > 0) pdf.addPage("a4", "portrait");
        const sliceHeight = Math.min(pagePixelHeight, canvas.height - page * pagePixelHeight);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceHeight;
        const context = slice.getContext("2d");
        if (!context) throw new Error("تعذر تجهيز صفحة PDF");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, slice.width, slice.height);
        context.drawImage(canvas, 0, page * pagePixelHeight, canvas.width, sliceHeight, 0, 0, slice.width, sliceHeight);
        pdf.addImage(slice.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, 210, (sliceHeight / canvas.width) * 210);
      }
      pdf.save(`طلب_شراء_${order.number.replace(/\s+/g, "_")}.pdf`);
      toast.success("تم تنزيل ملف PDF بنجاح");
    } catch (error) {
      console.error("Purchase order PDF error", error);
      toast.error("تعذر تجهيز ملف PDF. حاول مرة أخرى أو حدّث الصفحة.");
    } finally {
      exportElement?.remove();
    }
  }

  return <div dir="rtl" className="min-h-screen bg-[#f4f7f5] text-slate-800 print:bg-white">
    <style>{`
      .pdf-brand-image { object-fit: contain; }
      .pdf-export .no-print { display:none !important; }
      .po-preview { display:flex; justify-content:center; padding:24px 16px 40px; min-height:calc(100vh - 78px); overflow:auto; }
      .po-page { box-sizing:border-box; display:flex; flex:0 0 794px; flex-direction:column; gap:8px; width:794px; height:1123px; min-height:1123px; max-height:1123px; overflow:hidden; padding:18px; background:#fff; box-shadow:0 8px 32px rgba(15,23,42,.12); }
      .po-page-multipage { height:auto !important; max-height:none !important; overflow:visible !important; }
      .pdf-multipage .po-page { height:auto !important; max-height:none !important; min-height:1123px !important; overflow:visible !important; }
      .po-document-header { flex:0 0 78px; padding:12px 18px !important; border-radius:12px !important; }
      .po-header-row { display:grid !important; grid-template-columns:minmax(0,1fr) 220px; align-items:center; gap:18px; width:100%; height:100%; }
      .po-header-brand { display:flex; align-items:center; gap:14px; min-width:0; }
      .po-header-brand > div { min-width:0; }
      .po-header-brand p, .po-header-brand h2 { color:#ffffff !important; }
      .po-header-number { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; width:220px; min-width:0; padding:5px 8px; border-inline-start:1px solid rgba(255,255,255,.3); }
      .po-number-label { margin:0 !important; color:#d9f4e8; font-size:11px !important; font-weight:700; line-height:1.2; white-space:nowrap; }
      .po-document-header img { height:54px !important; width:48px !important; flex:none; }
      .po-document-header h2 { margin:0 !important; font-size:25px !important; line-height:1.3 !important; letter-spacing:normal !important; word-spacing:.12em; white-space:nowrap; }
      .po-document-header .po-number-field { box-sizing:border-box; width:190px !important; height:38px !important; margin:0 !important; padding:2px 10px !important; border:2px solid rgba(255,255,255,.76) !important; border-radius:8px !important; background:rgba(255,255,255,.12) !important; box-shadow:none !important; color:#fff !important; font-size:23px !important; line-height:1 !important; text-align:center !important; letter-spacing:.04em; }
       .po-page input, .po-page textarea {
         box-shadow:none !important;
         border-color:#cbd8d0 !important;
       }
       .po-page input:focus, .po-page textarea:focus {
         box-shadow:0 0 0 2px rgba(13,92,67,.14) !important;
       }
      .po-section { flex:none; padding:10px 14px !important; border-radius:10px !important; box-shadow:none !important; break-inside:avoid; page-break-inside:avoid; }
      .pdf-multipage .po-items-section { break-inside:auto !important; page-break-inside:auto !important; }
      .pdf-multipage .po-items-section tr { break-inside:avoid; page-break-inside:avoid; }
      .pdf-multipage .po-notes-payment, .pdf-multipage .po-approvals { break-inside:avoid; page-break-inside:avoid; }
      .po-section-title { margin-bottom:7px !important; padding-bottom:5px !important; gap:7px !important; }
      .po-section-title h2 { font-size:14px !important; }
      .po-section-title span { height:18px !important; width:3px !important; }
       .po-page label { display:flex; flex-direction:column; gap:8px; min-width:0; line-height:1.2; }
       .po-page label span { display:block; margin:0 !important; font-size:10.5px !important; line-height:1.35 !important; white-space:nowrap; overflow:visible; }
       .po-page .po-field, .po-page input, .po-page textarea { box-sizing:border-box; display:block; width:100%; font-size:11px !important; }
       .po-page .po-field { height:30px !important; margin:0 !important; border-radius:6px !important; }
      .po-page textarea { min-height:45px !important; height:45px !important; resize:none !important; }
      .po-request-section > div { gap:8px !important; }
      .po-parties { display:grid !important; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px !important; }
      .po-parties .grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 8px !important; }
      .po-parties .sm\\:col-span-2 { grid-column:span 2; }
      .po-parties .po-section { min-height:164px; }
      .po-items-section { min-height:250px; }
      .po-items-section > div:first-child { margin-bottom:6px !important; align-items:center; }
      .po-items-section > div:first-child p { font-size:9px !important; }
      .po-items-section > div:first-child button { height:27px; padding:0 9px; font-size:10px; }
      .po-items-section table { min-width:0 !important; table-layout:fixed; font-size:9px !important; }
      .po-items-section th, .po-items-section td { padding:4px !important; }
      .po-items-section th:nth-child(1) { width:25px; }
      .po-items-section th:nth-child(2) { width:23%; }
      .po-items-section th:nth-child(3) { width:9%; }
      .po-items-section th:nth-child(4) { width:8%; }
      .po-items-section th:nth-child(5), .po-items-section th:nth-child(6) { width:11%; }
      .po-items-section th:nth-child(7) { width:9%; }
      .po-items-section th:nth-child(8) { width:14%; }
      .po-items-section th:nth-child(9) { width:26px; }
       .po-items-section input { width:100%; min-width:0; height:24px; padding:2px 4px; font-size:9px !important; }
      .po-items-section tbody td { height:29px; }
      .po-items-section tbody td[colspan] { padding:8px !important; }
      .po-items-section > .mt-5 { margin-top:7px !important; }
      .po-items-section > .mt-5 > div { max-width:260px; gap:2px !important; font-size:9px !important; }
      .po-items-section > .mt-5 input { height:21px; }
      .po-items-section > .mt-5 .text-lg { font-size:13px !important; padding-top:4px !important; }
      .po-notes-payment { display:grid; grid-template-columns:1.35fr 1fr; gap:8px; }
      .po-notes-payment .po-section { min-height:77px; }
      .po-payment-fields { display:grid !important; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px !important; }
      .po-approvals { display:flex; flex-direction:column; gap:6px; }
      .po-approval-row { padding:8px 12px !important; }
      .po-approval-row .po-section-title { display:flex; align-items:center; margin-bottom:6px !important; padding-bottom:4px !important; }
      .po-approval-row .po-section-title h2 { font-size:13px !important; }
      .po-approval-line { display:flex; align-items:center; gap:8px; min-height:52px; width:100%; white-space:nowrap; }
      .po-approval-item, .po-approval-sign, .po-approval-stamp { display:flex; align-items:center; gap:6px; min-width:0; height:44px; padding:0 9px; border:1px solid #d7e2dc; border-radius:6px; background:#fbfdfc; color:#334155; font-size:10px; }
      .po-approval-item { flex:1 1 0; }
      .po-approval-sign, .po-approval-stamp { flex:0 0 132px; justify-content:space-between; }
      .po-approval-item b, .po-approval-sign b, .po-approval-stamp b { color:#0d5c43; font-size:9px; }
      .po-approval-item input { min-width:0; width:100%; height:32px !important; padding:2px 5px !important; border:0 !important; background:transparent !important; font-size:10px !important; }
      .po-approval-sign img, .po-approval-stamp img { max-width:76px; max-height:36px; object-fit:contain; }
      .po-approval-blank { display:inline-block; width:78px; height:30px; border-bottom:1px dashed #94a3b8; }
      @media (max-width: 820px) {
        .po-preview { justify-content:flex-start; padding:12px; }
      }
      @media print {
        @page { size:A4 portrait; margin:0; }
        html, body { width:210mm; height:297mm; margin:0 !important; background:#fff !important; }
        .no-print { display:none!important; }
        .po-preview { display:block; padding:0 !important; min-height:0 !important; overflow:visible !important; }
        .po-page { width:210mm !important; height:297mm !important; min-height:297mm !important; padding:5mm !important; box-shadow:none !important; }
        .po-document-header { display:block !important; height:25mm !important; min-height:25mm !important; padding:3mm 4mm !important; background:#0d5c43 !important; color:#fff !important; overflow:hidden !important; }
        .po-header-row { display:grid !important; grid-template-columns:minmax(0,1fr) 58mm !important; align-items:center !important; gap:4mm !important; height:19mm !important; }
        .po-header-brand { display:flex !important; align-items:center !important; gap:3mm !important; min-width:0 !important; }
        .po-header-brand > div { min-width:0 !important; }
        .po-header-brand p { margin:0 0 1mm !important; color:#fff !important; font-size:10pt !important; line-height:1.2 !important; white-space:nowrap !important; }
        .po-header-brand h2 { margin:0 !important; color:#fff !important; font-size:17pt !important; line-height:1.25 !important; letter-spacing:normal !important; word-spacing:.12em !important; white-space:nowrap !important; }
        .po-header-number { width:auto !important; height:18mm !important; padding:1mm 2mm !important; border-inline-start:1px solid rgba(255,255,255,.45) !important; }
        .po-number-label { color:#fff !important; font-size:8pt !important; margin:0 0 1mm !important; }
        .po-document-header .po-number-field { width:52mm !important; height:10mm !important; margin:0 !important; border-color:rgba(255,255,255,.8) !important; background:rgba(255,255,255,.12) !important; color:#fff !important; font-size:16pt !important; }
         input, textarea { box-shadow:none!important; }
      }
    `}</style>
    <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
      <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="العودة"><ArrowRight className="h-5 w-5" /></Button><div><p className="text-xs font-semibold text-[#0d5c43]">مؤسسة القادري الزراعية</p><h1 className="text-xl font-black text-slate-900">طلبات الشراء</h1></div></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setShowList(true)} className="rounded-xl"><Eye className="ms-2 h-4 w-4" /> الطلبات المحفوظة</Button><Button variant="outline" onClick={createNew} className="rounded-xl"><FilePlus2 className="ms-2 h-4 w-4" /> طلب شراء جديد</Button><Button onClick={save} className="rounded-xl bg-[#0d5c43] hover:bg-[#084834]"><Save className="ms-2 h-4 w-4" /> حفظ الطلب</Button><Button onClick={downloadPdf} className="rounded-xl bg-slate-800 hover:bg-slate-700"><Download className="ms-2 h-4 w-4" /> تنزيل PDF</Button></div>
    </div></header>

    <div className="po-preview">
    <main ref={paperRef} className="po-page">
       <div className="po-document-header rounded-2xl bg-[#0d5c43] p-6 text-white shadow-lg print:rounded-none print:bg-white print:p-0 print:text-slate-900 print:shadow-none"><div className="po-header-row"><div className="po-header-brand"><img src="/logo-purchase-order.png" alt="شعار مؤسسة القادري الزراعية" className="pdf-brand-image h-24 w-20 rounded-lg bg-white object-contain p-1" crossOrigin="anonymous" /><div><p className="mb-2 text-sm font-semibold text-emerald-100 print:text-[#0d5c43]">{order.buyer.institution}</p><h2 className="text-3xl font-black">طلب شراء</h2></div></div><div className="po-header-number"><p className="po-number-label">رقم طلب الشراء</p><input aria-label="رقم طلب الشراء" value={order.number} onChange={e => set("number", e.target.value)} className="po-number-field mt-1 w-40 bg-transparent text-left text-2xl font-black tracking-wider text-white outline-none print:text-slate-900" /></div></div></div>

      <Section title="بيانات الطلب" className="po-request-section"><div className="grid gap-4 md:grid-cols-3"><TextField label="تاريخ الطلب" type="date" value={order.orderDate} onChange={v => set("orderDate", v)} /><TextField label="تاريخ التوريد المطلوب" type="date" value={order.deliveryDate} onChange={v => set("deliveryDate", v)} /><TextField label="العملة" value={order.currency} onChange={v => set("currency", v)} placeholder="مثال: دينار أردني" /></div></Section>

      <div className="po-parties"><Section title="المشتري"><div className="grid gap-4 sm:grid-cols-2"><TextField label="اسم المؤسسة" value={order.buyer.institution} onChange={v => setBuyer("institution", v)} /><TextField label="اسم المسؤول" value={order.buyer.name} onChange={v => setBuyer("name", v)} /><TextField label="الوظيفة" value={order.buyer.position} onChange={v => setBuyer("position", v)} /><TextField label="الهاتف" value={order.buyer.phone} onChange={v => setBuyer("phone", v)} /><TextField label="البريد الإلكتروني" value={order.buyer.email} onChange={v => setBuyer("email", v)} /><TextField label="العنوان" value={order.buyer.address} onChange={v => setBuyer("address", v)} /></div></Section><Section title="المورد"><div className="grid gap-4 sm:grid-cols-2"><TextField label="اسم المورد" value={order.supplier.name} onChange={v => setSupplier("name", v)} /><TextField label="اسم الشخص المسؤول" value={order.supplier.contact} onChange={v => setSupplier("contact", v)} /><TextField label="رقم الهاتف" value={order.supplier.phone} onChange={v => setSupplier("phone", v)} /><TextField label="البريد الإلكتروني" value={order.supplier.email} onChange={v => setSupplier("email", v)} /><div className="sm:col-span-2"><TextField label="العنوان" value={order.supplier.address} onChange={v => setSupplier("address", v)} /></div></div></Section></div>

      <Section title="الأصناف والخدمات" className="po-items-section"><div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-slate-500"></p><Button variant="outline" onClick={() => setOrder(prev => ({ ...prev, items: [...prev.items, blankItem()] }))} className="no-print rounded-xl border-[#0d5c43] text-[#0d5c43]"><Plus className="ms-2 h-4 w-4" /> إضافة صنف</Button></div><div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[980px] text-right text-sm"><thead className="bg-[#edf5f1] text-[#0d5c43]"><tr><th className="w-10 p-3">م</th><th className="p-3">وصف الصنف / الخدمة</th><th className="w-28 p-3">الوحدة</th><th className="w-24 p-3">الكمية</th><th className="w-32 p-3">سعر الوحدة</th><th className="w-32 p-3">الإجمالي</th><th className="w-28 p-3">المنشأ</th><th className="w-36 p-3">ملاحظات</th><th className="no-print w-12 p-3" /></tr></thead><tbody>{order.items.length === 0 ? <tr><td colSpan={9} className="p-10 text-center text-slate-400">لا توجد أصناف — اضغط «إضافة صنف» للبدء</td></tr> : order.items.map((item, index) => <tr key={item.id} className="border-t border-slate-100"><td className="p-2 text-center font-bold">{index + 1}</td>{(["description", "unit", "quantity", "unitPrice", "origin", "notes"] as const).map(key => <td key={key} className="p-2"><input aria-label={key} value={item[key]} onChange={e => setItem(item.id, key, e.target.value)} type={key === "quantity" || key === "unitPrice" ? "number" : "text"} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 outline-none focus:border-[#0d5c43]" /></td>)}<td className="p-2 text-center font-bold text-[#0d5c43]">{fmt(money(item.quantity) * money(item.unitPrice))}</td><td className="no-print p-2 text-center"><button onClick={() => setOrder(prev => ({ ...prev, items: prev.items.filter(row => row.id !== item.id) }))} className="rounded-lg p-2 text-red-500 hover:bg-red-50" aria-label="حذف"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div><div className="mt-5 flex justify-end"><div className="w-full max-w-sm space-y-2 text-sm"><div className="flex justify-between"><span>المجموع الفرعي</span><b>{fmt(subtotal)}</b></div><div className="flex items-center justify-between gap-3"><span>الضريبة</span><input value={order.tax} onChange={e => set("tax", e.target.value)} type="number" className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-left" /></div><div className="flex items-center justify-between gap-3"><span>رسوم التوصيل</span><input value={order.deliveryFees} onChange={e => set("deliveryFees", e.target.value)} type="number" className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-left" /></div><div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-black text-[#0d5c43]"><span>الإجمالي النهائي</span><span>{fmt(total)}</span></div></div></div></Section>

      <div className="po-notes-payment">
        <Section title="ملاحظات"><textarea value={order.notes} onChange={e => set("notes", e.target.value)} rows={6} className="w-full resize-y rounded-xl border border-slate-200 p-3 outline-none focus:border-[#0d5c43]" /></Section>
      </div>
      <div className="po-approvals">
        <Section title="اعتماد المشتري" className="po-approval-row"><div className="po-approval-line"><span className="po-approval-item"><b>الاسم:</b> {order.buyer.name}</span><span className="po-approval-item"><b>الوظيفة:</b> {order.buyer.position}</span><span className="po-approval-item"><b>التاريخ:</b><input aria-label="تاريخ اعتماد المشتري" type="date" value={order.buyerApprovalDate} onChange={e => set("buyerApprovalDate", e.target.value)} /></span><span className="po-approval-sign"><b>التوقيع:</b><img src="/signature-thamer.png" alt="توقيع المسؤول" crossOrigin="anonymous" /></span><span className="po-approval-stamp"><b>الختم:</b><img src="/stamp-qadri.png" alt="ختم المؤسسة" crossOrigin="anonymous" /></span></div></Section>
        <Section title="اعتماد المورد" className="po-approval-row"><div className="po-approval-line"><span className="po-approval-item"><b>الاسم:</b><input aria-label="اسم المعتمد من المورد" value={order.supplierApproval.name} onChange={e => setSupplierApproval("name", e.target.value)} /></span><span className="po-approval-item"><b>الوظيفة:</b><input aria-label="وظيفة المعتمد من المورد" value={order.supplierApproval.position} onChange={e => setSupplierApproval("position", e.target.value)} /></span><span className="po-approval-item"><b>التاريخ:</b><input aria-label="تاريخ اعتماد المورد" type="date" value={order.supplierApproval.date} onChange={e => setSupplierApproval("date", e.target.value)} /></span><span className="po-approval-sign"><b>التوقيع:</b><span className="po-approval-blank" /></span><span className="po-approval-stamp"><b>الختم:</b><span className="po-approval-blank" /></span></div></Section>
      </div>
    </main>
    </div>

    {showList && <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"><div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><h2 className="text-xl font-black text-[#0d5c43]">طلبات الشراء المحفوظة</h2><button onClick={() => setShowList(false)}><X /></button></div><div className="max-h-[65vh] overflow-auto p-5">{orders.length === 0 ? <p className="py-12 text-center text-slate-400">لا توجد طلبات محفوظة بعد.</p> : <div className="space-y-3">{[...orders].reverse().map(saved => <div key={saved.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><b className="text-[#0d5c43]">{saved.number}</b><span className="mx-3 text-slate-400">|</span><span>{saved.orderDate || "بدون تاريخ"}</span><p className="mt-1 text-sm text-slate-500">{saved.supplier.name || "مورد غير محدد"} · الإجمالي {fmt(orderTotal(saved))}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => loadSaved(saved)}><Pencil className="ms-1 h-4 w-4" /> تعديل</Button><Button size="sm" variant="outline" onClick={() => { loadSaved(saved); setTimeout(downloadPdf, 150); }}><Download className="ms-1 h-4 w-4" /> تنزيل PDF</Button><Button size="sm" variant="ghost" onClick={() => removeSaved(saved.id)} className="text-red-600"><Trash2 className="h-4 w-4" /></Button></div></div>)}</div>}</div></div></div>}
  </div>;
}
