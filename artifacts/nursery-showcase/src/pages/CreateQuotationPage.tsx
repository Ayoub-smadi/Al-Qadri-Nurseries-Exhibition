import { useState, useEffect, useCallback, useRef } from "react";
import { navigate } from "@/App";
import {
  Plus, FileText, Save, Wand2, Trash2, CheckCircle2,
  Phone, Mail, Globe, RotateCcw, MessageCircle, ArrowRight,
  Leaf, ChevronDown
} from "lucide-react";
import { useCreateQuotation, useQuotation, useUpdateQuotation } from "@/hooks/use-quotations-v2";
import { useApp } from "@/lib/context";
import { toast } from "sonner";
import { exportToPDF } from "@/lib/quotation-export";
import { format } from "date-fns";
import logoImage from "@assets/لقطة_شاشة_2026-03-08_080127_1773036971718.png";
import stampImage from "@assets/لقطة_شاشة_2026-03-08_023328_1773047188235.png";

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
  const createMutation = useCreateQuotation();
  const { data: existingQuotation, isLoading: loadingEdit } = useQuotation(editId ?? 0);
  const updateMutation = useUpdateQuotation(editId ?? 0);

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
  const [pdfLoading, setPdfLoading] = useState(false);

  /* ─── Plant picker state ─────────────────────────────── */
  const [pickerSection, setPickerSection] = useState<string>("");
  const [pickerPlant, setPickerPlant] = useState<string>("");
  const [pickerQty, setPickerQty] = useState<number>(1);
  const [pickerPrice, setPickerPrice] = useState<number>(0);
  const [pickerSize, setPickerSize] = useState<string>("");
  const tableRef = useRef<HTMLDivElement>(null);

  const sections = siteData?.sections ?? [];
  const selectedSection = sections.find(s => s.id === pickerSection);
  const plants = selectedSection?.photos ?? [];

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

  /* ─── Plant picker add ───────────────────────────────── */
  const handleAddPlant = () => {
    const plant = plants.find(p => p.id === pickerPlant);
    if (!plant) { toast.error("اختر نباتاً أولاً"); return; }
    const name = plant.nameAr + (pickerSize ? ` (${pickerSize})` : "");
    const newItem: Item = {
      id: Date.now().toString(),
      name,
      description: plant.descriptionAr ?? plant.descriptionEn ?? "",
      category: selectedSection?.nameAr ?? "",
      quantity: Math.max(1, pickerQty),
      unit: "وحدة",
      price: pickerPrice,
      total: Math.max(1, pickerQty) * pickerPrice,
      imageUrl: plant.image ?? undefined,
    };
    const hasEmpty = items.length === 1 && !items[0].name.trim() && items[0].price === 0;
    setItems(hasEmpty ? [newItem] : [...items, newItem]);
    setPickerPlant(""); setPickerQty(1); setPickerPrice(0); setPickerSize("");
    toast.success(`تمت إضافة "${plant.nameAr}" للجدول`);
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

  /* ─── PDF export ─────────────────────────────────────── */
  const handlePDF = async () => {
    setPdfLoading(true);
    toast.info("جاري توليد PDF...");
    try {
      await exportToPDF("quotation-document", `Quote-${details.quotationNumber}`, items, details, logoBase64 || logoImage);
      toast.success("تم تصدير PDF بنجاح ✅");
    } catch {
      toast.error("فشل تصدير PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  /* ─── Save / Update ──────────────────────────────────── */
  const buildPayload = () => {
    const validItems = items.filter(i => i.name.trim());
    return {
      quotationNumber: details.quotationNumber,
      customerName: details.customerName,
      date: new Date(details.date),
      notes: details.notes,
      grandTotal: grandTotal.toString(),
      items: validItems.map(i => ({
        name: i.name.trim(), description: i.description.trim(),
        category: i.category?.trim() || null,
        quantity: Math.max(1, i.quantity),
        price: String(Math.max(0, i.price)), total: String(Math.max(0, i.total)),
        imageUrl: i.imageUrl || null,
      }))
    };
  };

  const handleSave = () => {
    if (!details.customerName.trim()) { toast.error("مطلوب اسم العميل"); return; }
    const validItems = items.filter(i => i.name.trim());
    if (validItems.length === 0) { toast.error("مطلوب إضافة عناصر"); return; }
    const payload = buildPayload();
    if (isEditMode) {
      updateMutation.mutate(payload, {
        onSuccess: () => { toast.success("تم تحديث عرض السعر بنجاح ✅"); setSavedSuccess(true); },
        onError: (e: any) => toast.error(e.message || "خطأ في التحديث"),
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { toast.success("تم حفظ عرض السعر بنجاح ✅"); setSavedSuccess(true); setTimeout(clearDraft, 2000); },
        onError: (e: any) => toast.error(e.message || "خطأ في الحفظ"),
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

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

  /* ─── Success screen ─────────────────────────────────── */
  if (savedSuccess) {
    return (
      <div dir="rtl" className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 bg-slate-50">
        <div className="text-6xl">✅</div>
        <h2 className="text-2xl font-black text-slate-800">
          {isEditMode ? "تم تحديث عرض السعر!" : "تم حفظ عرض السعر بنجاح!"}
        </h2>
        <p className="text-slate-500 text-sm">{isEditMode ? "" : "سيتم مسح النموذج تلقائياً خلال ثانيتين..."}</p>
        <div className="flex gap-3">
          {!isEditMode && (
            <button onClick={clearDraft} className="px-6 py-2 rounded-xl bg-green-600 text-white font-bold text-sm hover:opacity-90">إنشاء عرض جديد</button>
          )}
          <button onClick={() => navigate("/quotation-history")} className="px-6 py-2 rounded-xl bg-slate-200 text-slate-700 font-bold text-sm hover:opacity-90">عرض السجل</button>
          <button onClick={() => navigate("/")} className="px-6 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:opacity-90">العودة للموقع</button>
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
          <button onClick={handlePDF} disabled={pdfLoading}
            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all disabled:opacity-50" title="تصدير PDF">
            {pdfLoading ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : <FileText className="w-4 h-4" />}
          </button>
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
          <div className="bg-white border border-emerald-200 rounded-xl p-3 space-y-3 no-print">
            <div className="flex items-center gap-2 text-emerald-700">
              <Leaf className="w-5 h-5" />
              <h2 className="text-sm font-bold">اختر من نباتات الموقع</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {/* Section select */}
              <div className="relative">
                <label className="text-[10px] text-slate-500 font-medium mb-0.5 block">القسم</label>
                <div className="relative">
                  <select value={pickerSection} onChange={e => { setPickerSection(e.target.value); setPickerPlant(""); }}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-medium focus:outline-none focus:border-emerald-400 pr-6">
                    <option value="">— اختر القسم —</option>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.nameAr}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Plant select — auto-adds to table on selection */}
              <div className="relative sm:col-span-2">
                <label className="text-[10px] text-slate-500 font-medium mb-0.5 block">النبات (اختر ليُضاف فوراً)</label>
                <div className="relative">
                  <select value={pickerPlant}
                    onChange={e => {
                      const plantId = e.target.value;
                      if (!plantId) return;
                      const plant = plants.find(p => p.id === plantId);
                      if (!plant) return;
                      const newItem: Item = {
                        id: Date.now().toString() + Math.random(),
                        name: plant.nameAr,
                        description: (plant as any).descriptionAr ?? (plant as any).descriptionEn ?? "",
                        category: selectedSection?.nameAr ?? "",
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
                      setPickerPlant("");
                      toast.success(`✅ تمت إضافة "${plant.nameAr}" — عدّل الكمية والسعر في الجدول`);
                      setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                    }}
                    disabled={!pickerSection}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-medium focus:outline-none focus:border-emerald-400 pr-6 disabled:opacity-50">
                    <option value="">— اختر نبات ليُضاف للجدول —</option>
                    {plants.map(p => (
                      <option key={p.id} value={p.id}>{p.nameAr}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Document ── */}
        <div ref={tableRef} id="quotation-document" className="bg-white border border-slate-200 shadow-lg rounded-xl p-5 sm:p-6 space-y-3">

          {/* Header */}
          <div className="pb-4 border-b-2 border-slate-200">
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                <div className="relative group w-28 h-28 overflow-hidden bg-white flex items-center justify-center border border-slate-200 hover:shadow-xl transition-all rounded">
                  <img src={logoBase64 || logoImage} alt="Logo" className="w-full h-full object-contain p-2" />
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer no-print" title="انقر لتحميل شعار جديد" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center no-print pointer-events-none">
                    <span className="text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity text-slate-700 bg-white px-2 py-1 rounded">تغيير</span>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-start gap-8">
                  <div className="flex-1 space-y-1">
                    <input value={details.companyNameAr} onChange={(e) => setDetails({ ...details, companyNameAr: e.target.value })} className="text-xl font-bold text-slate-800 bg-transparent border-b border-slate-300 focus:border-green-500 outline-none w-full text-right px-2 py-1 rounded-sm" placeholder="اسم الشركة" />
                    <input value={details.companyLocationAr} onChange={(e) => setDetails({ ...details, companyLocationAr: e.target.value })} className="text-sm font-medium text-slate-600 bg-transparent border-b border-slate-300 focus:border-green-500 outline-none w-full text-right px-2 py-0.5 rounded-sm" placeholder="الموقع" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <input value={details.companyNameEn} onChange={(e) => setDetails({ ...details, companyNameEn: e.target.value })} className="text-xl font-bold text-slate-800 bg-transparent border-b border-slate-300 focus:border-green-500 outline-none w-full text-left px-2 py-1 rounded-sm" placeholder="Company Name" />
                    <input value={details.companyLocationEn} onChange={(e) => setDetails({ ...details, companyLocationEn: e.target.value })} className="text-sm font-medium text-slate-600 bg-transparent border-b border-slate-300 focus:border-green-500 outline-none w-full text-left px-2 py-0.5 rounded-sm" placeholder="Location" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <label className="text-slate-500 font-medium">رقم العرض:</label>
                <input value={details.quotationNumber} onChange={(e) => setDetails({ ...details, quotationNumber: e.target.value })} className="bg-transparent border-b border-slate-300 focus:border-green-500 outline-none px-1 font-bold text-slate-800 w-32" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-slate-500 font-medium">التاريخ:</label>
                <input type="date" value={details.date} onChange={(e) => setDetails({ ...details, date: e.target.value })} className="bg-transparent border-b border-slate-300 focus:border-green-500 outline-none px-1 text-slate-800" />
              </div>
              <div className="flex items-center gap-2 flex-1">
                <label className="text-slate-500 font-medium">العميل:</label>
                <input value={details.customerName} onChange={(e) => setDetails({ ...details, customerName: e.target.value })} className="bg-transparent border-b-2 border-slate-300 focus:border-green-500 outline-none px-1 font-semibold text-slate-700 flex-1" placeholder="اسم العميل *" />
              </div>
            </div>
          </div>

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

          {/* Footer */}
          <div className="border-t border-slate-200 pt-2 text-center opacity-70">
            <input value={details.footerCompany} onChange={e => setDetails({ ...details, footerCompany: e.target.value })} className="text-[10px] font-bold text-slate-900 bg-transparent border-none focus:outline-none text-center w-full mb-2" placeholder="اسم الشركة في التذييل" />
            <div className="flex items-center justify-center gap-4 text-slate-600" dir="ltr">
              <div className="flex items-center gap-1"><Phone className="w-3 h-3 flex-shrink-0" /><input value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} className="text-[10px] bg-transparent border-none p-0 focus:ring-0 focus:outline-none font-semibold w-28" dir="ltr" /></div>
              <div className="flex items-center gap-1"><Mail className="w-3 h-3 flex-shrink-0" /><input value={details.email} onChange={(e) => setDetails({ ...details, email: e.target.value })} className="text-[10px] bg-transparent border-none p-0 focus:ring-0 focus:outline-none w-36" dir="ltr" /></div>
              <div className="flex items-center gap-1"><Globe className="w-3 h-3 flex-shrink-0" /><input value={details.website} onChange={(e) => setDetails({ ...details, website: e.target.value })} className="text-[10px] bg-transparent border-none p-0 focus:ring-0 focus:outline-none w-36" dir="ltr" /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
