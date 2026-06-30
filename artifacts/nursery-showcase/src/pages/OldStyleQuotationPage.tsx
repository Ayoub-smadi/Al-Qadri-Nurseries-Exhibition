import { useState, useCallback, useRef, useEffect } from "react";
import { navigate } from "@/App";
import { useApp } from "@/lib/context";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus, Trash2, FileText, Save, ArrowRight, Loader2,
  Phone, Mail, Globe, RotateCcw, MessageCircle, ChevronDown,
} from "lucide-react";
import stampImage from "@assets/لقطة_شاشة_2026-03-08_023328_1773047188235.png";
import html2canvas from "html2canvas";
import { sliceCanvasToPdf } from "@/lib/pdfMultiPage";

/* ─── Types ────────────────────────────────────────────── */
type Item = {
  id: string;
  name: string;
  description: string;
  category: string;
  quantity: number;
  price: number;
  total: number;
  imageUrl?: string;
};

type Details = {
  quotationNumber: string;
  customerName: string;
  date: string;
  notes: string;
  phone: string;
  email: string;
  website: string;
  closingText: string;
  signerTitle: string;
  companyNameAr: string;
  companyLocationAr: string;
  companyNameEn: string;
  companyLocationEn: string;
  footerCompany: string;
};

const DRAFT_KEY = "aq_old_style_draft";

const mkDefault = (): Details => ({
  quotationNumber: format(new Date(), "yyyyMMdd"),
  customerName: "",
  date: format(new Date(), "yyyy-MM-dd"),
  notes: "",
  phone: "00962777772211",
  email: "tamerqadri@gmail.com",
  website: "https://alkadrionline.com",
  closingText: "واقبلوا فائق الاحترام....",
  signerTitle: "المدير العام/ ثامر احمد القادري",
  companyNameAr: "مؤسسة ومشاتل القادري الزراعية",
  companyLocationAr: "جرش – الرشايدة",
  companyNameEn: "Al-Qadri Agricultural Establishment",
  companyLocationEn: "Jerash - Al-Rashaidah",
  footerCompany: "مؤسسة ومشاتل القادري الزراعية",
});

