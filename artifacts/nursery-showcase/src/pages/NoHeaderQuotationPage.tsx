import { useState, useCallback, useRef, useEffect } from "react";
import { navigate } from "@/App";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus, Trash2, FileText, ArrowRight, Loader2,
  RotateCcw, MessageCircle, Upload,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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

const DRAFT_KEY = "aq_no_header_draft";
const PREFILL_KEY = "aq_no_header_prefill";

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

  /* ─── Load prefill from GalleryPage (if navigated from there) */
  const loadInitial = () => {
    try {
      const prefill = sessionStorage.getItem(PREFILL_KEY);
      if (prefill) {
        sessionStorage.removeItem(PREFILL_KEY);
        return JSON.parse(prefill);
      }
      const draft = sessionStorage.getItem(DRAFT_KEY);
      if (draft) return JSON.parse(draft);
    } catch {}
    return null;
  };

  const initial = loadInitial();

  const [details, setDetails] = useState<Details>(initial?.details ?? mkDefault());
  const [items, setItems] = useState<Item[]>(initial?.items ?? [mkItem()]);
  const [logoUrl, setLogoUrl] = useState<string>(initial?.logoUrl ?? "");
  const [stampUrl, setStampUrl] = useState<string>(initial?.stampUrl ?? "");
  const [isPdf, setIsPdf] = useState(false);

  /* ─── Auto-save draft ──────────────────────────────────── */
  const saveDraft = useCallback(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ details, items, logoUrl, stampUrl })); } catch {}
  }, [details, items, logoUrl, stampUrl]);
  useEffect(() => { saveDraft(); }, [saveDraft]);

  const clearDraft = () => {
    sessionStorage.removeItem(DRAFT_KEY);
    setDetails(mkDefault()); setItems([mkItem()]); setLogoUrl(""); setStampUrl("");
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
    try {
      await document.fonts.ready;
      await new Promise(r => setTimeout(r, 200));
      const canvas = await html2canvas(docRef.current, {
        scale: 2, useCORS: true, allowTaint: true,
        backgroundColor: "#ffffff", logging: false,
        windowWidth: docRef.current.offsetWidth,
      });
      const PX = 3.7795275591;
      const w = canvas.width / PX; const h = canvas.height / PX;
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: [w, h] });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, w, h);
      const name = details.customerName.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, "_") || "عرض_سعر";
      pdf.save(`${name}_${details.date}.pdf`);
      toast.success("✅ تم تنزيل PDF");
    } catch (e: any) {
      toast.error("فشل إنشاء PDF: " + e.message);
    } finally { setIsPdf(false); }
  };

  /* ─── WhatsApp ─────────────────────────────────────────── */
  const handleWhatsApp = () => {
    const lines = items.filter(i => i.name.trim())
      .map((i, idx) => `${idx + 1}. ${i.name} × ${i.quantity} = ${fmt(i.total)} د`).join("\n");
    const msg = `*عرض سعر رقم: ${details.quotationNumber}*\nالعميل: ${details.customerName || "—"}\nالتاريخ: ${details.date}\n\n${lines}\n──────\n*الإجمالي: ${fmt(subtotal)} دينار*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  /* ── Reused input style ─────────────────────────────────── */
  const inp = (extra = "") =>
    `bg-transparent border-none outline-none focus:bg-green-50/60 rounded px-1 w-full ${extra}`;

  /* ════════════════════════════════════════════════════════ */
  return (
    <div dir="rtl" className="min-h-screen bg-gray-100">

      {/* ── Toolbar ─────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all flex items-center gap-1 text-sm font-medium">
            <ArrowRight className="w-4 h-4" /> رجوع
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-800">عرض السعر — دون ترويسة</h1>
            <p className="text-slate-400 text-xs hidden sm:block">اضغط على أي حقل لتعديله مباشرة</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={clearDraft} className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-red-500 transition-all" title="مسح وبدء من جديد">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={handleWhatsApp}
            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-all" title="إرسال واتساب">
            <MessageCircle className="w-4 h-4" />
          </button>
          <button onClick={handlePDF} disabled={isPdf}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-700 text-white font-semibold hover:bg-green-800 transition-all disabled:opacity-50 text-sm">
            {isPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {isPdf ? "جاري التنزيل..." : "تنزيل PDF"}
          </button>
        </div>
      </div>

      {/* ── Document ─────────────────────────────────────── */}
      <div className="py-8 px-4 flex justify-center">
        <div
          ref={docRef}
          className="bg-white"
          style={{ width: 794, minWidth: 794, fontFamily: "Cairo, Arial, sans-serif", direction: "rtl" }}
        >
          {/* Green top bar */}
          <div style={{ height: 8, background: "#16a34a" }} />

          {/* ── Title row ─────────────────────────────── */}
          <div style={{ padding: "20px 28px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* Logo upload (left) */}
            <label style={{ cursor: "pointer" }}>
              <div style={{
                width: 72, height: 72, border: "2px dashed #d1d5db", borderRadius: 8,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                background: "#f9fafb", gap: 4,
              }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
                ) : (
                  <>
                    <Upload style={{ width: 18, height: 18, color: "#9ca3af" }} />
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>شعار</span>
                  </>
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) toBase64(f, setLogoUrl); }} />
            </label>

            {/* Title (right) */}
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#16a34a", textDecoration: "underline", textDecorationColor: "#16a34a" }}>
                عرض سعر
              </span>
            </div>
          </div>

          {/* ── Info row (light green bg) ──────────────── */}
          <div style={{ margin: "0 28px 0", background: "#f0fdf4", borderRadius: 8, display: "flex", overflow: "hidden" }}>
            {/* العميل */}
            <div style={{ flex: 1, padding: "10px 16px", borderLeft: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", marginBottom: 4 }}>العميل</div>
              <input
                value={details.customerName}
                onChange={e => setDetails(p => ({ ...p, customerName: e.target.value }))}
                placeholder="اسم العميل"
                className={inp("text-right placeholder:text-green-200")}
                style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}
              />
            </div>
            {/* رقم عرض السعر */}
            <div style={{ flex: 1, padding: "10px 16px", borderLeft: "1px solid #bbf7d0", textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", marginBottom: 4, textAlign: "center" }}>رقم عرض السعر</div>
              <input
                value={details.quotationNumber}
                onChange={e => setDetails(p => ({ ...p, quotationNumber: e.target.value }))}
                className={inp("text-center")}
                style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}
              />
            </div>
            {/* التاريخ */}
            <div style={{ flex: 1, padding: "10px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", marginBottom: 4, textAlign: "center" }}>التاريخ</div>
              <input
                type="date"
                value={details.date}
                onChange={e => setDetails(p => ({ ...p, date: e.target.value }))}
                className={inp("text-center")}
                style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}
              />
            </div>
          </div>

          {/* ── Table ─────────────────────────────────── */}
          <div style={{ margin: "16px 28px 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#166534", color: "#ffffff" }}>
                  <th style={{ padding: "10px 8px", textAlign: "center", width: 32 }}>#</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>البيان</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", width: 70 }}>الكمية</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", width: 90 }}>سعر الوحدة</th>
                  <th style={{ padding: "10px 8px", textAlign: "center", width: 90 }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb", background: i % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                    {/* # */}
                    <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#374151", verticalAlign: "top" }}>
                      {i + 1}
                    </td>
                    {/* البيان */}
                    <td style={{ padding: "8px 12px", verticalAlign: "top" }}>
                      <input
                        value={item.name}
                        onChange={e => updateItem(item.id, "name", e.target.value)}
                        placeholder="اسم البيان"
                        className={inp("placeholder:text-slate-300")}
                        style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", textAlign: "right", marginBottom: 2 }}
                      />
                      <input
                        value={item.description}
                        onChange={e => updateItem(item.id, "description", e.target.value)}
                        placeholder="وصف إضافي..."
                        className={inp("placeholder:text-slate-200")}
                        style={{ fontSize: 11, color: "#6b7280", textAlign: "right" }}
                      />
                    </td>
                    {/* الكمية */}
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                      <input
                        type="number" min={1}
                        value={item.quantity}
                        onChange={e => updateItem(item.id, "quantity", parseFloat(e.target.value) || 1)}
                        className={inp("text-center")}
                        style={{ fontSize: 12, fontWeight: 700 }}
                      />
                    </td>
                    {/* سعر الوحدة */}
                    <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                      <input
                        type="number" min={0} step={0.01}
                        value={item.unitPrice || ""}
                        onChange={e => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className={inp("text-center placeholder:text-slate-300")}
                        style={{ fontSize: 12, fontWeight: 700 }}
                      />
                    </td>
                    {/* الإجمالي */}
                    <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, fontSize: 13, verticalAlign: "top" }}>
                      {fmt(item.total)}
                    </td>
                    {/* حذف */}
                    <td className="no-print" style={{ padding: "8px 2px", verticalAlign: "top", width: 20 }}>
                      <button onClick={() => removeItem(item.id)} className="text-slate-200 hover:text-red-400 transition-colors mt-1.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* + إضافة صف */}
            <button onClick={addItem}
              className="flex items-center gap-1 mt-2 text-green-700 hover:text-green-800 text-sm font-medium transition-colors no-print">
              <Plus className="w-4 h-4" />
              إضافة صف
            </button>
          </div>

          {/* ── Totals ────────────────────────────────── */}
          <div style={{ margin: "12px 28px 0" }}>
            {/* المجموع الفرعي */}
            <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", padding: "8px 12px", gap: 16 }}>
              <span style={{ fontSize: 13, color: "#374151", fontWeight: 600, minWidth: 120 }}>المجموع الفرعي</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{fmt(subtotal)}</span>
            </div>
            {/* الإجمالي الكلي */}
            <div style={{
              background: "#16a34a", borderRadius: 8, padding: "12px 16px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginTop: 4,
            }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#ffffff" }}>الإجمالي الكلي</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: "#ffffff" }}>{fmt(subtotal)}</span>
            </div>
          </div>

          {/* ── Notes + Stamp ─────────────────────────── */}
          <div style={{ margin: "20px 28px 0", display: "flex", gap: 20, alignItems: "flex-start" }}>
            {/* Stamp upload (left) */}
            <label style={{ cursor: "pointer", flexShrink: 0 }}>
              <div style={{
                width: 90, height: 90, border: "2px dashed #d1d5db", borderRadius: 8,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                background: "#f9fafb", gap: 4,
              }}>
                {stampUrl ? (
                  <img src={stampUrl} alt="stamp" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
                ) : (
                  <>
                    <Upload style={{ width: 20, height: 20, color: "#9ca3af" }} />
                    <span style={{ fontSize: 10, color: "#9ca3af", textAlign: "center" }}>ختم / توقيع</span>
                  </>
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) toBase64(f, setStampUrl); }} />
            </label>

            {/* Notes (right) */}
            <div style={{ flex: 1, textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", marginBottom: 6 }}>ملاحظات</div>
              <textarea
                value={details.notes}
                onChange={e => setDetails(p => ({ ...p, notes: e.target.value }))}
                placeholder="أي ملاحظات إضافية..."
                rows={3}
                className="w-full bg-transparent border-none outline-none focus:bg-green-50/40 rounded px-1 resize-none placeholder:text-slate-300"
                style={{ fontSize: 12, color: "#374151", textAlign: "right", direction: "rtl" }}
              />
            </div>
          </div>

          {/* Green bottom bar */}
          <div style={{ height: 8, background: "#16a34a", marginTop: 24 }} />
        </div>
      </div>

      {/* Floating add button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 no-print z-40">
        <button onClick={addItem}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-700 text-white shadow-lg hover:bg-green-800 transition-all text-sm font-semibold">
          <Plus className="w-4 h-4" />
          إضافة صف جديد
        </button>
      </div>
    </div>
  );
}
