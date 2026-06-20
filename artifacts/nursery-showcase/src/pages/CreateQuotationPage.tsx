import { useState, useEffect, useCallback, useRef } from "react";
import { navigate } from "@/App";
import {
  Plus, FileText, Save, Wand2, Trash2, CheckCircle2,
  Phone, Mail, Globe, RotateCcw, MessageCircle, ArrowRight,
  Leaf, ChevronDown, Loader2, Search
} from "lucide-react";
import { useQuotation } from "@/hooks/use-quotations-v2";
import { useApp } from "@/lib/context";
import { toast } from "sonner";
import { format } from "date-fns";
import stampImage from "@assets/لقطة_شاشة_2026-03-08_023328_1773047188235.png";
import {
  type PdfTemplate,
  downloadModernPdf,
  downloadAndalusPdf,
} from "@/lib/quotationPdfTemplates";

type Item = {
  id: string; name: string; description: string; category: string;
  quantity: number; unit: string; price: number; total: number; imageUrl?: string;
};

type Headers = {
  index: string; image: string; name: string; description: string;
  category: string; quantity: string; price: string; total: string;
};

type Details = {
  quotationNumber: string; customerName: string;
  companyNameAr: string; companyLocationAr: string;
  companyNameEn: string; companyLocationEn: string;
  date: string; notes: string; phone: string; email: string; website: string;
  closingText: string; signerTitle: string; footerCompany: string;
};

const DRAFT_KEY = "aq_draft_quotation";

const defaultDetails = (): Details => ({
  quotationNumber: `${format(new Date(), "yyyyMMdd")}`,
  customerName: "",
  companyNameAr: "مؤسسة ومشاتل القادري الزراعية",
  companyLocationAr: "جرش – الرشايدة",
  companyNameEn: "Al-Qadri Agricultural Establishment",
  companyLocationEn: "Jerash - Al-Rashaidah",
  date: format(new Date(), "yyyy-MM-dd"),
  notes: "",
  phone: "00962777772211",
  email: "tamerqadri@gmail.com",
  website: "www.alkadri-plants.com",
  closingText: "واقبلوا فائق الاحترام....",
  signerTitle: "المدير العام/ ثامر احمد القادري",
  footerCompany: "مؤسسة ومشاتل القادري الزراعية",
});

const defaultItems = (): Item[] => [
  { id: "1", name: "", description: "", category: "", quantity: 1, unit: "وحدة", price: 0, total: 0 }
];

const defaultHeaders = (): Headers => ({
  index: "#", image: "الصورة", name: "الاسم", description: "الوصف",
  category: "القسم", quantity: "الكمية", price: "السعر", total: "الإجمالي",
});

/* ─── URL param helper ─────────────────────────────────── */
function getEditId(): number | null {
  const p = new URLSearchParams(window.location.search).get("edit");
  const n = p ? Number(p) : NaN;
  return isNaN(n) || n <= 0 ? null : n;
}

