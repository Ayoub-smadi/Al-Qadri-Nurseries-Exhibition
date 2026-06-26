import { useState, useCallback, useRef, useEffect } from "react";
import { navigate } from "@/App";
import { useApp } from "@/lib/context";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus, Trash2, FileText, ArrowRight, Loader2,
  RotateCcw, MessageCircle, Sparkles, ChevronDown, ChevronUp, Upload, X, Save,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ─── Types ─────────────────────────────────────────────── */
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

const DRAFT_KEY   = "aq_qadri_old_inline_draft";
const RECORDS_KEY = "aq_qadri_old_records";
const EDIT_ID_KEY = "aq_qadri_old_edit_id";

function loadQadriRecords(): any[] {
  try { const r = localStorage.getItem(RECORDS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}

function persistQadriRecord(data: { details: Details; items: Item[]; logoUrl: string; stampUrl: string }, id?: string): string {
  const records = loadQadriRecords();
  const now = new Date().toISOString();
  if (id) {
    const idx = records.findIndex((r: any) => r.id === id);
    if (idx >= 0) {
      records[idx] = { ...records[idx], ...data, updatedAt: now };
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
      return id;
    }
  }
  const newId = Date.now().toString();
  records.unshift({ ...data, id: newId, createdAt: now, updatedAt: now });
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  return newId;
}

const mkDefault = (): Details => ({
  quotationNumber: format(new Date(), "yyyyMMdd"),
  customerName: "",
  date: format(new Date(), "yyyy-MM-dd"),
  notes: "",
  phone: "00962777772211",
  email: "tamerqadri@gmail.com",
  website: "www.alkadri-plants.com",
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

const F: React.CSSProperties = {
  background: "transparent", border: "none", outline: "none",
  width: "100%", fontFamily: "Cairo, Arial, sans-serif",
};

/* ══════════════════════════════════════════════════════════ */
export default function QadriOldQuotationPage() {
  const { siteData } = useApp();
  const docRef = useRef<HTMLDivElement>(null);

  /* ─── Load draft ────────────────────────────────────── */
  /* ─── Load edit ID (set by records modal) ───────────── */
  const loadEditId = () => {
    try { const id = sessionStorage.getItem(EDIT_ID_KEY); if (id) sessionStorage.removeItem(EDIT_ID_KEY); return id ?? null; } catch { return null; }
  };
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(() => loadEditId());

  const loadDraft = () => {
    try { const r = sessionStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  };
  const draft = loadDraft();

  const [details, setDetails] = useState<Details>(draft?.details ?? mkDefault());
  const [items, setItems] = useState<Item[]>(draft?.items ?? [mkItem()]);
  const [logoUrl, setLogoUrl] = useState<string>(draft?.logoUrl ?? "");
  const [stampUrl, setStampUrl] = useState<string>(draft?.stampUrl ?? "");
  const [isPdf, setIsPdf] = useState(false);

  /* ─── Smart analysis state ──────────────────────────── */
  const [showSmart, setShowSmart] = useState(false);
  const [smartText, setSmartText] = useState("");

  /* ─── Auto-save ─────────────────────────────────────── */
  const saveDraft = useCallback(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ details, items, logoUrl, stampUrl })); } catch {}
  }, [details, items, logoUrl, stampUrl]);
  useEffect(() => { saveDraft(); }, [saveDraft]);

  const clearDraft = () => {
    sessionStorage.removeItem(DRAFT_KEY);
    setDetails(mkDefault()); setItems([mkItem()]);
    setLogoUrl(""); setStampUrl("");
    setCurrentRecordId(null);
  };

  /* ─── Save to records ────────────────────────────────── */
  const handleSave = () => {
    const id = persistQadriRecord({ details, items, logoUrl, stampUrl }, currentRecordId ?? undefined);
    if (!currentRecordId) setCurrentRecordId(id);
    toast.success("✅ تم الحفظ في السجل");
  };

  /* ─── Totals ─────────────────────────────────────────── */
  const grandTotal = items.reduce((s, i) => s + (i.total || 0), 0);

  /* ─── Item helpers ───────────────────────────────────── */
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
  const toBase64 = (file: File, cb: (s: string) => void) => {
    const r = new FileReader(); r.onloadend = () => cb(r.result as string); r.readAsDataURL(file);
  };

  /* ─── Smart Analysis parser ──────────────────────────── */
  /*  Format (one item per line):  كمية/اسم/وصف/قسم/سعر   */
  const handleSmartParse = () => {
    const lines = smartText.trim().split("\n").filter(l => l.trim());
    if (!lines.length) { toast.error("أدخل بيانات أولاً"); return; }
    const parsed: Item[] = [];
    const errors: number[] = [];
    lines.forEach((line, idx) => {
      const parts = line.split("/").map(p => p.trim());
      const qty   = parseFloat(parts[0] ?? "");
      const name  = parts[1] ?? "";
      const desc  = parts[2] ?? "";
      const cat   = parts[3] ?? "";
      const price = parseFloat(parts[4] ?? "");
      if (!name) { errors.push(idx + 1); return; }
      const q = isNaN(qty)   ? 1 : qty;
      const p = isNaN(price) ? 0 : price;
      parsed.push({ id: Date.now().toString() + Math.random(), name, description: desc, category: cat, quantity: q, price: p, total: q * p });
    });
    if (!parsed.length) { toast.error("لم يتم التعرف على أي عنصر"); return; }
    setItems(prev => {
      const clean = prev.filter(i => i.name.trim());
      return clean.length ? [...clean, ...parsed] : parsed;
    });
    if (errors.length) toast.warning(`تم استيراد ${parsed.length} عنصر — السطور ${errors.join(", ")} تجاهلناها (اسم مفقود)`);
    else toast.success(`✅ تم استيراد ${parsed.length} عنصر`);
    setSmartText(""); setShowSmart(false);
  };

  /* ─── Effective logo ─────────────────────────────────── */
  const effectiveLogo = logoUrl || siteData?.logo?.customUrl || "";

  /* ─── PDF export ─────────────────────────────────────── */
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

      /* Scroll to top without triggering browser zoom */
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      await new Promise(r => setTimeout(r, 120));

      /* 1. Hide UI-only controls */
      el.querySelectorAll(".pdf-hide,.pdf-hide-if-empty").forEach(n => {
        const h = n as HTMLElement;
        hiddenEls.push({ node: h, was: h.style.display });
        h.style.display = "none";
      });

      /* 2. Replace inputs/textareas with baked text divs */
      Array.from(el.querySelectorAll("input, textarea")).forEach(n => {
        const inp = n as HTMLInputElement | HTMLTextAreaElement;
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
        ].join(";");
        inp.parentNode!.insertBefore(div, inp);
        (inp as HTMLElement).style.display = "none";
        replacedInputs.push({ input: inp as HTMLElement, div });
      });

      /* 3. Strip class names to avoid oklch errors */
      Array.from(el.querySelectorAll("[class]")).forEach(n => {
        savedClasses.push({ node: n, cls: n.className });
        n.removeAttribute("class");
      });

      await new Promise(r => setTimeout(r, 60));

      /* 4. Capture the full element at its natural size */
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, allowTaint: true,
        backgroundColor: "#ffffff", logging: false,
        scrollX: 0, scrollY: 0,
        width: el.scrollWidth,
        height: el.scrollHeight,
      });
      const PX = 3.7795275591;
      const w  = canvas.width  / PX;
      const h  = canvas.height / PX;
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: [w, h] });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, w, h);
      const name = details.customerName.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, "_") || "عرض_سعر";
      pdf.save(`${name}_${details.date}.pdf`);
      toast.success("✅ تم تنزيل PDF");
    } catch (e: any) {
      toast.error("فشل إنشاء PDF: " + e.message);
    } finally {
      hiddenEls.forEach(({ node, was }) => (node.style.display = was));
      replacedInputs.forEach(({ input, div }) => {
        div.parentNode?.removeChild(div);
        input.style.display = "";
      });
      savedClasses.forEach(({ node, cls }) => (node.className = cls));
      window.scrollTo({ top: savedScrollY, behavior: "instant" as ScrollBehavior });
      setIsPdf(false);
    }
  };

  /* ─── WhatsApp ───────────────────────────────────────── */
  const handleWhatsApp = () => {
    const lines = items.filter(i => i.name.trim())
      .map((i, idx) => `${idx + 1}. ${i.name} × ${i.quantity} = ${fmt(i.total)} د`).join("\n");
    const msg = `*عرض سعر رقم: ${details.quotationNumber}*\nالعميل: ${details.customerName || "—"}\nالتاريخ: ${details.date}\n\n${lines}\n──────────────────\n*المجموع الكلي: ${fmt(grandTotal)} دينار*\n\n${details.companyNameAr}\n☎ ${details.phone}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  /* ════════════════════════════════════════════════════════ */
  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "Cairo, Arial, sans-serif" }}>

      {/* ── Toolbar ──────────────────────────────────────── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "#fff", borderBottom: "1px solid #e2e8f0",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        padding: "8px 16px",
        display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/")}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "5px 10px", borderRadius: 8,
              background: "#f1f5f9", color: "#475569",
              border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              fontFamily: "Cairo, Arial, sans-serif",
            }}>
            <ArrowRight style={{ width: 15, height: 15 }} /> رجوع
          </button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>عرض السعر — قادري قديم</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>اضغط على أي حقل لتعديله مباشرة</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Smart Analysis toggle */}
          <button
            onClick={() => setShowSmart(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: 8,
              background: showSmart ? "#fef3c7" : "#f8fafc",
              color: showSmart ? "#92400e" : "#475569",
              border: showSmart ? "1px solid #fcd34d" : "1px solid #e2e8f0",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              fontFamily: "Cairo, Arial, sans-serif",
            }}>
            <Sparkles style={{ width: 14, height: 14 }} />
            تحليل ذكي
            {showSmart
              ? <ChevronUp style={{ width: 12, height: 12 }} />
              : <ChevronDown style={{ width: 12, height: 12 }} />}
          </button>

          <button onClick={clearDraft} title="مسح وبدء من جديد"
            style={{ padding: 6, borderRadius: 8, background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", cursor: "pointer" }}>
            <RotateCcw style={{ width: 14, height: 14 }} />
          </button>

          <button onClick={addItem}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "6px 12px", borderRadius: 8,
              background: "#f1f5f9", color: "#374151",
              border: "1px solid #e2e8f0", cursor: "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "Cairo, Arial, sans-serif",
            }}>
            <Plus style={{ width: 14, height: 14 }} /> إضافة صف
          </button>

          <button onClick={handleWhatsApp}
            style={{ padding: 6, borderRadius: 8, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", cursor: "pointer" }}>
            <MessageCircle style={{ width: 14, height: 14 }} />
          </button>

          <button onClick={handleSave}
            title={currentRecordId ? "تحديث السجل" : "حفظ في السجل"}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: 8,
              background: currentRecordId ? "#eff6ff" : "#f0fdf4",
              color: currentRecordId ? "#2563eb" : "#059669",
              border: currentRecordId ? "1px solid #bfdbfe" : "1px solid #6ee7b7",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              fontFamily: "Cairo, Arial, sans-serif",
            }}>
            <Save style={{ width: 14, height: 14 }} />
            {currentRecordId ? "تحديث" : "حفظ"}
          </button>

          <button onClick={handlePDF} disabled={isPdf}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 16px", borderRadius: 8,
              background: "#1a2744", color: "#fff",
              border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13, fontFamily: "Cairo, Arial, sans-serif",
              opacity: isPdf ? 0.6 : 1,
            }}>
            {isPdf ? <Loader2 style={{ width: 14, height: 14 }} /> : <FileText style={{ width: 14, height: 14 }} />}
            {isPdf ? "جاري التنزيل..." : "تنزيل PDF"}
          </button>
        </div>
      </div>

      {/* ── Smart Analysis Panel ──────────────────────────── */}
      {showSmart && (
        <div style={{
          margin: "12px auto", maxWidth: 794,
          background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12,
          padding: "16px 20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#92400e", display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles style={{ width: 15, height: 15 }} /> التحليل الذكي — تعبئة تلقائية
              </div>
              <div style={{ fontSize: 12, color: "#78350f", marginTop: 3 }}>
                أدخل كل عنصر في سطر بالتنسيق: <strong>الكمية / الاسم / الوصف / القسم / السعر</strong>
              </div>
              <div style={{ fontSize: 11, color: "#92400e", marginTop: 2, opacity: 0.8 }}>
                مثال: 3 / نخيل تمري / صحراوي / نخيل / 150
              </div>
            </div>
            <button onClick={() => setShowSmart(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#92400e" }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <textarea
            value={smartText}
            onChange={e => setSmartText(e.target.value)}
            placeholder={"3 / نخيل تمري / صحراوي / نخيل / 150\n5 / زيتون / شجرة محلية / زيتون / 80\n10 / ورد جوري / / زهور / 12"}
            rows={5}
            style={{
              width: "100%", borderRadius: 8, border: "1px solid #fcd34d",
              padding: "10px 12px", fontSize: 13, fontFamily: "Cairo, Arial, sans-serif",
              background: "#fff", color: "#1e293b", direction: "rtl",
              resize: "vertical", boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button onClick={handleSmartParse}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 20px", borderRadius: 8,
                background: "#f59e0b", color: "#fff",
                border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 13, fontFamily: "Cairo, Arial, sans-serif",
              }}>
              <Sparkles style={{ width: 14, height: 14 }} />
              تحليل وتعبئة الجدول
            </button>
          </div>
        </div>
      )}

      {/* ── Document ──────────────────────────────────────── */}
      <div style={{ padding: "24px 16px", display: "flex", justifyContent: "center" }}>
        <div
          ref={docRef}
          style={{
            background: "#fff", width: 794, minWidth: 794,
            fontFamily: "Cairo, Arial, sans-serif", direction: "rtl",
            borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
            overflow: "hidden",
          }}
        >

          {/* ── Company Header ─────────────────────────── */}
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>

            {/* English (left) */}
            <div style={{ textAlign: "left", minWidth: 180 }}>
              <input
                value={details.companyNameEn}
                onChange={e => setDetails(p => ({ ...p, companyNameEn: e.target.value }))}
                style={{ ...F, fontSize: 13, fontWeight: 600, color: "#1e293b", textAlign: "left" }}
              />
              <input
                value={details.companyLocationEn}
                onChange={e => setDetails(p => ({ ...p, companyLocationEn: e.target.value }))}
                style={{ ...F, fontSize: 12, color: "#64748b", textAlign: "left", marginTop: 2 }}
              />
            </div>

            {/* Center spacer */}
            <div style={{ flex: 1 }} />

            {/* Arabic + logo (right) */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ textAlign: "right" }}>
                <input
                  value={details.companyNameAr}
                  onChange={e => setDetails(p => ({ ...p, companyNameAr: e.target.value }))}
                  style={{ ...F, fontSize: 15, fontWeight: 700, color: "#1e293b", textAlign: "right" }}
                />
                <input
                  value={details.companyLocationAr}
                  onChange={e => setDetails(p => ({ ...p, companyLocationAr: e.target.value }))}
                  style={{ ...F, fontSize: 12, color: "#64748b", textAlign: "right", marginTop: 2 }}
                />
              </div>

              {/* Logo box */}
              <label style={{ cursor: "pointer", position: "relative", flexShrink: 0 }} title="انقر لتغيير الشعار">
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
                <input type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) toBase64(f, setLogoUrl); }} />
              </label>
            </div>
          </div>

          {/* ── Info row (date / number / customer) ────── */}
          <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", padding: "14px 0" }}>
            <div style={{ flex: 1, borderLeft: "1px solid #d1d5db", padding: "0 20px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>التاريخ</div>
              <div style={{ height: 1, background: "#d1d5db", margin: "0 0 6px" }} />
              <input
                type="date"
                value={details.date}
                onChange={e => setDetails(p => ({ ...p, date: e.target.value }))}
                style={{ ...F, fontSize: 13, fontWeight: 600, color: "#1e293b", textAlign: "center" }}
              />
            </div>
            <div style={{ flex: 1, borderLeft: "1px solid #d1d5db", padding: "0 20px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>عرض سعر رقم</div>
              <div style={{ height: 1, background: "#d1d5db", margin: "0 0 6px" }} />
              <input
                value={details.quotationNumber}
                onChange={e => setDetails(p => ({ ...p, quotationNumber: e.target.value }))}
                style={{ ...F, fontSize: 13, fontWeight: 700, color: "#1e293b", textAlign: "center" }}
              />
            </div>
            <div style={{ flex: 1, padding: "0 20px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>العميل</div>
              <div style={{ height: 1, background: "#d1d5db", margin: "0 0 6px" }} />
              <input
                value={details.customerName}
                onChange={e => setDetails(p => ({ ...p, customerName: e.target.value }))}
                placeholder="اسم العميل"
                style={{ ...F, fontSize: 13, fontWeight: 600, color: "#1e293b", textAlign: "center" }}
              />
            </div>
          </div>

          {/* ── Table ──────────────────────────────────── */}
          <div style={{ padding: "16px 20px 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#1a2744", color: "#ffffff" }}>
                  <th style={{ padding: "10px 6px", textAlign: "center", width: 32, fontFamily: "Cairo, Arial, sans-serif" }}>#</th>
                  <th style={{ padding: "10px 8px", textAlign: "right", fontFamily: "Cairo, Arial, sans-serif" }}>الاسم</th>
                  <th style={{ padding: "10px 8px", textAlign: "right", fontFamily: "Cairo, Arial, sans-serif" }}>الوصف</th>
                  <th style={{ padding: "10px 8px", textAlign: "right", fontFamily: "Cairo, Arial, sans-serif" }}>القسم</th>
                  <th style={{ padding: "10px 6px", textAlign: "center", width: 60, fontFamily: "Cairo, Arial, sans-serif" }}>الكمية</th>
                  <th style={{ padding: "10px 6px", textAlign: "center", width: 72, fontFamily: "Cairo, Arial, sans-serif" }}>السعر</th>
                  <th style={{ padding: "10px 6px", textAlign: "center", width: 84, fontFamily: "Cairo, Arial, sans-serif" }}>الإجمالي</th>
                  <th style={{ padding: "10px 6px", textAlign: "center", width: 100, fontFamily: "Cairo, Arial, sans-serif" }}>الصورة</th>
                  <th className="pdf-hide" style={{ width: 24 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                    {/* # */}
                    <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#374151", fontSize: 13, verticalAlign: "top", paddingTop: 12 }}>
                      {i + 1}
                    </td>
                    {/* الاسم */}
                    <td style={{ padding: "8px", verticalAlign: "top" }}>
                      <input
                        value={item.name}
                        onChange={e => updateItem(item.id, "name", e.target.value)}
                        placeholder="اسم النبتة"
                        style={{ ...F, fontSize: 12, fontWeight: 600, color: "#1e293b", textAlign: "right" }}
                      />
                    </td>
                    {/* الوصف */}
                    <td style={{ padding: "8px", verticalAlign: "top" }}>
                      <input
                        value={item.description}
                        onChange={e => updateItem(item.id, "description", e.target.value)}
                        placeholder="وصف"
                        style={{ ...F, fontSize: 11, color: "#475569", textAlign: "right" }}
                      />
                    </td>
                    {/* القسم */}
                    <td style={{ padding: "8px", verticalAlign: "top" }}>
                      <input
                        value={item.category}
                        onChange={e => updateItem(item.id, "category", e.target.value)}
                        placeholder="قسم"
                        style={{ ...F, fontSize: 11, color: "#475569", textAlign: "right" }}
                      />
                    </td>
                    {/* الكمية */}
                    <td style={{ padding: "6px", verticalAlign: "top" }}>
                      <input
                        type="number" min={1}
                        value={item.quantity}
                        onChange={e => updateItem(item.id, "quantity", parseFloat(e.target.value) || 1)}
                        style={{ ...F, fontSize: 12, fontWeight: 700, textAlign: "center" }}
                      />
                    </td>
                    {/* السعر */}
                    <td style={{ padding: "6px", verticalAlign: "top" }}>
                      <input
                        type="number" min={0} step={0.01}
                        value={item.price || ""}
                        onChange={e => updateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        style={{ ...F, fontSize: 12, fontWeight: 700, textAlign: "center" }}
                      />
                    </td>
                    {/* الإجمالي */}
                    <td style={{ padding: "6px", textAlign: "center", fontWeight: 700, fontSize: 12, verticalAlign: "top", paddingTop: 12, fontFamily: "Cairo, Arial, sans-serif" }}>
                      {fmt(item.total)}
                    </td>
                    {/* الصورة */}
                    <td style={{ padding: "6px", textAlign: "center", verticalAlign: "middle" }}>
                      <div
                        style={{ cursor: "pointer", display: "block" }}
                        onClick={() => { const inp = document.getElementById(`img-input-${item.id}`) as HTMLInputElement; inp?.click(); }}
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" style={{ width: 80, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid #d1d5db", margin: "0 auto" }} />
                        ) : (
                          <div className="pdf-hide-if-empty" style={{
                            width: 80, height: 64, border: "1px dashed #d1d5db", borderRadius: 6,
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            background: "#f9fafb", margin: "0 auto", gap: 3,
                          }}>
                            <Upload style={{ width: 14, height: 14, color: "#9ca3af" }} />
                            <span style={{ fontSize: 10, color: "#9ca3af" }}>صورة</span>
                          </div>
                        )}
                      </div>
                      <input
                        id={`img-input-${item.id}`}
                        type="file"
                        accept="image/*"
                        style={{ position: "fixed", top: -9999, left: -9999, opacity: 0, width: 1, height: 1 }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) toBase64(f, v => updateItem(item.id, "imageUrl", v)); }}
                      />
                    </td>
                    {/* حذف */}
                    <td className="pdf-hide" style={{ padding: "6px 2px", verticalAlign: "top", width: 24 }}>
                      <button onClick={() => removeItem(item.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", padding: 2, marginTop: 8 }}>
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* + إضافة صف */}
            <button onClick={addItem} className="pdf-hide"
              style={{
                display: "flex", alignItems: "center", gap: 4,
                marginTop: 8, background: "none", border: "none",
                color: "#1a2744", cursor: "pointer",
                fontFamily: "Cairo, Arial, sans-serif", fontSize: 13, fontWeight: 600,
              }}>
              <Plus style={{ width: 15, height: 15 }} />
              إضافة صف
            </button>
          </div>

          {/* ── Grand Total ─────────────────────────────── */}
          <div style={{ margin: "8px 20px 0" }}>
            <div style={{
              background: "#1a2744", color: "#fff",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 16px", borderRadius: 4,
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "Cairo, Arial, sans-serif" }}>المجموع الكلي</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: "#60a5fa", fontFamily: "Cairo, Arial, sans-serif" }}>{fmt(grandTotal)}</span>
                <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "Cairo, Arial, sans-serif" }}>د.أ</span>
              </div>
            </div>
          </div>

          {/* ── Notes + Closing + Stamp ──────────────────── */}
          <div style={{ margin: "20px 24px 0", display: "flex", gap: 20, alignItems: "flex-start" }}>
            {/* Stamp / signature */}
            <div style={{ flexShrink: 0 }}>
              {stampUrl ? (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <img src={stampUrl} alt="stamp" style={{ width: 110, height: 90, objectFit: "contain" }} />
                  <button className="pdf-hide" onClick={() => setStampUrl("")}
                    style={{
                      position: "absolute", top: -6, right: -6,
                      background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%",
                      width: 18, height: 18, cursor: "pointer", fontSize: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>✕</button>
                </div>
              ) : (
                <label style={{ cursor: "pointer" }} className="pdf-hide-if-empty">
                  <div style={{
                    width: 110, height: 90, border: "2px dashed #d1d5db", borderRadius: 8,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    background: "#f9fafb", gap: 4,
                  }}>
                    <Upload style={{ width: 20, height: 20, color: "#9ca3af" }} />
                    <span style={{ fontSize: 10, color: "#9ca3af", textAlign: "center" }}>ختم / توقيع</span>
                  </div>
                  <input type="file" accept="image/*" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) toBase64(f, setStampUrl); }} />
                </label>
              )}
            </div>

            {/* Closing text + signer */}
            <div style={{ flex: 1, textAlign: "right" }}>
              <input
                value={details.closingText}
                onChange={e => setDetails(p => ({ ...p, closingText: e.target.value }))}
                style={{ ...F, fontSize: 13, color: "#374151", textAlign: "right", marginBottom: 8 }}
              />
              <input
                value={details.signerTitle}
                onChange={e => setDetails(p => ({ ...p, signerTitle: e.target.value }))}
                style={{ ...F, fontSize: 13, fontWeight: 700, color: "#1e293b", textAlign: "right" }}
              />
              {/* Notes */}
              <textarea
                value={details.notes}
                onChange={e => setDetails(p => ({ ...p, notes: e.target.value }))}
                placeholder="ملاحظات إضافية..."
                rows={3}
                style={{
                  ...F, fontSize: 12, color: "#374151", textAlign: "right",
                  resize: "none", marginTop: 10,
                  borderTop: "1px dashed #e2e8f0", paddingTop: 6,
                }}
              />
            </div>
          </div>

          {/* ── Footer ─────────────────────────────────── */}
          <div style={{
            marginTop: 20,
            borderTop: "1px solid #e5e7eb",
            background: "#f8fafc",
            padding: "12px 24px",
            display: "flex", justifyContent: "center", alignItems: "center",
            flexDirection: "column", gap: 4,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: "Cairo, Arial, sans-serif" }}>
              <input
                value={details.footerCompany}
                onChange={e => setDetails(p => ({ ...p, footerCompany: e.target.value }))}
                style={{ ...F, textAlign: "center", fontWeight: 700 }}
              />
            </div>
            <div style={{ display: "flex", gap: 24, fontSize: 11, color: "#64748b", flexWrap: "wrap", justifyContent: "center" }}>
              {details.phone && <span>☎ {details.phone}</span>}
              {details.email && <span>✉ {details.email}</span>}
              {details.website && <span>🌐 {details.website}</span>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
