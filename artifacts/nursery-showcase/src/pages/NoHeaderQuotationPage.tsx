import { useState, useCallback, useRef, useEffect } from "react";
import { navigate } from "@/App";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus, Trash2, FileText, ArrowRight, Loader2,
  RotateCcw, MessageCircle, Upload, Save,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ─── Color schemes ─────────────────────────────────────── */
const SCHEMES = {
  green:  { accent: "#16a34a", header: "#166534", lightBg: "#f0fdf4", lightBorder: "#bbf7d0" },
  orange: { accent: "#ea580c", header: "#9a3412", lightBg: "#fff7ed", lightBorder: "#fed7aa" },
  blue:   { accent: "#2563eb", header: "#1e40af", lightBg: "#eff6ff", lightBorder: "#bfdbfe" },
  black:  { accent: "#1f2937", header: "#111827", lightBg: "#f8fafc", lightBorder: "#cbd5e1" },
} as const;
type ColorKey = keyof typeof SCHEMES;

const COLOR_LABELS: Record<ColorKey, string> = {
  green: "أخضر", orange: "برتقالي", blue: "أزرق", black: "أسود",
};

/* ─── Types ─────────────────────────────────────────────── */
type Item = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};
type Details = {
  quotationNumber: string;
  customerName: string;
  date: string;
  notes: string;
};

const DRAFT_KEY   = "aq_no_header_draft";
const PREFILL_KEY = "aq_no_header_prefill";
const RECORDS_KEY = "aq_no_header_records";
const EDIT_ID_KEY = "aq_no_header_edit_id";

