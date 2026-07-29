import { useState, useCallback, useRef, useEffect } from "react";
import { navigate } from "@/App";
import { useApp } from "@/lib/context";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus, Trash2, FileText, ArrowRight, Loader2,
  RotateCcw, MessageCircle, Sparkles, ChevronDown, ChevronUp, Upload, X, Save, FilePlus, Scissors, RefreshCw,
} from "lucide-react";
import html2canvas from "html2canvas";
import { sliceCanvasToPdf } from "@/lib/pdfMultiPage";
import { createInvoice, InvoiceItem, loadSavedToken, upsertQadriOldQuotation, uploadImageBase64 } from "@/lib/storage";

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

/** Strip base64 data-URLs from item imageUrls before persisting.
 *  Plant-picker images can be several hundred KB each; storing them in
 *  localStorage multiplies across every record and quickly hits the ~5-10 MB
 *  per-origin quota.  Only short URL strings (e.g. /api/images/…) are kept. */
function stripItemImages(items: Item[]): Item[] {
  return items.map(item => ({
    ...item,
    imageUrl: item.imageUrl?.startsWith("data:") ? undefined : item.imageUrl,
  }));
}

function persistQadriRecord(data: { details: Details; items: Item[]; logoUrl: string; stampUrl: string; discountPct: number; taxPct: number }, id?: string): string {
  const records = loadQadriRecords();
  const now = new Date().toISOString();
  const sanitized = { ...data, items: stripItemImages(data.items) };
  if (id) {
    const idx = records.findIndex((r: any) => r.id === id);
    if (idx >= 0) {
      records[idx] = { ...records[idx], ...sanitized, updatedAt: now };
      localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
      return id;
    }
  }
  const newId = Date.now().toString();
  records.unshift({ ...sanitized, id: newId, createdAt: now, updatedAt: now });
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
  website: "https://alkadrionline.com/",
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

  const normalizeDetails = (d: Details): Details =>
    d.website && d.website.includes("alkadri-plants.com")
      ? { ...d, website: "https://alkadrionline.com" }
      : d;
  const [details, setDetails] = useState<Details>(
    draft?.details ? normalizeDetails(draft.details) : mkDefault()
  );
  const [items, setItems] = useState<Item[]>(draft?.items ?? [mkItem()]);
  const [logoUrl, setLogoUrl] = useState<string>(draft?.logoUrl ?? "");
  const [stampUrl, setStampUrl] = useState<string>(draft?.stampUrl ?? "/stamp-qadri.png");
  const [isPdf, setIsPdf] = useState(false);
  const [discountPct, setDiscountPct] = useState<number>(draft?.discountPct ?? 0);
  const [taxPct, setTaxPct] = useState<number>(draft?.taxPct ?? 0);
  const [showPlantPicker, setShowPlantPicker] = useState(false);
  const [plantSearch, setPlantSearch] = useState("");

  /* ─── Smart analysis state ──────────────────────────── */
  const [showSmart, setShowSmart] = useState(false);
  const [smartText, setSmartText] = useState("");
  const [convertingToInvoice, setConvertingToInvoice] = useState(false);

  /* ─── Hidden parts (حذف الأجزاء) ────────────────────── */
  type HiddenParts = {
    colDescription: boolean;
    colCategory: boolean;
    colImage: boolean;
    colIndex: boolean;
    colPrice: boolean;
    colTotal: boolean;
    infoDate: boolean;
    infoQuotationNumber: boolean;
    infoCustomer: boolean;
    grandTotal: boolean;
    subtotalRows: boolean;
    notes: boolean;
    closing: boolean;
    stamp: boolean;
    footer: boolean;
  };
  const [hiddenParts, setHiddenParts] = useState<HiddenParts>({
    colDescription: false, colCategory: false, colImage: false, colIndex: false,
    colPrice: false, colTotal: false,
    infoDate: false, infoQuotationNumber: false, infoCustomer: false,
    grandTotal: false, subtotalRows: false, notes: false, closing: false, stamp: false, footer: false,
  });
  const [deleteMode, setDeleteMode] = useState(false);
  const hidePartBtn = (key: keyof HiddenParts, label: string) => (
    deleteMode ? (
      <button
        onClick={() => setHiddenParts(p => ({ ...p, [key]: true }))}
        title={`حذف: ${label}`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5",
          borderRadius: 6, padding: "2px 6px", fontSize: 10, fontWeight: 700,
          cursor: "pointer", fontFamily: "Cairo, Arial, sans-serif", marginRight: 4,
          whiteSpace: "nowrap",
        }}>
        <X style={{ width: 10, height: 10 }} /> حذف
      </button>
    ) : null
  );

  /* ─── Auto-save ─────────────────────────────────────── */
  const saveDraft = useCallback(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        details, items: stripItemImages(items), logoUrl, stampUrl, discountPct, taxPct,
      }));
    } catch {}
  }, [details, items, logoUrl, stampUrl, discountPct, taxPct]);
  useEffect(() => { saveDraft(); }, [saveDraft]);

  const clearDraft = () => {
    sessionStorage.removeItem(DRAFT_KEY);
    setDetails(mkDefault()); setItems([mkItem()]);
    setLogoUrl(""); setStampUrl("/stamp-qadri.png");
    setDiscountPct(0); setTaxPct(0);
    setCurrentRecordId(null);
  };

  const handleConvertToInvoice = async () => {
    const validItems = items.filter(it => it.name.trim());
    if (validItems.length === 0) {
      toast.error('أضف عناصر أولاً قبل التحويل');
      return;
    }
    setConvertingToInvoice(true);
    try {
      const subtotal = validItems.reduce((s, it) => s + Number(it.quantity) * Number(it.price), 0);
      const discountAmt = subtotal * (discountPct / 100);
      const invoiceItems: InvoiceItem[] = validItems.map(it => ({
        description: it.name.trim() + (it.description?.trim() ? ` — ${it.description.trim()}` : ''),
        quantity: Number(it.quantity),
        unitPrice: Number(it.price),
      }));
      let notes = details.notes || '';
      if (taxPct > 0) {
        const afterDiscount = subtotal - discountAmt;
        const taxAmt = afterDiscount * (taxPct / 100);
        const fmt = (n: number) => n.toLocaleString('ar', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        notes = `${notes ? notes + '\n' : ''}ضريبة ${taxPct.toFixed(0)}%: ${fmt(taxAmt)} د.أ`;
      }
      const result = await createInvoice({
        customerName: details.customerName || 'عميل',
        date: details.date || new Date().toISOString().slice(0, 10),
        items: invoiceItems,
        notes: notes.trim(),
        discount: discountAmt,
        status: 'receivable',
      });
      if (result && typeof result === 'object' && 'number' in result) {
        toast.success(`✅ تم إنشاء الفاتورة رقم ${(result as { id: string; number: string }).number} بنجاح`);
      } else {
        toast.error('فشل إنشاء الفاتورة');
      }
    } catch (e: any) {
      toast.error('خطأ: ' + e.message);
    } finally {
      setConvertingToInvoice(false);
    }
  };

  /* ─── Save to records ────────────────────────────────── */
  const [saving, setSaving] = useState(false);

  /** Upload a base64 data-URL to the server and return the /api/images/… URL.
   *  If the value is already a server URL (or empty) it is returned as-is. */
  const ensureServerUrl = async (src: string): Promise<string> => {
    if (!src || !src.startsWith("data:")) return src;
    try {
      return await uploadImageBase64(src);
    } catch {
      // If upload fails, keep the original data URL so the image isn't lost
      // from the UI. The quotation will still be saved with the embedded image.
      return src;
    }
  };

  const handleSave = async () => {
    if (saving) return;
    const token = loadSavedToken();

    if (token) {
      // Admin is authenticated — save to the server so all devices stay in sync
      setSaving(true);
      try {
        // Upload any base64 images to the server first so they persist across devices
        const [resolvedLogo, resolvedStamp, resolvedItems] = await Promise.all([
          ensureServerUrl(logoUrl),
          ensureServerUrl(stampUrl),
          Promise.all(
            items.map(async (item) => ({
              ...item,
              imageUrl: item.imageUrl ? await ensureServerUrl(item.imageUrl) : undefined,
            }))
          ),
        ]);

        const payload = {
          details,
          items: resolvedItems,
          logoUrl: resolvedLogo,
          stampUrl: resolvedStamp,
          discountPct,
          taxPct,
        };

        // Update local state to reflect the uploaded URLs so the UI stays consistent
        if (resolvedLogo !== logoUrl) setLogoUrl(resolvedLogo);
        if (resolvedStamp !== stampUrl) setStampUrl(resolvedStamp);
        setItems(resolvedItems);

        const savedId = await upsertQadriOldQuotation(
          payload as unknown as Record<string, unknown>,
          currentRecordId ?? undefined
        );
        if (savedId) {
          if (!currentRecordId) setCurrentRecordId(savedId);
          toast.success("✅ تم الحفظ في السجل");
          return;
        }
        toast.error("فشل الحفظ على الخادم — تحقق من الاتصال بالإنترنت");
      } catch (e: any) {
        toast.error("فشل الحفظ: " + (e?.message || "خطأ غير معروف"));
      } finally {
        setSaving(false);
      }
      return;
    }

    // Fallback for unauthenticated use: localStorage
    try {
      const id = persistQadriRecord({ details, items, logoUrl, stampUrl, discountPct, taxPct }, currentRecordId ?? undefined);
      if (!currentRecordId) setCurrentRecordId(id);
      toast.success("✅ تم الحفظ في السجل");
    } catch (e: any) {
      if (e?.name === "QuotaExceededError") {
        toast.error("فشل الحفظ: المساحة المحلية ممتلئة. احذف بعض الصور الكبيرة من البنود أو احذف عروضاً قديمة من السجل ثم أعد المحاولة.");
      } else {
        toast.error("فشل الحفظ: " + (e?.message || "خطأ غير معروف"));
      }
    }
  };

  /* ─── Totals ─────────────────────────────────────────── */
  const subtotal = items.reduce((s, i) => s + (i.total || 0), 0);
  const discountAmt = subtotal * (discountPct / 100);
  const taxAmt = (subtotal - discountAmt) * (taxPct / 100);
  const grandTotal = subtotal - discountAmt + taxAmt;

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
  /* Resize + compress before stashing in localStorage — raw phone-camera photos
     are multiple MB each and blow through the ~5–10MB per-origin quota after a
     few items, which makes localStorage.setItem throw and silently kills the
     save (see persistQadriRecord). */
  const toBase64 = (file: File, cb: (s: string) => void) => {
    const isPng = file.type === "image/png";
    const MAX = isPng ? 700 : 500;
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback: raw base64 if canvas isn't available for some reason.
        const r = new FileReader(); r.onloadend = () => cb(r.result as string); r.readAsDataURL(file);
        return;
      }
      if (!isPng) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, width, height); }
      ctx.drawImage(img, 0, 0, width, height);
      cb(isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      const r = new FileReader(); r.onloadend = () => cb(r.result as string); r.readAsDataURL(file);
    };
    img.src = objUrl;
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
  const effectiveLogo = logoUrl || siteData?.logo?.customUrl || "/logo-alkadri.jpg";

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

      /* 3. Strip class names to avoid oklch errors (use getAttribute for SVG safety) */
      Array.from(el.querySelectorAll("[class]")).forEach(n => {
        const cls = n.getAttribute("class") ?? "";
        savedClasses.push({ node: n, cls });
        n.removeAttribute("class");
      });

      await new Promise(r => setTimeout(r, 60));

      /* 4. Capture the full document at its natural size */
      const docW = el.scrollWidth;
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, allowTaint: true,
        backgroundColor: "#ffffff", logging: false,
        scrollX: 0, scrollY: 0,
        width: docW,
        height: el.scrollHeight,
      });

      /* 5. Build + capture running header for continuation pages */
      let runHeaderCanvas: HTMLCanvasElement | undefined;
      {
        const logoSrc = effectiveLogo
          ? `<img src="${effectiveLogo}" alt="" style="width:55px;height:45px;object-fit:contain;flex-shrink:0;" />`
          : "";
        const hdrWrapper = document.createElement("div");
        hdrWrapper.style.cssText = `position:absolute;left:-9999px;top:0;width:${docW}px;background:#fff;`;
        hdrWrapper.innerHTML = `
          <div style="direction:ltr;display:flex;align-items:center;justify-content:space-between;
            padding:10px 20px;border-bottom:2px solid #e5e7eb;background:#fff;
            font-family:Cairo,Arial,sans-serif;">
            <div style="font-size:12px;font-weight:600;color:#374151;">${details.companyNameEn}</div>
            <div style="display:flex;align-items:center;gap:12px;direction:rtl;">
              <div style="text-align:right;">
                <div style="font-size:14px;font-weight:700;color:#1e293b;">${details.companyNameAr}</div>
                <div style="font-size:10px;color:#64748b;margin-top:2px;">${details.companyLocationAr}</div>
              </div>
              ${logoSrc}
            </div>
          </div>`;
        document.body.appendChild(hdrWrapper);
        try {
          await Promise.all(
            Array.from(hdrWrapper.querySelectorAll("img")).map(img =>
              img.complete && img.naturalWidth > 0
                ? Promise.resolve()
                : new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); setTimeout(res, 400); })
            )
          );
          await new Promise(r => setTimeout(r, 40));
          runHeaderCanvas = await html2canvas(hdrWrapper.firstElementChild as HTMLElement, {
            scale: 2, useCORS: true, allowTaint: true,
            backgroundColor: "#ffffff", logging: false,
            scrollX: 0, scrollY: 0,
            width: docW,
          });
        } finally {
          document.body.removeChild(hdrWrapper);
        }
      }

      /* Multi-page: smart slice at row boundaries → proper A4 pages */
      const name = details.customerName.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, "_").trim();
      const fileName = name ? `عرض سعر_${name}_${details.date}.pdf` : `عرض سعر_${details.date}.pdf`;
      await sliceCanvasToPdf(canvas, el, fileName, docW, runHeaderCanvas);
      toast.success("✅ تم تنزيل PDF");
    } catch (e: any) {
      toast.error("فشل إنشاء PDF: " + e.message);
    } finally {
      hiddenEls.forEach(({ node, was }) => (node.style.display = was));
      replacedInputs.forEach(({ input, div }) => {
        div.parentNode?.removeChild(div);
        input.style.display = "";
      });
      savedClasses.forEach(({ node, cls }) => cls ? node.setAttribute("class", cls) : node.removeAttribute("class"));
      window.scrollTo({ top: savedScrollY, behavior: "instant" as ScrollBehavior });
      setIsPdf(false);
    }
  };

  /* ─── Plants ────────────────────────────────────────────── */
  const allPlants = (siteData?.sections ?? []).flatMap(s =>
    s.photos.map(p => ({ id: p.id, nameAr: p.nameAr, descriptionAr: p.descriptionAr ?? "", sectionName: s.nameAr, image: p.image }))
  );
  const allFilteredPlants = plantSearch.trim()
    ? allPlants.filter(p => p.nameAr.includes(plantSearch) || p.sectionName.includes(plantSearch))
    : allPlants;

  const addItemFromPlant = (plant: { nameAr: string; descriptionAr: string; sectionName: string; image: string }) => {
    setItems(prev => {
      const clean = prev.filter(i => i.name.trim());
      return [...clean, {
        id: Date.now().toString() + Math.random(),
        name: plant.nameAr,
        description: "",
        category: plant.sectionName,
        quantity: 1,
        price: 0,
        total: 0,
        imageUrl: plant.image || undefined,
      }];
    });
    setShowPlantPicker(false);
    setPlantSearch("");
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
          {/* حذف الأجزاء */}
          <button
            onClick={() => setDeleteMode(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: 8,
              background: deleteMode ? "#fee2e2" : "#f8fafc",
              color: deleteMode ? "#dc2626" : "#475569",
              border: deleteMode ? "1px solid #fca5a5" : "1px solid #e2e8f0",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              fontFamily: "Cairo, Arial, sans-serif",
            }}>
            <Scissors style={{ width: 14, height: 14 }} />
            {deleteMode ? "إيقاف الحذف" : "حذف الأجزاء"}
          </button>

          {/* استعادة المحذوف */}
          {Object.values(hiddenParts).some(Boolean) && (
            <button
              onClick={() => setHiddenParts({ colDescription: false, colCategory: false, colImage: false, colIndex: false, colPrice: false, colTotal: false, infoDate: false, infoQuotationNumber: false, infoCustomer: false, grandTotal: false, subtotalRows: false, notes: false, closing: false, stamp: false, footer: false })}
              title="استعادة كل الأجزاء المحذوفة"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "6px 10px", borderRadius: 8,
                background: "#f0fdf4", color: "#16a34a",
                border: "1px solid #bbf7d0",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
                fontFamily: "Cairo, Arial, sans-serif",
              }}>
              <RefreshCw style={{ width: 13, height: 13 }} />
              استعادة الكل
            </button>
          )}

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

          {/* Convert to Invoice */}
          <button
            onClick={handleConvertToInvoice}
            disabled={convertingToInvoice}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: 8,
              background: "#fffbeb",
              color: "#92400e",
              border: "1px solid #fcd34d",
              cursor: convertingToInvoice ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600,
              fontFamily: "Cairo, Arial, sans-serif",
              opacity: convertingToInvoice ? 0.6 : 1,
            }}>
            {convertingToInvoice
              ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
              : <FilePlus style={{ width: 14, height: 14 }} />}
            تحويل إلى فاتورة
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

          <div style={{ position: "relative" }}>
            <button
              onClick={() => setShowPlantPicker(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "6px 12px", borderRadius: 8,
                background: showPlantPicker ? "#dcfce7" : "#f0fdf4",
                color: "#16a34a",
                border: "1px solid #bbf7d0", cursor: "pointer",
                fontSize: 13, fontWeight: 600, fontFamily: "Cairo, Arial, sans-serif",
              }}>
              🌿 من النباتات
            </button>
            {showPlantPicker && (
              <div style={{
                position: "absolute", top: "110%", right: 0, zIndex: 200,
                background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
                boxShadow: "0 8px 30px rgba(0,0,0,0.14)",
                width: 340, maxHeight: 420, display: "flex", flexDirection: "column",
              }}>
                {/* Search bar */}
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
                  <div style={{ position: "relative" }}>
                    <input
                      autoFocus
                      placeholder="ابحث عن نبات لإضافته..."
                      value={plantSearch}
                      onChange={e => setPlantSearch(e.target.value)}
                      style={{
                        width: "100%", border: "1px solid #e2e8f0", borderRadius: 8,
                        padding: "7px 12px 7px 34px", fontSize: 13, boxSizing: "border-box",
                        fontFamily: "Cairo, Arial, sans-serif", outline: "none", background: "#f8fafc", direction: "rtl",
                      }}
                    />
                    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }}>🔍</span>
                  </div>
                </div>
                {/* List */}
                <div style={{ overflowY: "auto", flex: 1 }}>
                  {allFilteredPlants.length === 0 && (
                    <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12, fontFamily: "Cairo, Arial, sans-serif" }}>لا توجد نتائج</div>
                  )}
                  {allFilteredPlants.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addItemFromPlant(p)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        width: "100%", textAlign: "right", direction: "rtl",
                        padding: "8px 12px", background: "none", border: "none",
                        borderBottom: "1px solid #f8fafc",
                        cursor: "pointer",
                      }}
                      onMouseOver={e => (e.currentTarget.style.background = "#f0fdf4")}
                      onMouseOut={e => (e.currentTarget.style.background = "none")}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", fontFamily: "Cairo, Arial, sans-serif" }}>{p.nameAr}</div>
                        <div style={{ fontSize: 11, color: "#64748b", fontFamily: "Cairo, Arial, sans-serif", marginTop: 1 }}>{p.sectionName}</div>
                      </div>
                      {p.image && (
                        <img src={p.image} alt={p.nameAr} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 7, flexShrink: 0 }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button onClick={handleWhatsApp}
            style={{ padding: 6, borderRadius: 8, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", cursor: "pointer" }}>
            <MessageCircle style={{ width: 14, height: 14 }} />
          </button>

          <button onClick={handleSave} disabled={saving}
            title={currentRecordId ? "تحديث السجل" : "حفظ في السجل"}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "6px 12px", borderRadius: 8,
              background: currentRecordId ? "#eff6ff" : "#f0fdf4",
              color: currentRecordId ? "#2563eb" : "#059669",
              border: currentRecordId ? "1px solid #bfdbfe" : "1px solid #6ee7b7",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600,
              fontFamily: "Cairo, Arial, sans-serif",
              opacity: saving ? 0.6 : 1,
            }}>
            {saving
              ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
              : <Save style={{ width: 14, height: 14 }} />}
            {saving ? "جاري الحفظ..." : currentRecordId ? "تحديث" : "حفظ"}
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

      {/* ── Main area: side-by-side smart panel + document ── */}
      <div style={{ padding: "16px", display: "flex", gap: 16, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" }}>

        {/* ── Smart Analysis Side Panel ─────────────────── */}
        {showSmart && (
          <div style={{
            width: 320, flexShrink: 0,
            background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12,
            padding: "16px", position: "sticky", top: 72,
            alignSelf: "flex-start",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#92400e", display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles style={{ width: 15, height: 15 }} /> التحليل الذكي
              </div>
              <button onClick={() => setShowSmart(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#92400e" }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#78350f", marginBottom: 8 }}>
              كل سطر: <strong>الكمية / الاسم / الوصف / القسم / السعر</strong>
            </div>
            <div style={{ fontSize: 11, color: "#92400e", marginBottom: 10, opacity: 0.8 }}>
              مثال: 3 / نخيل تمري / صحراوي / نخيل / 150
            </div>
            <textarea
              value={smartText}
              onChange={e => setSmartText(e.target.value)}
              placeholder={"3 / نخيل تمري / صحراوي / نخيل / 150\n5 / زيتون / شجرة محلية / زيتون / 80\n10 / ورد جوري / / زهور / 12"}
              rows={8}
              style={{
                width: "100%", borderRadius: 8, border: "1px solid #fcd34d",
                padding: "10px 12px", fontSize: 13, fontFamily: "Cairo, Arial, sans-serif",
                background: "#fff", color: "#1e293b", direction: "rtl",
                resize: "vertical", boxSizing: "border-box",
              }}
            />
            <button onClick={handleSmartParse}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8, marginTop: 10, width: "100%",
                justifyContent: "center",
                background: "#f59e0b", color: "#fff",
                border: "none", cursor: "pointer",
                fontWeight: 700, fontSize: 13, fontFamily: "Cairo, Arial, sans-serif",
              }}>
              <Sparkles style={{ width: 14, height: 14 }} />
              تحليل وتعبئة الجدول
            </button>
          </div>
        )}

      {/* ── Document ──────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "center" }}>
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
          {/* Use direction:ltr so we control visual order directly:
              Logo = far right, Arabic = center, English = far left */}
          <div style={{ padding: "20px 24px 16px", borderBottom: "2px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, direction: "ltr" }}>

            {/* English — far left */}
            <div style={{ textAlign: "left", minWidth: 200, flexShrink: 0 }}>
              <input
                value={details.companyNameEn}
                onChange={e => setDetails(p => ({ ...p, companyNameEn: e.target.value }))}
                style={{ ...F, fontSize: 14, fontWeight: 700, color: "#1e293b", textAlign: "left", direction: "ltr" }}
              />
              <input
                value={details.companyLocationEn}
                onChange={e => setDetails(p => ({ ...p, companyLocationEn: e.target.value }))}
                style={{ ...F, fontSize: 12, color: "#64748b", textAlign: "left", marginTop: 4, direction: "ltr" }}
              />
            </div>

            {/* Arabic company name — center */}
            <div style={{ flex: 1, textAlign: "center", direction: "rtl" }}>
              <input
                value={details.companyNameAr}
                onChange={e => setDetails(p => ({ ...p, companyNameAr: e.target.value }))}
                style={{ ...F, fontSize: 16, fontWeight: 700, color: "#1e293b", textAlign: "center" }}
              />
              <input
                value={details.companyLocationAr}
                onChange={e => setDetails(p => ({ ...p, companyLocationAr: e.target.value }))}
                style={{ ...F, fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 4 }}
              />
            </div>

            {/* Logo box — far right */}
            <label style={{ cursor: "pointer", position: "relative", flexShrink: 0 }} title="انقر لتغيير الشعار">
              <div style={{
                width: 90, height: 80, border: "1px solid #d1d5db", borderRadius: 8,
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

          {/* ── Info row (date / number / customer) ────── */}
          {(!hiddenParts.infoDate || !hiddenParts.infoQuotationNumber || !hiddenParts.infoCustomer) && (
            <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", padding: "14px 0" }}>
              {!hiddenParts.infoDate && (
                <div style={{ flex: 1, borderLeft: "1px solid #d1d5db", padding: "0 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    {hidePartBtn("infoDate", "خانة التاريخ")}التاريخ
                  </div>
                  <div style={{ height: 1, background: "#d1d5db", margin: "0 0 6px" }} />
                  <input
                    type="date"
                    value={details.date}
                    onChange={e => setDetails(p => ({ ...p, date: e.target.value }))}
                    style={{ ...F, fontSize: 13, fontWeight: 600, color: "#1e293b", textAlign: "center" }}
                  />
                </div>
              )}
              {!hiddenParts.infoQuotationNumber && (
                <div style={{ flex: 1, borderLeft: "1px solid #d1d5db", padding: "0 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    {hidePartBtn("infoQuotationNumber", "خانة رقم عرض السعر")}عرض سعر رقم
                  </div>
                  <div style={{ height: 1, background: "#d1d5db", margin: "0 0 6px" }} />
                  <input
                    value={details.quotationNumber}
                    onChange={e => setDetails(p => ({ ...p, quotationNumber: e.target.value }))}
                    style={{ ...F, fontSize: 13, fontWeight: 700, color: "#1e293b", textAlign: "center" }}
                  />
                </div>
              )}
              {!hiddenParts.infoCustomer && (
                <div style={{ flex: 1, padding: "0 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    {hidePartBtn("infoCustomer", "خانة العميل")}العميل
                  </div>
                  <div style={{ height: 1, background: "#d1d5db", margin: "0 0 6px" }} />
                  <input
                    value={details.customerName}
                    onChange={e => setDetails(p => ({ ...p, customerName: e.target.value }))}
                    placeholder="اسم العميل"
                    style={{ ...F, fontSize: 13, fontWeight: 600, color: "#1e293b", textAlign: "center" }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Table ──────────────────────────────────── */}
          <div style={{ padding: "16px 20px 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, border: "1px solid #111827" }}>
              <thead>
                <tr style={{ background: "#1a2744", color: "#ffffff" }}>
                  {!hiddenParts.colIndex && (
                    <th style={{ padding: "10px 6px", textAlign: "center", width: 32, fontFamily: "Cairo, Arial, sans-serif", border: "1px solid #111827" }}>
                      {hidePartBtn("colIndex", "عمود الرقم")}#
                    </th>
                  )}
                  <th style={{ padding: "10px 8px", textAlign: "right", fontFamily: "Cairo, Arial, sans-serif", border: "1px solid #111827" }}>الاسم</th>
                  {!hiddenParts.colDescription && (
                    <th style={{ padding: "10px 8px", textAlign: "right", fontFamily: "Cairo, Arial, sans-serif", border: "1px solid #111827" }}>
                      {hidePartBtn("colDescription", "عمود الوصف")}الوصف
                    </th>
                  )}
                  {!hiddenParts.colCategory && (
                    <th style={{ padding: "10px 8px", textAlign: "right", fontFamily: "Cairo, Arial, sans-serif", border: "1px solid #111827" }}>
                      {hidePartBtn("colCategory", "عمود القسم")}القسم
                    </th>
                  )}
                  <th style={{ padding: "10px 6px", textAlign: "center", width: 60, fontFamily: "Cairo, Arial, sans-serif", border: "1px solid #111827" }}>الكمية</th>
                  {!hiddenParts.colPrice && (
                    <th style={{ padding: "10px 6px", textAlign: "center", width: 72, fontFamily: "Cairo, Arial, sans-serif", border: "1px solid #111827" }}>
                      {hidePartBtn("colPrice", "عمود السعر")}السعر
                    </th>
                  )}
                  {!hiddenParts.colTotal && (
                    <th style={{ padding: "10px 6px", textAlign: "center", width: 84, fontFamily: "Cairo, Arial, sans-serif", border: "1px solid #111827" }}>
                      {hidePartBtn("colTotal", "عمود الإجمالي")}الإجمالي
                    </th>
                  )}
                  {!hiddenParts.colImage && (
                    <th style={{ padding: "10px 6px", textAlign: "center", fontFamily: "Cairo, Arial, sans-serif", border: "1px solid #111827" }}>
                      {hidePartBtn("colImage", "عمود الصورة")}الصورة
                    </th>
                  )}
                  <th className="pdf-hide" style={{ width: 24 }} />
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} style={{ background: i % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                    {/* # */}
                    {!hiddenParts.colIndex && (
                      <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#111827", fontSize: 13, verticalAlign: "middle", border: "1px solid #111827" }}>
                        {i + 1}
                      </td>
                    )}
                    {/* الاسم */}
                    <td style={{ padding: "8px", verticalAlign: "middle", border: "1px solid #111827" }}>
                      <input
                        value={item.name}
                        onChange={e => updateItem(item.id, "name", e.target.value)}
                        placeholder="اسم النبتة"
                        style={{ ...F, fontSize: 12, fontWeight: 600, color: "#111827", textAlign: "right" }}
                      />
                    </td>
                    {/* الوصف */}
                    {!hiddenParts.colDescription && (
                      <td style={{ padding: "8px", verticalAlign: "middle", border: "1px solid #111827" }}>
                        <input
                          value={item.description}
                          onChange={e => updateItem(item.id, "description", e.target.value)}
                          placeholder="وصف"
                          style={{ ...F, fontSize: 11, color: "#111827", textAlign: "right" }}
                        />
                      </td>
                    )}
                    {/* القسم */}
                    {!hiddenParts.colCategory && (
                      <td style={{ padding: "8px", verticalAlign: "middle", border: "1px solid #111827" }}>
                        <input
                          value={item.category}
                          onChange={e => updateItem(item.id, "category", e.target.value)}
                          placeholder="قسم"
                          style={{ ...F, fontSize: 11, color: "#111827", textAlign: "center" }}
                        />
                      </td>
                    )}
                    {/* الكمية */}
                    <td style={{ padding: "6px", verticalAlign: "middle", border: "1px solid #111827" }}>
                      <input
                        type="number" min={1}
                        value={item.quantity}
                        onChange={e => updateItem(item.id, "quantity", parseFloat(e.target.value) || 1)}
                        style={{ ...F, fontSize: 12, fontWeight: 700, color: "#111827", textAlign: "center" }}
                      />
                    </td>
                    {/* السعر */}
                    {!hiddenParts.colPrice && (
                      <td style={{ padding: "6px", verticalAlign: "middle", border: "1px solid #111827" }}>
                        <input
                          type="number" min={0} step={0.01}
                          value={item.price || ""}
                          onChange={e => updateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          style={{ ...F, fontSize: 12, fontWeight: 700, color: "#111827", textAlign: "center" }}
                        />
                      </td>
                    )}
                    {/* الإجمالي */}
                    {!hiddenParts.colTotal && (
                      <td style={{ padding: "6px", textAlign: "center", fontWeight: 700, fontSize: 12, color: "#111827", verticalAlign: "middle", fontFamily: "Cairo, Arial, sans-serif", border: "1px solid #111827" }}>
                        {fmt(item.total)}
                      </td>
                    )}
                    {/* الصورة */}
                    {!hiddenParts.colImage && (
                      <td style={{ padding: "6px", textAlign: "center", verticalAlign: "middle", border: "1px solid #111827" }}>
                        <div
                          style={{ cursor: "pointer", display: "block" }}
                          onClick={() => { const inp = document.getElementById(`img-input-${item.id}`) as HTMLInputElement; inp?.click(); }}
                        >
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" style={{ width: "100%", maxWidth: 300, height: 96, objectFit: "cover", borderRadius: 6, border: "1px solid #d1d5db", margin: "0 auto", display: "block" }} />
                          ) : (
                            <div style={{
                              width: "100%", height: 96, border: "1px dashed #d1d5db", borderRadius: 6,
                              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                              background: "#f9fafb", margin: "0 auto", gap: 3,
                            }}>
                              <Upload className="pdf-hide" style={{ width: 14, height: 14, color: "#9ca3af" }} />
                              <span className="pdf-hide" style={{ fontSize: 10, color: "#9ca3af" }}>صورة</span>
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
                    )}
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

          {/* ── Totals ─────────────────────────────────── */}
          {!hiddenParts.grandTotal && (
            <div style={{ margin: "8px 20px 0" }}>
              {!hiddenParts.subtotalRows && (discountPct > 0 || taxPct > 0) && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 16px", fontSize: 12, color: "#6b7280", fontFamily: "Cairo, Arial, sans-serif" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {hidePartBtn("subtotalRows", "صفوف الفرعي/الخصم/الضريبة")}
                    المجموع الفرعي
                  </span>
                  <span style={{ fontWeight: 600 }}>{fmt(subtotal)} د.أ</span>
                </div>
              )}
              <div className="pdf-hide" style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 16px", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#6b7280", fontFamily: "Cairo, Arial, sans-serif" }}>خصم %</span>
                <input
                  type="number" min={0} max={100} step={0.5}
                  value={discountPct || ""}
                  onChange={e => setDiscountPct(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  style={{ width: 65, border: "1px solid #d1d5db", borderRadius: 6, padding: "3px 8px", fontSize: 12, textAlign: "center", fontFamily: "Cairo, Arial, sans-serif" }}
                />
                <span style={{ fontSize: 12, color: "#6b7280", fontFamily: "Cairo, Arial, sans-serif", marginRight: 8 }}>ضريبة %</span>
                <input
                  type="number" min={0} max={100} step={0.5}
                  value={taxPct || ""}
                  onChange={e => setTaxPct(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  style={{ width: 65, border: "1px solid #d1d5db", borderRadius: 6, padding: "3px 8px", fontSize: 12, textAlign: "center", fontFamily: "Cairo, Arial, sans-serif" }}
                />
              </div>
              {!hiddenParts.subtotalRows && discountPct > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 16px", fontSize: 12, color: "#16a34a", fontFamily: "Cairo, Arial, sans-serif" }}>
                  <span>خصم {discountPct}%</span>
                  <span style={{ fontWeight: 700 }}>− {fmt(discountAmt)} د.أ</span>
                </div>
              )}
              {!hiddenParts.subtotalRows && taxPct > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 16px", fontSize: 12, color: "#ea580c", fontFamily: "Cairo, Arial, sans-serif" }}>
                  <span>ضريبة {taxPct}%</span>
                  <span style={{ fontWeight: 700 }}>+ {fmt(taxAmt)} د.أ</span>
                </div>
              )}
              <div style={{
                background: "#1a2744", color: "#fff",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 16px", borderRadius: 4, marginTop: 4,
              }}>
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "Cairo, Arial, sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                  {hidePartBtn("grandTotal", "قسم المجموع الكلي")}
                  المجموع الكلي
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: "#60a5fa", fontFamily: "Cairo, Arial, sans-serif" }}>{fmt(grandTotal)}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "Cairo, Arial, sans-serif" }}>د.أ</span>
                </div>
              </div>
            </div>
          )}

          {/* ── ملاحظات ── */}
          {!hiddenParts.notes && (
            <div
              className={details.notes.trim() ? "" : "pdf-hide"}
              style={{ margin: "16px 24px 0", direction: "rtl" }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", marginBottom: 6, fontFamily: "Cairo, Arial, sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
                {hidePartBtn("notes", "قسم الملاحظات")}
                ملاحظات:
              </div>
              <textarea
                value={details.notes}
                onChange={e => setDetails(p => ({ ...p, notes: e.target.value }))}
                placeholder="ملاحظات إضافية..."
                rows={3}
                style={{
                  ...F, fontSize: 12, color: "#374151", textAlign: "right",
                  resize: "none", border: "1px dashed #d1d5db", borderRadius: 6,
                  padding: "6px 10px", boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {/* ── نص الإغلاق ── */}
          {!hiddenParts.closing && (
            <div style={{ margin: "16px 24px 4px", textAlign: "center", position: "relative" }}>
              {deleteMode && (
                <div style={{ position: "absolute", top: -4, right: 0 }}>
                  {hidePartBtn("closing", "نص الإغلاق")}
                </div>
              )}
              <input
                value={details.closingText}
                onChange={e => setDetails(p => ({ ...p, closingText: e.target.value }))}
                style={{ ...F, fontSize: 17, color: "#374151", textAlign: "center" }}
              />
            </div>
          )}

          {/* ── التوقيع والختم ── */}
          {!hiddenParts.stamp && (
            <div style={{ margin: "4px 24px 8px", display: "flex", justifyContent: "flex-end" }}>
              <div style={{ textAlign: "right", minWidth: 140 }}>
                <div style={{ marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  {deleteMode && hidePartBtn("stamp", "قسم التوقيع والختم")}
                  <input
                    value={details.signerTitle}
                    onChange={e => setDetails(p => ({ ...p, signerTitle: e.target.value }))}
                    style={{ ...F, fontSize: 13, fontWeight: 700, color: "#1e293b", textAlign: "center" }}
                  />
                </div>
                {stampUrl ? (
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img src={stampUrl} alt="stamp" style={{ width: 140, height: 120, objectFit: "contain", display: "block", margin: "0 auto" }} />
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
                      width: 140, height: 120, border: "2px dashed #d1d5db", borderRadius: 8,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      background: "#f9fafb", gap: 4, margin: "0 auto",
                    }}>
                      <Upload style={{ width: 16, height: 16, color: "#9ca3af" }} />
                      <span style={{ fontSize: 10, color: "#9ca3af", textAlign: "center" }}>ختم / توقيع</span>
                    </div>
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) toBase64(f, setStampUrl); }} />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* ── Footer ─────────────────────────────────── */}
          {!hiddenParts.footer && (
            <div style={{
              marginTop: 20,
              borderTop: "2px solid #1a3a8a",
              background: "#f8fafc",
              padding: "16px 24px",
              display: "flex", justifyContent: "center", alignItems: "center",
              flexDirection: "column", gap: 6,
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1e293b", fontFamily: "Cairo, Arial, sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                {deleteMode && hidePartBtn("footer", "الفوتر (معلومات الشركة)")}
                <input
                  value={details.footerCompany}
                  onChange={e => setDetails(p => ({ ...p, footerCompany: e.target.value }))}
                  style={{ ...F, textAlign: "center", fontWeight: 800, fontSize: 18 }}
                />
              </div>
              <div style={{ display: "flex", gap: 28, fontSize: 12, color: "#475569", flexWrap: "wrap", justifyContent: "center" }}>
                {details.phone && <span>📞 {details.phone}</span>}
                {details.email && <span>✉️ {details.email}</span>}
                {details.website && <span>🌐 {details.website}</span>}
              </div>
            </div>
          )}

        </div>
      </div>{/* end document wrapper */}

      </div>{/* end side-by-side flex */}

    </div>
  );
}