export default function CreateQuotationPage() {
  const editId = getEditId();
  const isEditMode = editId !== null;

  const { siteData } = useApp();
  const { data: existingQuotation, isLoading: loadingEdit } = useQuotation(editId ?? 0);
  const [isSaving, setIsSaving] = useState(false);

  /* ─── Draft loading ──────────────────────────────────── */
  const loadDraft = () => {
    if (isEditMode) return null;
    try { const raw = sessionStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  };
  const draft = loadDraft();

  const [items, setItems] = useState<Item[]>(draft?.items ?? defaultItems());
  const [details, setDetails] = useState<Details>(draft?.details ?? defaultDetails());
  const [headers, setHeaders] = useState<Headers>(draft?.headers ?? defaultHeaders());
  const [logoBase64, setLogoBase64] = useState<string | null>(draft?.logoBase64 ?? null);
  const [pasteText, setPasteText] = useState("");
  const [discountValue, setDiscountValue] = useState<number>(draft?.discountValue ?? 0);
  const [taxRate, setTaxRate] = useState<number>(draft?.taxRate ?? 0);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplate>("modern");
  const [pdfMenuOpen, setPdfMenuOpen] = useState(false);

  /* ─── Plant picker state ─────────────────────────────── */
  const [pickerSearch, setPickerSearch] = useState<string>("");
  const tableRef = useRef<HTMLDivElement>(null);

  const sections = siteData?.sections ?? [];

  /* All plants across all sections, with their section name */
  const allPlants = sections.flatMap(s =>
    (s.photos ?? []).map((p: any) => ({ ...p, sectionNameAr: s.nameAr, sectionId: s.id }))
  );
  const filteredPlants = pickerSearch.trim()
    ? allPlants.filter(p =>
        p.nameAr?.includes(pickerSearch) ||
        p.nameEn?.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        p.sectionNameAr?.includes(pickerSearch)
      )
    : allPlants;

  /* ─── Load existing quotation in edit mode ───────────── */
  const editLoadedRef = useRef(false);
  useEffect(() => {
    if (isEditMode && existingQuotation && !editLoadedRef.current) {
      editLoadedRef.current = true;
      setDetails(prev => ({
        ...prev,
        quotationNumber: existingQuotation.quotation_number ?? prev.quotationNumber,
        customerName: existingQuotation.customer_name ?? "",
        date: existingQuotation.date
          ? format(new Date(existingQuotation.date), "yyyy-MM-dd")
          : prev.date,
        notes: existingQuotation.notes ?? "",
      }));
      if (Array.isArray(existingQuotation.items)) {
        setItems(existingQuotation.items.map((i: any) => ({
          id: String(i.id ?? Date.now() + Math.random()),
          name: i.name ?? "",
          description: i.description ?? "",
          category: i.category ?? "",
          quantity: Number(i.quantity) || 1,
          unit: "وحدة",
          price: Number(i.price) || 0,
          total: Number(i.total) || 0,
          imageUrl: i.image_url ?? undefined,
        })));
      }
    }
  }, [isEditMode, existingQuotation]);

  /* ─── Auto-save draft (non-edit mode only) ───────────── */
  const saveDraft = useCallback(() => {
    if (isEditMode) return;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ items, details, headers, logoBase64, discountValue, taxRate })); } catch {}
  }, [items, details, headers, logoBase64, discountValue, taxRate, isEditMode]);
  useEffect(() => { saveDraft(); }, [saveDraft]);

  const clearDraft = () => {
    sessionStorage.removeItem(DRAFT_KEY);
    setItems(defaultItems()); setDetails(defaultDetails()); setHeaders(defaultHeaders());
    setLogoBase64(null); setDiscountValue(0); setTaxRate(0); setSavedSuccess(false);
    editLoadedRef.current = false;
  };

  /* ─── Totals ─────────────────────────────────────────── */
  const subtotal = items.reduce((acc, i) => acc + (i.total || 0), 0);
  const discountAmount = (subtotal * discountValue) / 100;
  const taxAmount = ((subtotal - discountAmount) * taxRate) / 100;
  const grandTotal = subtotal - discountAmount + taxAmount;
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* ─── Item helpers ───────────────────────────────────── */
  const addItem = () => setItems(prev => [...prev, {
    id: Date.now().toString(), name: "", description: "", category: "", quantity: 1, unit: "وحدة", price: 0, total: 0
  }]);

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: keyof Item, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "price") updated.total = Number(updated.quantity) * Number(updated.price);
      return updated;
    }));
  };


  /* ─── Logo & image upload ────────────────────────────── */
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const r = new FileReader(); r.onloadend = () => setLogoBase64(r.result as string); r.readAsDataURL(file); }
  };
  const handleItemImageUpload = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const r = new FileReader(); r.onloadend = () => updateItem(itemId, "imageUrl", r.result as string); r.readAsDataURL(file); }
  };

  /* ─── Local text parser (no API call needed) ─────────── */
  const parseTextLocally = (raw: string): Item[] => {
    const NUM = /\d+(?:[.,]\d+)*/g;
    const parseNum = (s: string) => { const m = s.match(/\d+(?:[.,]\d+)*/); return m ? parseFloat(m[0].replace(",", ".")) : null; };

    return raw
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map(line => {
        let name = "", desc = "", cat = "", qty = 1, price = 0;

        // Slash-separated: qty/name[/desc[/cat[/price]]]
        const slashParts = line.split("/").map(p => p.trim()).filter(p => p);
        if (slashParts.length >= 3) {
          const n0 = parseNum(slashParts[0]);
          qty = n0 ?? 1;
          name = slashParts[1] || "عنصر";
          if (slashParts.length >= 5) {
            desc = slashParts[2]; cat = slashParts[3];
            price = parseNum(slashParts[4]) ?? 0;
          } else if (slashParts.length === 4) {
            desc = slashParts[2]; price = parseNum(slashParts[3]) ?? 0;
          } else {
            price = parseNum(slashParts[2]) ?? 0;
          }
          if (!name.trim()) return null;
          qty = Math.max(qty, 1); price = Math.max(price, 0);
          return { id: Date.now().toString() + Math.random(), name, description: desc, category: cat, quantity: qty, unit: "وحدة", price, total: qty * price };
        }

        // Free text — extract all numbers
        const nums = (line.match(NUM) || []).map(n => parseFloat(n.replace(",", ".")));
        const nameText = line
          .replace(NUM, "")
          .replace(/بسعر|سعر|قطعة|حبات|حبة|وحدة|×|x/gi, " ")
          .replace(/\s+/g, " ").trim();
        if (nums.length >= 2) { qty = nums[nums.length - 2]; price = nums[nums.length - 1]; }
        else if (nums.length === 1) { price = nums[0]; }
        qty = Math.max(qty, 1); price = Math.max(price, 0);
        return { id: Date.now().toString() + Math.random(), name: nameText || "عنصر", description: "", category: "", quantity: qty, unit: "وحدة", price, total: qty * price };
      })
      .filter((i): i is Item => i !== null);
  };

  /* ─── Smart parse handlers ────────────────────────────── */
  const [parsing, setParsing] = useState(false);

  const applyParsedItems = (text: string) => {
    const newItems = parseTextLocally(text);
    if (!newItems.length) {
      toast.error("لم يُتعرف على أي عناصر — جرب نمط: الكمية / الاسم / السعر");
      return;
    }
    setItems(prev => {
      const filtered = prev.filter(i => i.name.trim() !== "" || i.price > 0);
      return [...filtered, ...newItems];
    });
    setPasteText("");
    toast.success(`✅ تمت إضافة ${newItems.length} ${newItems.length === 1 ? "عنصر" : "عناصر"} للجدول`);
    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const handleParseText = (textOverride?: string) => {
    const text = (textOverride ?? pasteText).trim();
    if (!text) return;
    setParsing(true);
    setTimeout(() => {
      applyParsedItems(text);
      setParsing(false);
    }, 50);
  };

  const handlePasteInTextarea = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!pasted.trim()) return;
    setTimeout(() => handleParseText(pasted.trim()), 150);
  };

  /* ─── WhatsApp ───────────────────────────────────────── */
  const handleWhatsApp = () => {
    const validItems = items.filter(i => i.name.trim());
    const lines = validItems.map((i, idx) => `${idx + 1}. ${i.name} × ${i.quantity} = ${i.total.toLocaleString()} د`).join("\n");
    const disc = discountAmount > 0 ? `\nخصم: -${discountAmount.toLocaleString()} د` : "";
    const tax = taxAmount > 0 ? `\nضريبة (${taxRate}%): +${taxAmount.toLocaleString()} د` : "";
    const msg = `*عرض سعر رقم: ${details.quotationNumber}*\nالعميل: ${details.customerName || "—"}\nالتاريخ: ${details.date}\n\n${lines}${disc}${tax}\n──────────────────\n*المجموع الكلي: ${grandTotal.toLocaleString()} دينار*\n\n${details.companyNameAr}\n☎ ${details.phone}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  /* ─── PDF export — uses selected template ──────────────────── */
  const handlePDF = async (tpl?: PdfTemplate) => {
    const template = tpl ?? pdfTemplate;
    setPdfMenuOpen(false);
    setPdfGenerating(true);
    const validItems = items.filter(i => i.name.trim());
    if (validItems.length === 0) {
      toast.error("أضف عناصر أولاً لتنزيل الـ PDF");
      setPdfGenerating(false);
      return;
    }
    try {
      const safeName = details.customerName
        .replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_").replace(/^_|_$/g, "") || "عرض_سعر";
      const dateTag = details.date || format(new Date(), "yyyy-MM-dd");
      const filename = `${safeName}_${dateTag}.pdf`;

      const tplData = {
        quotationNumber: details.quotationNumber,
        date: details.date,
        customerName: details.customerName,
        companyNameAr: details.companyNameAr,
        companyNameEn: details.companyNameEn,
        companyLocationAr: details.companyLocationAr,
        phone: details.phone,
        email: details.email,
        website: details.website,
        closingText: details.closingText,
        signerTitle: details.signerTitle,
        footerCompany: details.footerCompany,
        notes: details.notes,
        items: validItems.map(i => ({
          name: i.name,
          description: i.description,
          category: i.category,
          quantity: i.quantity,
          price: i.price,
          total: i.total,
          imageUrl: i.imageUrl,
        })),
        discountValue,
        discountAmount,
        taxRate,
        taxAmount,
        subtotal,
        grandTotal,
        stampUrl: stampImage,
      };

      if (template === "andalus") {
        await downloadAndalusPdf(tplData, filename);
      } else {
        await downloadModernPdf(tplData, filename);
      }
      toast.success("✅ تم تنزيل PDF");
    } catch (err) {
      console.error("PDF error:", err);
      toast.error(`فشل إنشاء PDF: ${(err as Error)?.message ?? err}`);
    } finally {
      setPdfGenerating(false);
    }
  };

  /* ─── Save / Update — direct fetch ──────────────────────────── */
  const safeNum = (n: number) => isFinite(n) && !isNaN(n) ? n : 0;

  const handleSave = async () => {
    if (!details.customerName.trim()) { toast.error("مطلوب اسم العميل"); return; }
    const validItems = items.filter(i => i.name.trim());
    if (validItems.length === 0) { toast.error("مطلوب إضافة عنصر واحد على الأقل"); return; }

    setIsSaving(true);
    try {
      const safeGrand = safeNum(grandTotal);
      const payload = {
        quotationNumber: details.quotationNumber || format(new Date(), "yyyyMMdd"),
        customerName: details.customerName.trim(),
        date: details.date || format(new Date(), "yyyy-MM-dd"),
        notes: details.notes || "",
        grandTotal: safeGrand.toFixed(2),
        items: validItems.map(i => ({
          name: i.name.trim(),
          description: (i.description || "").trim(),
          category: i.category?.trim() || null,
          quantity: Math.max(1, safeNum(i.quantity)),
          price: safeNum(i.price).toFixed(2),
          total: safeNum(i.total).toFixed(2),
          imageUrl: null,
        })),
      };

      const url  = isEditMode ? `/api/quotations/${editId}` : `/api/quotations`;
      const meth = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method: meth,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = `خطأ ${res.status}`;
        try { const j = await res.json(); if (j.message) msg = j.message; } catch {}
        throw new Error(msg);
      }

      toast.success(isEditMode ? "تم تحديث عرض السعر ✅" : "تم حفظ عرض السعر ✅");
      if (!isEditMode) sessionStorage.removeItem(DRAFT_KEY);
      navigate("/quotation-history");
    } catch (e: any) {
      console.error("Save error:", e);
      toast.error(e.message || "خطأ في الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const hdrCls = "bg-transparent border-none focus:outline-none focus:bg-white/10 focus:ring-1 focus:ring-white/30 rounded px-1 text-center text-xs font-bold text-white w-full";

  /* ─── Loading screen for edit mode ──────────────────── */
  if (isEditMode && loadingEdit) {
    return (
      <div dir="rtl" className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">جاري تحميل العرض...</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50">

      {/* ── Top Toolbar ── */}
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm px-4 py-2 flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(isEditMode ? "/quotation-history" : "/")}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all flex items-center gap-1 text-sm font-medium">
            <ArrowRight className="w-4 h-4" />
            رجوع
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              {isEditMode ? `تعديل عرض سعر #${details.quotationNumber || editId}` : "إنشاء عرض سعر جديد"}
            </h1>
            <p className="text-slate-400 text-xs hidden sm:block">أدخل البيانات أو الصق النص لتحويله لجدول تلقائياً</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {!isEditMode && (
            <button onClick={() => navigate("/quotation-history")}
              className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 transition-all text-xs font-medium px-3 border border-slate-200">
              السجل
            </button>
          )}
          {!isEditMode && (
            <button onClick={clearDraft} className="p-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-red-500 transition-all" title="مسح وبدء من جديد">
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button onClick={handleWhatsApp} className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-all" title="إرسال واتساب">
            <MessageCircle className="w-4 h-4" />
          </button>
          {/* PDF split-button with template picker */}
          <div className="relative flex items-center">
            <button onClick={() => handlePDF()} disabled={pdfGenerating}
              className="p-1.5 rounded-r-none rounded-l-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all disabled:opacity-50 border-r border-red-200" title="تنزيل PDF">
              {pdfGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            </button>
            <button onClick={() => setPdfMenuOpen(v => !v)} disabled={pdfGenerating}
              className="p-1.5 rounded-l-none rounded-r-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all disabled:opacity-50 text-[10px] font-bold px-1.5"
              title="اختر نموذج PDF">
              <ChevronDown className="w-3 h-3" />
            </button>
            {pdfMenuOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-44"
                onMouseLeave={() => setPdfMenuOpen(false)}>
                <button onClick={() => { setPdfTemplate("modern"); handlePDF("modern"); }}
                  className={`w-full text-right px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-slate-50 transition-colors ${pdfTemplate === "modern" ? "font-bold text-slate-900" : "text-slate-700"}`}>
                  <span className="w-2 h-2 rounded-full bg-slate-800 flex-shrink-0"></span>
                  النموذج الحديث
                </button>
                <button onClick={() => { setPdfTemplate("andalus"); handlePDF("andalus"); }}
                  className={`w-full text-right px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-amber-50 transition-colors ${pdfTemplate === "andalus" ? "font-bold text-amber-800" : "text-slate-700"}`}>
                  <span className="w-2 h-2 rounded-full bg-amber-600 flex-shrink-0"></span>
                  نموذج الأندلس
                </button>
              </div>
            )}
          </div>
          <button onClick={handleSave} disabled={isSaving}
            className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-green-700 text-white font-semibold hover:bg-green-800 transition-all disabled:opacity-50 text-sm">
            {isSaving ? "جاري الحفظ..." : isEditMode ? "تحديث العرض" : "حفظ العرض"}
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-3 space-y-3 pb-20">

        {/* ── Smart Paste ── */}
        <div className="bg-white border border-green-200 rounded-xl p-3 space-y-2 no-print">
          <div className="flex items-center gap-2 text-green-700">
            <Wand2 className="w-5 h-5" />
            <h2 className="text-sm font-bold">التحليل الذكي للنصوص</h2>
          </div>
          <p className="text-slate-500 text-xs">
            الصق النص على هذا النمط: <span className="font-bold text-slate-700">الكمية / الاسم / الوصف / القسم / السعر</span>
          </p>
          <div className="relative">
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
              onPaste={handlePasteInTextarea}
              placeholder={"الصق النص هنا وسيتم تحليله تلقائياً:\nجوري 50 حبة بسعر 3\nأثل 20 قطعة سعر 25"}
              className="w-full h-20 p-2 rounded-lg border border-slate-200 resize-none text-xs focus:outline-none focus:border-green-400" />
            {parsing ? (
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-green-50 text-green-600 text-xs font-bold">
                <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                جاري التحليل...
              </div>
            ) : pasteText.trim() ? (
              <button onClick={() => handleParseText()} disabled={parsing}
                className="absolute bottom-2 left-2 flex items-center gap-1 px-3 py-1 rounded-lg bg-green-100 text-green-700 font-bold hover:bg-green-200 transition-all text-xs">
                <CheckCircle2 className="w-3 h-3" />
                حلل النص
              </button>
            ) : null}
          </div>
        </div>

        {/* ── Plant Picker ── */}
        {sections.length > 0 && (
          <div className="bg-white border border-emerald-200 rounded-xl p-3 space-y-2 no-print">
            <div className="flex items-center gap-2 text-emerald-700">
              <Leaf className="w-5 h-5" />
              <h2 className="text-sm font-bold">اختر من نباتات الموقع</h2>
            </div>

            {/* Search box */}
            <div className="relative">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={pickerSearch}
                onChange={e => setPickerSearch(e.target.value)}
                placeholder="ابحث عن نبات لإضافته..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                dir="rtl"
              />
            </div>

            {/* Plant list */}
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-100">
              {filteredPlants.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-sm">لا توجد نتائج</div>
              ) : filteredPlants.map(plant => (
                <button
                  key={plant.id}
                  type="button"
                  onClick={() => {
                    const newItem: Item = {
                      id: Date.now().toString() + Math.random(),
                      name: plant.nameAr,
                      description: "",
                      category: plant.sectionNameAr ?? "",
                      quantity: 1,
                      unit: "وحدة",
                      price: 0,
                      total: 0,
                      imageUrl: (plant as any).image ?? undefined,
                    };
                    setItems(prev => {
                      const hasEmpty = prev.length === 1 && !prev[0].name.trim() && prev[0].price === 0;
                      return hasEmpty ? [newItem] : [...prev, newItem];
                    });
                    toast.success(`✅ تمت إضافة "${plant.nameAr}"`);
                    setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-right hover:bg-emerald-50 transition-colors"
                >
                  {/* Thumbnail */}
                  {(plant as any).image ? (
                    <img
                      src={(plant as any).image}
                      alt={plant.nameAr}
                      className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-emerald-100 flex-shrink-0 flex items-center justify-center">
                      <Leaf className="w-5 h-5 text-emerald-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-800 text-sm leading-tight">{plant.nameAr}</div>
                    <div className="text-slate-400 text-xs mt-0.5">{plant.sectionNameAr}</div>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 text-center">اضغط على النبات لإضافته للجدول — عدّل الكمية والسعر بعدها</p>
          </div>
        )}

        {/* ── Document ── */}
        <div ref={tableRef} id="quotation-document" className="bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden">

          {/* ── Title bar ── */}
          <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
            <div>
              <div className="text-white text-lg font-black tracking-wide">عرض سعر</div>
              <div className="text-slate-400 text-[10px] tracking-widest mt-0.5">QUOTATION</div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <div className="text-slate-400 text-[10px] mb-0.5">رقم العرض</div>
                <input
                  value={details.quotationNumber}
                  onChange={e => setDetails({ ...details, quotationNumber: e.target.value })}
                  className="bg-transparent text-green-400 font-black text-base outline-none border-none text-right w-28 placeholder:text-slate-600"
                  placeholder="0001"
                />
              </div>
              <div className="text-right">
                <div className="text-slate-400 text-[10px] mb-0.5">التاريخ</div>
                <input
                  type="date"
                  value={details.date}
                  onChange={e => setDetails({ ...details, date: e.target.value })}
                  className="bg-transparent text-white text-xs outline-none border-none text-right"
                />
              </div>
            </div>
          </div>

          {/* ── Client strip ── */}
          <div className="bg-slate-100 border-b border-slate-200 px-5 py-2.5 flex items-center gap-3">
            <span className="text-[10px] text-slate-500 font-semibold shrink-0">العميل</span>
            <input
              value={details.customerName}
              onChange={e => setDetails({ ...details, customerName: e.target.value })}
              className="flex-1 bg-transparent text-slate-800 font-bold text-sm outline-none border-b-2 border-transparent focus:border-green-500 px-1 placeholder:text-slate-400"
              placeholder="اسم العميل *"
            />
          </div>

          <div className="p-4 space-y-3">

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white border-b border-slate-700">
                  <th className="p-2 text-center w-6"><input value={headers.index} onChange={e => setHeaders({ ...headers, index: e.target.value })} className={hdrCls} style={{ width: "2rem" }} /></th>
                  <th className="p-2 text-right"><input value={headers.name} onChange={e => setHeaders({ ...headers, name: e.target.value })} className={hdrCls} /></th>
                  <th className="p-2 text-right"><input value={headers.description} onChange={e => setHeaders({ ...headers, description: e.target.value })} className={hdrCls} /></th>
                  <th className="p-2 text-right"><input value={headers.category} onChange={e => setHeaders({ ...headers, category: e.target.value })} className={hdrCls} /></th>
                  <th className="p-2 text-center w-24"><input value={headers.quantity} onChange={e => setHeaders({ ...headers, quantity: e.target.value })} className={hdrCls} /></th>
                  <th className="p-2 text-center w-24"><input value={headers.price} onChange={e => setHeaders({ ...headers, price: e.target.value })} className={hdrCls} /></th>
                  <th className="p-2 text-center w-24"><input value={headers.total} onChange={e => setHeaders({ ...headers, total: e.target.value })} className={hdrCls} /></th>
                  <th className="p-2 text-center w-28"><input value={headers.image} onChange={e => setHeaders({ ...headers, image: e.target.value })} className={hdrCls} /></th>
                  <th className="p-2 w-10 no-print"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors group">
                    <td className="p-1.5 text-center text-slate-600 font-semibold text-xs">{index + 1}</td>
                    <td className="p-1.5">
                      <input value={item.name} onChange={(e) => updateItem(item.id, "name", e.target.value)} className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-green-500 focus:ring-1 focus:ring-green-200 px-1.5 py-1 rounded text-xs font-medium" placeholder="الاسم" />
                    </td>
                    <td className="p-1.5">
                      <input value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)} dir="rtl" className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-green-500 focus:ring-1 focus:ring-green-200 px-1.5 py-1 rounded text-xs text-slate-600" placeholder="الوصف" />
                    </td>
                    <td className="p-1.5">
                      <input value={item.category} onChange={(e) => updateItem(item.id, "category", e.target.value)} className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-green-500 focus:ring-1 focus:ring-green-200 px-1.5 py-1 rounded text-xs text-slate-600" placeholder="القسم" />
                    </td>
                    <td className="p-1.5 text-center">
                      <input type="number" min="1" dir="ltr" value={item.quantity === 0 ? "" : item.quantity} onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)} placeholder="0" style={{ textAlign: "center" }} className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-green-500 px-1.5 py-1 rounded text-xs font-bold text-slate-800" />
                    </td>
                    <td className="p-1.5 text-center">
                      <input type="number" min="0" step="0.01" dir="ltr" value={item.price === 0 ? "" : item.price} onChange={(e) => updateItem(item.id, "price", parseFloat(e.target.value) || 0)} placeholder="0.00" style={{ textAlign: "center" }} className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-green-500 px-1.5 py-1 rounded text-xs font-bold text-slate-800" />
                    </td>
                    <td className="p-1.5 text-center font-bold text-slate-900 bg-slate-100 rounded text-xs">{fmt(item.total)}</td>
                    <td className="p-1 text-center">
                      <label className="relative cursor-pointer block w-20 h-20 mx-auto rounded overflow-hidden border border-slate-200 hover:border-green-400 transition-colors group/img" title="انقر لرفع صورة">
                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10 no-print" onChange={(e) => handleItemImageUpload(item.id, e)} />
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-50 no-print">
                            <Plus className="w-3.5 h-3.5 text-slate-300" />
                          </div>
                        )}
                      </label>
                    </td>
                    <td className="p-1.5 text-center no-print">
                      <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-500 p-0.5 rounded transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {(discountAmount > 0 || taxAmount > 0) && (
                  <>
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td colSpan={7} className="p-2 text-right text-xs pr-4 text-slate-600">المجموع الفرعي</td>
                      <td className="p-1.5 text-center text-xs text-slate-700 font-semibold">{fmt(subtotal)}</td>
                      <td></td><td className="no-print"></td>
                    </tr>
                    {discountAmount > 0 && (
                      <tr className="bg-green-50">
                        <td colSpan={7} className="p-2 text-right text-xs pr-4 text-green-700">خصم ({discountValue}%)</td>
                        <td className="p-1.5 text-center text-xs text-green-700 font-semibold">-{fmt(discountAmount)}</td>
                        <td></td><td className="no-print"></td>
                      </tr>
                    )}
                    {taxAmount > 0 && (
                      <tr className="bg-orange-50">
                        <td colSpan={7} className="p-2 text-right text-xs pr-4 text-orange-700">ضريبة ({taxRate}%)</td>
                        <td className="p-1.5 text-center text-xs text-orange-700 font-semibold">+{fmt(taxAmount)}</td>
                        <td></td><td className="no-print"></td>
                      </tr>
                    )}
                  </>
                )}
                <tr className="bg-slate-900 text-white">
                  <td colSpan={7} className="p-3 text-right font-bold text-sm pr-4">المجموع الكلي</td>
                  <td className="p-3 text-center font-black text-sm text-green-300">{fmt(grandTotal)}</td>
                  <td className="p-3 text-[9px] text-slate-400 text-center">د.أ</td>
                  <td className="no-print"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Add item button */}
          <button onClick={addItem} className="no-print flex items-center gap-1.5 text-green-700 hover:text-green-900 font-semibold text-xs transition-colors px-2 py-1.5 rounded-lg hover:bg-green-50 border border-dashed border-green-300 hover:border-green-500">
            <Plus className="w-3.5 h-3.5" />
            إضافة صنف
          </button>

          {/* Discount / Tax */}
          <div className="no-print bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
            <h3 className="text-xs font-bold text-slate-700">الخصم والضريبة</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500 font-medium">نسبة الخصم (%)</label>
                <input type="number" min="0" max="100" step="0.1" value={discountValue || ""} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-green-500" placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 font-medium">نسبة الضريبة (%)</label>
                <input type="number" min="0" max="100" step="0.1" value={taxRate || ""} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-green-500" placeholder="0" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1 no-print">
            <label className="text-xs font-bold text-slate-700 block">ملاحظات:</label>
            <textarea value={details.notes} onChange={(e) => setDetails({ ...details, notes: e.target.value })} className="w-full h-12 p-2 bg-slate-50 border border-slate-200 rounded focus:border-green-500 transition-all resize-none text-slate-700 text-xs outline-none" placeholder="شروط الدفع، مدة التوريد، إلخ..." />
          </div>
          {details.notes.trim() && (
            <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-700 text-xs whitespace-pre-wrap break-words">{details.notes}</div>
          )}

          {/* Closing */}
          <div className="pt-4 border-t border-slate-200 flex flex-col items-center gap-4">
            <input value={details.closingText} onChange={e => setDetails({ ...details, closingText: e.target.value })} className="text-center text-base font-bold text-slate-900 bg-transparent border-b border-slate-300 focus:border-green-500 outline-none w-full max-w-xs px-2 py-1 rounded-sm" placeholder="نص الختام" />
            <div className="w-full flex justify-end">
              <div className="flex flex-col items-center">
                <input value={details.signerTitle} onChange={e => setDetails({ ...details, signerTitle: e.target.value })} className="text-center text-sm font-bold text-slate-900 bg-transparent border-b border-slate-300 focus:border-green-500 outline-none px-2 py-1 rounded-sm" placeholder="المدير العام / الاسم" />
                <img src={stampImage} alt="Stamp" className="w-28 h-auto mt-4" />
              </div>
            </div>
          </div>

          </div>{/* /p-4 space-y-3 */}

          {/* Footer — edge-to-edge dark bar */}
          <div className="bg-slate-900 px-5 py-3 flex items-center justify-between gap-4 mt-0">
            <input value={details.footerCompany} onChange={e => setDetails({ ...details, footerCompany: e.target.value })} className="text-[10px] font-bold text-slate-300 bg-transparent border-none focus:outline-none w-32 placeholder:text-slate-600" placeholder="اسم الشركة" />
            <div className="flex items-center gap-5 text-slate-400" dir="ltr">
              <div className="flex items-center gap-1"><Phone className="w-3 h-3 flex-shrink-0 text-green-500" /><input value={details.phone} onChange={e => setDetails({ ...details, phone: e.target.value })} className="text-[10px] bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-slate-300 font-semibold w-28" dir="ltr" /></div>
              <div className="flex items-center gap-1"><Mail className="w-3 h-3 flex-shrink-0 text-green-500" /><input value={details.email} onChange={e => setDetails({ ...details, email: e.target.value })} className="text-[10px] bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-slate-300 w-36" dir="ltr" /></div>
              <div className="flex items-center gap-1"><Globe className="w-3 h-3 flex-shrink-0 text-green-500" /><input value={details.website} onChange={e => setDetails({ ...details, website: e.target.value })} className="text-[10px] bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-slate-300 w-36" dir="ltr" /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