function loadNoHeaderRecords(): any[] {
  try { const r = localStorage.getItem(RECORDS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}

function persistNoHeaderRecord(data: { details: Details; items: Item[]; logoUrl: string; logoText: string; stampUrl: string; colorKey: string }, id?: string): string {
  const records = loadNoHeaderRecords();
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
});

const mkItem = (): Item => ({
  id: Date.now().toString() + Math.random(),
  name: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  total: 0,
});

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ══════════════════════════════════════════════════════════ */
export default function NoHeaderQuotationPage() {
  const docRef = useRef<HTMLDivElement>(null);

  /* ─── Load prefill / draft ─────────────────────────────── */
  /* ─── Load edit ID (set by records modal) ───────────── */
  const loadEditId = () => {
    try { const id = sessionStorage.getItem(EDIT_ID_KEY); if (id) sessionStorage.removeItem(EDIT_ID_KEY); return id ?? null; } catch { return null; }
  };
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(() => loadEditId());

  const loadInitial = () => {
    try {
      const prefill = sessionStorage.getItem(PREFILL_KEY);
      if (prefill) { sessionStorage.removeItem(PREFILL_KEY); return JSON.parse(prefill); }
      const draft = sessionStorage.getItem(DRAFT_KEY);
      if (draft) return JSON.parse(draft);
    } catch {}
    return null;
  };
  const initial = loadInitial();

  const [details, setDetails] = useState<Details>(initial?.details ?? mkDefault());
  const [items, setItems] = useState<Item[]>(initial?.items ?? [mkItem()]);
  const [logoUrl, setLogoUrl] = useState<string>(initial?.logoUrl ?? "");
  const [logoText, setLogoText] = useState<string>(initial?.logoText ?? "");
  const [stampUrl, setStampUrl] = useState<string>(initial?.stampUrl ?? "");
  const [colorKey, setColorKey] = useState<ColorKey>((initial?.colorKey ?? "green") as ColorKey);
  const [isPdf, setIsPdf] = useState(false);

  const C = SCHEMES[colorKey];

  /* ─── Auto-save draft ──────────────────────────────────── */
  const saveDraft = useCallback(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ details, items, logoUrl, logoText, stampUrl, colorKey })); } catch {}
  }, [details, items, logoUrl, logoText, stampUrl, colorKey]);
  useEffect(() => { saveDraft(); }, [saveDraft]);

  const clearDraft = () => {
    sessionStorage.removeItem(DRAFT_KEY);
    setDetails(mkDefault()); setItems([mkItem()]);
    setLogoUrl(""); setLogoText(""); setStampUrl(""); setColorKey("green");
    setCurrentRecordId(null);
  };

  /* ─── Save to records ────────────────────────────────── */
  const handleSave = () => {
    const id = persistNoHeaderRecord({ details, items, logoUrl, logoText, stampUrl, colorKey }, currentRecordId ?? undefined);
    if (!currentRecordId) setCurrentRecordId(id);
    toast.success("✅ تم الحفظ في السجل");
  };

  /* ─── Totals ───────────────────────────────────────────── */
  const subtotal = items.reduce((s, i) => s + (i.total || 0), 0);

  /* ─── Item helpers ─────────────────────────────────────── */
  const updateItem = (id: string, field: keyof Item, val: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const u = { ...item, [field]: val };
      if (field === "quantity" || field === "unitPrice") u.total = Number(u.quantity) * Number(u.unitPrice);
      return u;
    }));
  };
  const addItem = () => setItems(prev => [...prev, mkItem()]);
  const removeItem = (id: string) => { if (items.length > 1) setItems(prev => prev.filter(i => i.id !== id)); };

  /* ─── Image uploads ────────────────────────────────────── */
  const toBase64 = (file: File, cb: (s: string) => void) => {
    const r = new FileReader(); r.onloadend = () => cb(r.result as string); r.readAsDataURL(file);
  };

  /* ─── PDF export ───────────────────────────────────────── */
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

  /* ─── WhatsApp ─────────────────────────────────────────── */
  const handleWhatsApp = () => {
    const lines = items.filter(i => i.name.trim())
      .map((i, idx) => `${idx + 1}. ${i.name} × ${i.quantity} = ${fmt(i.total)} د`).join("\n");
    const msg = `*عرض سعر رقم: ${details.quotationNumber}*\nالعميل: ${details.customerName || "—"}\nالتاريخ: ${details.date}\n\n${lines}\n──────\n*الإجمالي: ${fmt(subtotal)} دينار*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  /* ─── Reusable input style (no focus classes → no oklch) ── */
  const fieldStyle: React.CSSProperties = {
    background: "transparent", border: "none", outline: "none",
    width: "100%", fontFamily: "Cairo, Arial, sans-serif",
  };

  /* ════════════════════════════════════════════════════════ */
  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#f3f4f6", fontFamily: "Cairo, Arial, sans-serif" }}>

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
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>عرض السعر — دون ترويسة</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>اضغط على أي حقل لتعديله مباشرة</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Color picker */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {(Object.keys(SCHEMES) as ColorKey[]).map(k => (
              <button
                key={k}
                title={COLOR_LABELS[k]}
                onClick={() => setColorKey(k)}
                style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: SCHEMES[k].accent,
                  border: k === colorKey ? "2.5px solid #1e293b" : "2px solid #e2e8f0",
                  cursor: "pointer", flexShrink: 0,
                }}
              />
            ))}
          </div>

          <button onClick={clearDraft} title="مسح وبدء من جديد"
            style={{
              padding: 6, borderRadius: 8, background: "#f8fafc",
              color: "#64748b", border: "1px solid #e2e8f0", cursor: "pointer",
            }}>
            <RotateCcw style={{ width: 14, height: 14 }} />
          </button>

          <button onClick={handleWhatsApp} title="إرسال واتساب"
            style={{
              padding: 6, borderRadius: 8, background: "#f0fdf4",
              color: "#16a34a", border: "1px solid #bbf7d0", cursor: "pointer",
            }}>
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
              background: C.accent, color: "#fff",
              border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13, fontFamily: "Cairo, Arial, sans-serif",
              opacity: isPdf ? 0.6 : 1,
            }}>
            {isPdf ? <Loader2 style={{ width: 14, height: 14 }} /> : <FileText style={{ width: 14, height: 14 }} />}
            {isPdf ? "جاري التنزيل..." : "تنزيل PDF"}
          </button>
        </div>
      </div>

      {/* ── Document ─────────────────────────────────────── */}
      <div style={{ padding: "32px 16px", display: "flex", justifyContent: "center" }}>
        <div
          ref={docRef}
          style={{ background: "#fff", width: 794, minWidth: 794, fontFamily: "Cairo, Arial, sans-serif", direction: "rtl" }}
        >
          {/* Accent top bar */}
          <div style={{ height: 8, background: C.accent }} />

          {/* ── Title row ─────────────────────────────── */}
          <div style={{ padding: "20px 28px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* Logo + text below (right side in RTL) */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, minWidth: 130 }}>
              {logoUrl ? (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <img
                    src={logoUrl}
                    alt="logo"
                    style={{ maxWidth: 130, maxHeight: 90, width: "auto", height: "auto", objectFit: "contain", display: "block" }}
                  />
                  <button
                    className="pdf-hide"
                    onClick={() => setLogoUrl("")}
                    style={{
                      position: "absolute", top: -6, right: -6,
                      background: "#ef4444", color: "#fff",
                      border: "none", borderRadius: "50%",
                      width: 18, height: 18, cursor: "pointer", fontSize: 10,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>✕</button>
                </div>
              ) : (
                <label style={{ cursor: "pointer" }} className="pdf-hide-if-empty">
                  <div style={{
                    width: 90, height: 72, border: "2px dashed #d1d5db", borderRadius: 8,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    background: "#f9fafb", gap: 4,
                  }}>
                    <Upload style={{ width: 18, height: 18, color: "#9ca3af" }} />
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>شعار</span>
                  </div>
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) toBase64(f, setLogoUrl); }} />
                </label>
              )}
              {/* Text below logo */}
              <input
                value={logoText}
                onChange={e => setLogoText(e.target.value)}
                placeholder="نص تحت اللوغو..."
                style={{
                  ...fieldStyle,
                  fontSize: 11, color: "#374151", textAlign: "right",
                  minWidth: 120, maxWidth: 160,
                  borderBottom: isPdf ? "none" : "1px dashed #d1d5db",
                  paddingBottom: 2,
                }}
              />
            </div>

            {/* Title (left in RTL = visually right) */}
            <span style={{ fontSize: 24, fontWeight: 800, color: C.accent, textDecoration: "underline", textDecorationColor: C.accent }}>
              عرض سعر
            </span>
          </div>

          {/* ── Info row ──────────────────────────────── */}
          <div style={{ margin: "0 28px", background: C.lightBg, borderRadius: 8, display: "flex", overflow: "hidden" }}>
            <div style={{ flex: 1, padding: "10px 16px", borderLeft: `1px solid ${C.lightBorder}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 4 }}>العميل</div>
              <input
                value={details.customerName}
                onChange={e => setDetails(p => ({ ...p, customerName: e.target.value }))}
                placeholder="اسم العميل"
                style={{ ...fieldStyle, fontSize: 13, fontWeight: 600, color: "#1e293b", textAlign: "right" }}
              />
            </div>
            <div style={{ flex: 1, padding: "10px 16px", borderLeft: `1px solid ${C.lightBorder}`, textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 4 }}>رقم عرض السعر</div>
              <input
                value={details.quotationNumber}
                onChange={e => setDetails(p => ({ ...p, quotationNumber: e.target.value }))}
                style={{ ...fieldStyle, fontSize: 13, fontWeight: 600, color: "#1e293b", textAlign: "center" }}
              />
            </div>
            <div style={{ flex: 1, padding: "10px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 4 }}>التاريخ</div>
              <input
                type="date"
                value={details.date}
                onChange={e => setDetails(p => ({ ...p, date: e.target.value }))}
                style={{ ...fieldStyle, fontSize: 13, fontWeight: 600, color: "#1e293b", textAlign: "center" }}
              />
            </div>
          </div>

          {/* ── Table ─────────────────────────────────── */}
          <div style={{ margin: "16px 28px 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.header, color: "#ffffff" }}>
                  <th style={{ padding: "10px 8px", textAlign: "center", width: 32, fontFamily: "Cairo, Arial, sans-serif" }}>#</th>
                  <th style={{ padding: "10px 12px", textAlign: "right", fontFamily: "Cairo, Arial, sans-serif" }}>البيان</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", width: 70, fontFamily: "Cairo, Arial, sans-serif" }}>الكمية</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", width: 90, fontFamily: "Cairo, Arial, sans-serif" }}>سعر الوحدة</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", width: 90, fontFamily: "Cairo, Arial, sans-serif" }}>الإجمالي</th>
                  <th className="pdf-hide" style={{ width: 24 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                    <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#374151", verticalAlign: "top", fontFamily: "Cairo, Arial, sans-serif" }}>
                      {i + 1}
                    </td>
                    <td style={{ padding: "8px 12px", verticalAlign: "top" }}>
                      <input
                        value={item.name}
                        onChange={e => updateItem(item.id, "name", e.target.value)}
                        placeholder="اسم البيان"
                        style={{ ...fieldStyle, fontSize: 13, fontWeight: 600, color: "#1e293b", textAlign: "right", marginBottom: 2 }}
                      />
                      <input
                        value={item.description}
                        onChange={e => updateItem(item.id, "description", e.target.value)}
                        placeholder="وصف إضافي..."
                        style={{ ...fieldStyle, fontSize: 11, color: "#6b7280", textAlign: "right" }}
                      />
                    </td>
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                      <input
                        type="number" min={1}
                        value={item.quantity}
                        onChange={e => updateItem(item.id, "quantity", parseFloat(e.target.value) || 1)}
                        style={{ ...fieldStyle, fontSize: 12, fontWeight: 700, textAlign: "center" }}
                      />
                    </td>
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                      <input
                        type="number" min={0} step={0.01}
                        value={item.unitPrice || ""}
                        onChange={e => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        style={{ ...fieldStyle, fontSize: 12, fontWeight: 700, textAlign: "center" }}
                      />
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, fontSize: 13, verticalAlign: "top", fontFamily: "Cairo, Arial, sans-serif" }}>
                      {fmt(item.total)}
                    </td>
                    <td className="pdf-hide" style={{ padding: "8px 2px", verticalAlign: "top", width: 24 }}>
                      <button
                        onClick={() => removeItem(item.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", padding: 2, marginTop: 6 }}>
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* + إضافة صف */}
            <button
              onClick={addItem}
              className="pdf-hide"
              style={{
                display: "flex", alignItems: "center", gap: 4,
                marginTop: 8, background: "none", border: "none",
                color: C.accent, cursor: "pointer",
                fontFamily: "Cairo, Arial, sans-serif", fontSize: 13, fontWeight: 600,
              }}>
              <Plus style={{ width: 15, height: 15 }} />
              إضافة صف
            </button>
          </div>

          {/* ── Totals ────────────────────────────────── */}
          <div style={{ margin: "12px 28px 0" }}>
            <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", padding: "8px 12px", gap: 16 }}>
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 600, minWidth: 120, fontFamily: "Cairo, Arial, sans-serif" }}>المجموع الفرعي</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: "Cairo, Arial, sans-serif" }}>{fmt(subtotal)}</span>
            </div>
            <div style={{
              background: C.accent, borderRadius: 8, padding: "12px 16px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginTop: 4,
            }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#ffffff", fontFamily: "Cairo, Arial, sans-serif" }}>الإجمالي الكلي</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: "#ffffff", fontFamily: "Cairo, Arial, sans-serif" }}>{fmt(subtotal)}</span>
            </div>
          </div>

          {/* ── Notes + Stamp ─────────────────────────── */}
          <div style={{ margin: "20px 28px 0", display: "flex", gap: 20, alignItems: "flex-start" }}>
            {/* Stamp upload (left) */}
            {stampUrl ? (
              <div style={{ position: "relative", display: "inline-block", flexShrink: 0 }}>
                <img src={stampUrl} alt="stamp" style={{ width: 90, height: 90, objectFit: "contain" }} />
                <button
                  className="pdf-hide"
                  onClick={() => setStampUrl("")}
                  style={{
                    position: "absolute", top: -6, right: -6,
                    background: "#ef4444", color: "#fff",
                    border: "none", borderRadius: "50%",
                    width: 18, height: 18, cursor: "pointer", fontSize: 10,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>✕</button>
              </div>
            ) : (
              <label style={{ cursor: "pointer", flexShrink: 0 }} className="pdf-hide-if-empty">
                <div style={{
                  width: 90, height: 90, border: "2px dashed #d1d5db", borderRadius: 8,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  background: "#f9fafb", gap: 4,
                }}>
                  <Upload style={{ width: 20, height: 20, color: "#9ca3af" }} />
                  <span style={{ fontSize: 10, color: "#9ca3af", textAlign: "center" }}>ختم / توقيع</span>
                </div>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) toBase64(f, setStampUrl); }} />
              </label>
            )}

            {/* Notes (right) */}
            <div style={{ flex: 1, textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, marginBottom: 6, fontFamily: "Cairo, Arial, sans-serif" }}>ملاحظات</div>
              <textarea
                value={details.notes}
                onChange={e => setDetails(p => ({ ...p, notes: e.target.value }))}
                placeholder="أي ملاحظات إضافية..."
                rows={3}
                style={{
                  ...fieldStyle,
                  resize: "none",
                  fontSize: 12, color: "#374151",
                  textAlign: "right", direction: "rtl",
                }}
              />
            </div>
          </div>

          {/* Accent bottom bar */}
          <div style={{ height: 8, background: C.accent, marginTop: 24 }} />
        </div>
      </div>

      {/* Floating add row button */}
      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 40 }}>
        <button
          onClick={addItem}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 24px", borderRadius: 9999,
            background: C.accent, color: "#fff",
            border: "none", cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            fontFamily: "Cairo, Arial, sans-serif", fontSize: 13, fontWeight: 700,
          }}>
          <Plus style={{ width: 15, height: 15 }} />
          إضافة صف جديد
        </button>
      </div>
    </div>
  );
}