const mkItem = (): Item => ({
  id: Date.now().toString() + Math.random(),
  name: "",
  description: "",
  category: "",
  quantity: 1,
  price: 0,
  total: 0,
});

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ─── Editable inline cell ─────────────────────────────── */
function Editable({
  value, onChange, className = "", placeholder = "", type = "text", align = "center",
}: {
  value: string; onChange: (v: string) => void;
  className?: string; placeholder?: string; type?: string; align?: "center" | "right" | "left";
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-transparent border-none outline-none focus:bg-blue-50/50 rounded px-1 w-full ${className}`}
      style={{ textAlign: align, direction: "rtl" }}
    />
  );
}

/* ─── Number inline cell ───────────────────────────────── */
function NumCell({ value, onChange, className = "" }: { value: number; onChange: (v: number) => void; className?: string }) {
  return (
    <input
      type="number"
      value={value === 0 ? "" : value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      placeholder="0"
      min={0}
      className={`bg-transparent border-none outline-none focus:bg-blue-50/50 rounded px-1 w-full text-center ${className}`}
    />
  );
}

/* ═══════════════════════════════════════════════════════ */
export default function OldStyleQuotationPage() {
  const { siteData } = useApp();
  const docRef = useRef<HTMLDivElement>(null);

  /* ─── State ────────────────────────────────────────── */
  const loadDraft = () => {
    try { const r = sessionStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  };
  const draft = loadDraft();

  const [details, setDetails] = useState<Details>(draft?.details ?? mkDefault());
  const [items, setItems] = useState<Item[]>(draft?.items ?? [mkItem()]);
  const [logoUrl, setLogoUrl] = useState<string>(draft?.logoUrl ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isPdf, setIsPdf] = useState(false);
  const [showPdfMenu, setShowPdfMenu] = useState(false);

  /* ─── Auto-save draft ──────────────────────────────── */
  const saveDraft = useCallback(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ details, items, logoUrl })); } catch {}
  }, [details, items, logoUrl]);
  useEffect(() => { saveDraft(); }, [saveDraft]);

  const clearDraft = () => {
    sessionStorage.removeItem(DRAFT_KEY);
    setDetails(mkDefault());
    setItems([mkItem()]);
    setLogoUrl("");
  };

  /* ─── Totals ───────────────────────────────────────── */
  const grandTotal = items.reduce((s, i) => s + (i.total || 0), 0);

  /* ─── Item helpers ─────────────────────────────────── */
  const updateItem = (id: string, field: keyof Item, val: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const u = { ...item, [field]: val };
      if (field === "quantity" || field === "price") u.total = Number(u.quantity) * Number(u.price);
      return u;
    }));
  };

  const addItem = () => setItems(prev => [...prev, mkItem()]);
  const removeItem = (id: string) => { if (items.length > 1) setItems(prev => prev.filter(i => i.id !== id)); };

  const handleItemImage = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const r = new FileReader(); r.onloadend = () => updateItem(id, "imageUrl", r.result as string); r.readAsDataURL(file); }
  };

  /* ─── Logo upload ──────────────────────────────────── */
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const r = new FileReader(); r.onloadend = () => setLogoUrl(r.result as string); r.readAsDataURL(file); }
  };

  /* ─── PDF export — multi-page A4 split ─────────────── */
  const handlePDF = async () => {
    if (!docRef.current) return;
    setIsPdf(true);
    const el = docRef.current;
    const hiddenEls:      { node: HTMLElement; was: string }[]       = [];
    const replacedInputs: { input: HTMLElement; div: HTMLElement }[] = [];
    const savedClasses:   { node: Element; cls: string }[]           = [];
    const savedScrollY = window.scrollY;
    try {
      await document.fonts.ready;

      /* Scroll to top so html2canvas captures from y=0 */
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      await new Promise(r => setTimeout(r, 120));

      /* 1. Hide UI-only controls */
      el.querySelectorAll(".pdf-hide,.pdf-hide-if-empty").forEach(n => {
        const h = n as HTMLElement;
        hiddenEls.push({ node: h, was: h.style.display });
        h.style.display = "none";
      });

      /* 2. Replace inputs/textareas with baked text divs (skip file inputs) */
      Array.from(el.querySelectorAll("input, textarea")).forEach(n => {
        const inp = n as HTMLInputElement | HTMLTextAreaElement;
        if ((inp as HTMLInputElement).type === "file") return;
        const cs  = window.getComputedStyle(inp);
        const div = document.createElement("div");
        div.textContent = inp.value;
        div.style.cssText = [
          "background:transparent", "border:none",
          "font-family:Cairo,Arial,sans-serif",
          `font-size:${cs.fontSize}`, `font-weight:${cs.fontWeight}`,
          `color:${cs.color}`, `text-align:${cs.textAlign}`,
          "width:100%", "white-space:pre-wrap", "word-break:break-word",
          `min-height:${cs.height}`,
          `margin-top:${cs.marginTop}`,
          `margin-bottom:${cs.marginBottom}`,
          `margin-left:${cs.marginLeft}`,
          `margin-right:${cs.marginRight}`,
          `padding:${cs.padding}`,
        ].join(";");
        inp.parentNode!.insertBefore(div, inp);
        (inp as HTMLElement).style.display = "none";
        replacedInputs.push({ input: inp as HTMLElement, div });
      });

      /* 3. Strip Tailwind class names to avoid oklch colour errors */
      Array.from(el.querySelectorAll("[class]")).forEach(n => {
        const cls = n.getAttribute("class") ?? "";
        savedClasses.push({ node: n, cls });
        n.removeAttribute("class");
      });

      await new Promise(r => setTimeout(r, 60));

      /* 4. Capture full element height → multi-page A4 PDF */
      const docW = el.scrollWidth;
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, allowTaint: true,
        backgroundColor: "#ffffff", logging: false,
        scrollX: 0, scrollY: 0,
        width: docW,
        height: el.scrollHeight,
      });
      const name = details.customerName.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, "_") || "عرض_سعر";
      await sliceCanvasToPdf(canvas, el, `${name}_${details.date}.pdf`, docW);
      toast.success("✅ تم تنزيل PDF");
    } catch (e: any) {
      toast.error("فشل إنشاء PDF: " + e.message);
    } finally {
      hiddenEls.forEach(({ node, was }) => (node.style.display = was));
      replacedInputs.forEach(({ input, div }) => {
        div.parentNode?.removeChild(div);
        (input as HTMLElement).style.display = "";
      });
      savedClasses.forEach(({ node, cls }) => cls ? node.setAttribute("class", cls) : node.removeAttribute("class"));
      window.scrollTo({ top: savedScrollY, behavior: "instant" as ScrollBehavior });
      setIsPdf(false);
      setShowPdfMenu(false);
    }
  };

  /* ─── WhatsApp ─────────────────────────────────────── */
  const handleWhatsApp = () => {
    const lines = items.filter(i => i.name.trim())
      .map((i, idx) => `${idx + 1}. ${i.name} × ${i.quantity} = ${fmt(i.total)} د`).join("\n");
    const msg = `*عرض سعر رقم: ${details.quotationNumber}*\nالعميل: ${details.customerName || "—"}\nالتاريخ: ${details.date}\n\n${lines}\n──────────────────\n*المجموع الكلي: ${fmt(grandTotal)} دينار*\n\n${details.companyNameAr}\n☎ ${details.phone}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  /* ─── Save ─────────────────────────────────────────── */
  const handleSave = async () => {
    if (!details.customerName.trim()) { toast.error("مطلوب اسم العميل"); return; }
    const validItems = items.filter(i => i.name.trim());
    if (!validItems.length) { toast.error("مطلوب عنصر واحد على الأقل"); return; }
    setIsSaving(true);
    try {
      const payload = {
        quotationNumber: details.quotationNumber,
        customerName: details.customerName.trim(),
        date: details.date,
        notes: details.notes,
        grandTotal: grandTotal.toFixed(2),
        items: validItems.map(i => ({
          name: i.name.trim(),
          description: i.description || "",
          category: i.category || null,
          quantity: Math.max(1, i.quantity),
          price: i.price.toFixed(2),
          total: i.total.toFixed(2),
          imageUrl: null,
        })),
      };
      const res = await fetch("/api/quotations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.message || `خطأ ${res.status}`); }
      toast.success("تم حفظ عرض السعر ✅");
      sessionStorage.removeItem(DRAFT_KEY);
      navigate("/quotation-history");
    } catch (e: any) {
      toast.error(e.message || "خطأ في الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  /* ─── Computed logo ────────────────────────────────── */
  const effectiveLogo = logoUrl || siteData?.logo?.customUrl || "";

  /* ════════════════════════════════════════════════════ */
  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">

      {/* ── Toolbar ──────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm px-4 py-2 flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all flex items-center gap-1 text-sm font-medium">
            <ArrowRight className="w-4 h-4" />
            رجوع
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-800">عرض السعر — النموذج القديم</h1>
            <p className="text-slate-400 text-xs hidden sm:block">اضغط على أي حقل لتعديله مباشرة</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={clearDraft} className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-red-500 transition-all" title="مسح وبدء من جديد">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={addItem}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all text-sm font-medium">
            <Plus className="w-4 h-4" />
            إضافة صف
          </button>
          <button onClick={handleWhatsApp}
            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-all" title="إرسال واتساب">
            <MessageCircle className="w-4 h-4" />
          </button>
          {/* PDF button */}
          <div className="relative flex items-center">
            <button onClick={handlePDF} disabled={isPdf}
              className="p-1.5 rounded-r-none rounded-l-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all disabled:opacity-50 border-r border-red-200" title="تنزيل PDF">
              {isPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            </button>
            <button onClick={() => setShowPdfMenu(v => !v)} disabled={isPdf}
              className="p-1.5 rounded-l-none rounded-r-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all disabled:opacity-50 px-1.5">
              <ChevronDown className="w-3 h-3" />
            </button>
            {showPdfMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-40"
                onMouseLeave={() => setShowPdfMenu(false)}>
                <button onClick={handlePDF}
                  className="w-full text-right px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-blue-700 flex-shrink-0"></span>
                  تنزيل PDF
                </button>
                <label className="w-full text-right px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-700 cursor-pointer">
                  <span className="w-2 h-2 rounded-full bg-green-600 flex-shrink-0"></span>
                  تغيير الشعار
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
              </div>
            )}
          </div>
          <button onClick={() => navigate("/quotation-history")}
            className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all text-sm border border-slate-200">
            السجل
          </button>
          <button onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-[#1a2744] text-white font-semibold hover:bg-[#1e2f50] transition-all disabled:opacity-50 text-sm">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>

      {/* ── Document ─────────────────────────────────── */}
      <div className="py-8 px-4 flex justify-center">
        <div
          ref={docRef}
          className="bg-white rounded-2xl shadow-xl"
          style={{ width: 794, minWidth: 794, fontFamily: "Cairo, Arial, sans-serif", direction: "rtl" }}
        >

          {/* ── Header ─────────────────────────────── */}
          <div style={{ padding: "24px 28px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>

            {/* English (left) */}
            <div style={{ textAlign: "left", minWidth: 180 }}>
              <input
                value={details.companyNameEn}
                onChange={e => setDetails(p => ({ ...p, companyNameEn: e.target.value }))}
                style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", background: "transparent", border: "none", outline: "none", width: "100%", textAlign: "left" }}
                className="focus:bg-blue-50/50 rounded"
              />
              <input
                value={details.companyLocationEn}
                onChange={e => setDetails(p => ({ ...p, companyLocationEn: e.target.value }))}
                style={{ fontSize: 12, color: "#64748b", background: "transparent", border: "none", outline: "none", width: "100%", textAlign: "left", marginTop: 2 }}
                className="focus:bg-blue-50/50 rounded"
              />
            </div>

            {/* Logo (center) */}
            <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
              {/* intentionally empty center — logo is on right */}
            </div>

            {/* Arabic + logo (right) */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ textAlign: "right" }}>
                <input
                  value={details.companyNameAr}
                  onChange={e => setDetails(p => ({ ...p, companyNameAr: e.target.value }))}
                  style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", background: "transparent", border: "none", outline: "none", width: "100%", textAlign: "right" }}
                  className="focus:bg-blue-50/50 rounded"
                />
                <input
                  value={details.companyLocationAr}
                  onChange={e => setDetails(p => ({ ...p, companyLocationAr: e.target.value }))}
                  style={{ fontSize: 12, color: "#64748b", background: "transparent", border: "none", outline: "none", width: "100%", textAlign: "right", marginTop: 2 }}
                  className="focus:bg-blue-50/50 rounded"
                />
              </div>

              {/* Logo box */}
              <label style={{ cursor: "pointer", position: "relative" }} title="انقر لتغيير الشعار">
                <div style={{
                  width: 88, height: 72, border: "1px solid #d1d5db", borderRadius: 8,
                  overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                  background: "#f8fafc",
                }}>
                  {effectiveLogo ? (
                    <img src={effectiveLogo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
                  ) : (
                    <span style={{ fontSize: 10, color: "#94a3b8", textAlign: "center" }}>شعار<br />الشركة</span>
                  )}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>
            </div>
          </div>

          {/* ── Info row ───────────────────────────── */}
          <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", padding: "14px 0" }}>
            {/* التاريخ */}
            <div style={{ flex: 1, borderLeft: "1px solid #d1d5db", padding: "0 20px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>التاريخ</div>
              <div style={{ height: 1, background: "#d1d5db", margin: "0 0 6px" }} />
              <input
                type="date"
                value={details.date}
                onChange={e => setDetails(p => ({ ...p, date: e.target.value }))}
                style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", background: "transparent", border: "none", outline: "none", textAlign: "center", width: "100%" }}
                className="focus:bg-blue-50/50 rounded"
              />
            </div>
            {/* عرض سعر رقم */}
            <div style={{ flex: 1, borderLeft: "1px solid #d1d5db", padding: "0 20px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>عرض سعر رقم</div>
              <div style={{ height: 1, background: "#d1d5db", margin: "0 0 6px" }} />
              <input
                value={details.quotationNumber}
                onChange={e => setDetails(p => ({ ...p, quotationNumber: e.target.value }))}
                style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", background: "transparent", border: "none", outline: "none", textAlign: "center", width: "100%" }}
                className="focus:bg-blue-50/50 rounded"
              />
            </div>
            {/* العميل */}
            <div style={{ flex: 1, padding: "0 20px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>العميل</div>
              <div style={{ height: 1, background: "#d1d5db", margin: "0 0 6px" }} />
              <input
                value={details.customerName}
                onChange={e => setDetails(p => ({ ...p, customerName: e.target.value }))}
                placeholder="اسم العميل"
                style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", background: "transparent", border: "none", outline: "none", textAlign: "center", width: "100%" }}
                className="focus:bg-blue-50/50 rounded placeholder:text-slate-300"
              />
            </div>
          </div>

          {/* ── Table ──────────────────────────────── */}
          <div style={{ padding: "16px 20px 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#1a2744", color: "#ffffff" }}>
                  <th style={{ padding: "10px 6px", textAlign: "center", width: 32, fontSize: 13 }}>#</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>الاسم</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>الوصف</th>
                  <th style={{ padding: "10px 8px", textAlign: "right" }}>القسم</th>
                  <th style={{ padding: "10px 6px", textAlign: "center", width: 60 }}>الكمية</th>
                  <th style={{ padding: "10px 6px", textAlign: "center", width: 72 }}>السعر</th>
                  <th style={{ padding: "10px 6px", textAlign: "center", width: 84 }}>الإجمالي</th>
                  <th style={{ padding: "10px 6px", textAlign: "center", width: 110 }}>الصورة</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                    {/* # */}
                    <td style={{ padding: "6px", textAlign: "center", fontWeight: 700, color: "#374151", fontSize: 13, verticalAlign: "top", paddingTop: 10 }}>
                      {i + 1}
                    </td>
                    {/* الاسم */}
                    <td style={{ padding: "6px 8px", verticalAlign: "top" }}>
                      <input
                        value={item.name}
                        onChange={e => updateItem(item.id, "name", e.target.value)}
                        placeholder="اسم النبتة"
                        style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 12, fontWeight: 600, color: "#1e293b", textAlign: "right" }}
                        className="focus:bg-blue-50/60 rounded px-1 placeholder:text-slate-300"
                      />
                    </td>
                    {/* الوصف */}
                    <td style={{ padding: "6px 8px", verticalAlign: "top" }}>
                      <input
                        value={item.description}
                        onChange={e => updateItem(item.id, "description", e.target.value)}
                        placeholder="وصف"
                        style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 11, color: "#475569", textAlign: "right" }}
                        className="focus:bg-blue-50/60 rounded px-1 placeholder:text-slate-300"
                      />
                    </td>
                    {/* القسم */}
                    <td style={{ padding: "6px 8px", verticalAlign: "top" }}>
                      <input
                        value={item.category}
                        onChange={e => updateItem(item.id, "category", e.target.value)}
                        placeholder="قسم"
                        style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 11, color: "#475569", textAlign: "right" }}
                        className="focus:bg-blue-50/60 rounded px-1 placeholder:text-slate-300"
                      />
                    </td>
                    {/* الكمية */}
                    <td style={{ padding: "6px", verticalAlign: "top" }}>
                      <input
                        type="number" min={1}
                        value={item.quantity}
                        onChange={e => updateItem(item.id, "quantity", parseFloat(e.target.value) || 1)}
                        style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 12, fontWeight: 700, textAlign: "center" }}
                        className="focus:bg-blue-50/60 rounded px-1"
                      />
                    </td>
                    {/* السعر */}
                    <td style={{ padding: "6px", verticalAlign: "top" }}>
                      <input
                        type="number" min={0} step={0.01}
                        value={item.price || ""}
                        onChange={e => updateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 12, fontWeight: 700, textAlign: "center" }}
                        className="focus:bg-blue-50/60 rounded px-1 placeholder:text-slate-300"
                      />
                    </td>
                    {/* الإجمالي */}
                    <td style={{ padding: "6px", textAlign: "center", fontWeight: 700, fontSize: 12, verticalAlign: "top", paddingTop: 10 }}>
                      {fmt(item.total)}
                    </td>
                    {/* الصورة */}
                    <td style={{ padding: "6px", textAlign: "center", verticalAlign: "middle" }}>
                      <label style={{ cursor: "pointer", display: "block" }}>
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" style={{ width: 90, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid #d1d5db", margin: "0 auto" }} />
                        ) : (
                          <div style={{
                            width: 90, height: 72, border: "2px dashed #cbd5e1", borderRadius: 6,
                            margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, color: "#94a3b8", background: "#f8fafc",
                          }}>
                            صورة
                          </div>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleItemImage(item.id, e)} />
                      </label>
                    </td>
                    {/* حذف الصف — no-print */}
                    <td className="no-print" style={{ padding: "4px 2px", verticalAlign: "top", width: 24 }}>
                      <button onClick={() => removeItem(item.id)}
                        className="text-slate-300 hover:text-red-400 transition-colors mt-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* ── Totals footer ───────────────────── */}
              <tfoot>
                <tr style={{ background: "#1a2744" }}>
                  <td colSpan={6} style={{ padding: "12px 12px", textAlign: "right", fontWeight: 700, fontSize: 14, color: "#ffffff" }}>
                    المجموع الكلي
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "center", fontWeight: 900, fontSize: 15, background: "#2563eb", color: "#ffffff" }}>
                    {fmt(grandTotal)}
                  </td>
                  <td style={{ padding: "12px 8px", textAlign: "center", fontSize: 11, color: "#93c5fd", background: "#2563eb" }}>
                    د.أ
                  </td>
                  <td className="no-print" style={{ background: "#1a2744" }} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── Notes ──────────────────────────────── */}
          {details.notes.trim() && (
            <div style={{ margin: "12px 20px 0", padding: "10px 14px", background: "#f8fafc", borderRight: "3px solid #cbd5e1", borderRadius: 6, fontSize: 12, color: "#374151" }}>
              {details.notes}
            </div>
          )}

          {/* ── Closing & Signature ────────────────── */}
          <div style={{ margin: "24px 24px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            {/* Signature (left) */}
            <div style={{ textAlign: "right" }}>
              <input
                value={details.signerTitle}
                onChange={e => setDetails(p => ({ ...p, signerTitle: e.target.value }))}
                style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", background: "transparent", border: "none", outline: "none", textAlign: "right", marginBottom: 8, display: "block" }}
                className="focus:bg-blue-50/50 rounded px-1"
              />
              <img src={stampImage} alt="ختم" style={{ height: 70, width: "auto" }} />
            </div>
            {/* Closing text (right) */}
            <div style={{ textAlign: "center" }}>
              <input
                value={details.closingText}
                onChange={e => setDetails(p => ({ ...p, closingText: e.target.value }))}
                style={{ fontSize: 14, color: "#374151", background: "transparent", border: "none", outline: "none", textAlign: "center", fontWeight: 500 }}
                className="focus:bg-blue-50/50 rounded px-1"
              />
            </div>
          </div>

          {/* ── Footer ─────────────────────────────── */}
          <div style={{ borderTop: "1px solid #e5e7eb", margin: "0 20px", paddingTop: 12, paddingBottom: 20, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
              <input
                value={details.footerCompany}
                onChange={e => setDetails(p => ({ ...p, footerCompany: e.target.value }))}
                style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", background: "transparent", border: "none", outline: "none", textAlign: "center", width: "auto" }}
                className="focus:bg-blue-50/50 rounded px-1"
              />
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", fontSize: 11, color: "#6b7280" }}>
              {details.phone && (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Phone style={{ width: 11, height: 11 }} />
                  <input
                    value={details.phone}
                    onChange={e => setDetails(p => ({ ...p, phone: e.target.value }))}
                    style={{ fontSize: 11, color: "#6b7280", background: "transparent", border: "none", outline: "none", width: 130 }}
                    className="focus:bg-blue-50/50 rounded px-1"
                  />
                </span>
              )}
              {details.email && (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Mail style={{ width: 11, height: 11 }} />
                  <input
                    value={details.email}
                    onChange={e => setDetails(p => ({ ...p, email: e.target.value }))}
                    style={{ fontSize: 11, color: "#6b7280", background: "transparent", border: "none", outline: "none", width: 160 }}
                    className="focus:bg-blue-50/50 rounded px-1"
                  />
                </span>
              )}
              {details.website && (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Globe style={{ width: 11, height: 11 }} />
                  <input
                    value={details.website}
                    onChange={e => setDetails(p => ({ ...p, website: e.target.value }))}
                    style={{ fontSize: 11, color: "#6b7280", background: "transparent", border: "none", outline: "none", width: 160 }}
                    className="focus:bg-blue-50/50 rounded px-1"
                  />
                </span>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Add row button (floating) ─────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 no-print z-40">
        <button onClick={addItem}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1a2744] text-white shadow-lg hover:bg-[#1e2f50] transition-all text-sm font-semibold">
          <Plus className="w-4 h-4" />
          إضافة صف جديد
        </button>
      </div>
    </div>
  );
}
