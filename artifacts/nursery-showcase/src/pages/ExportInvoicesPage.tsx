import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import { ArrowRight, Check, FileDown, FilePlus2, ImagePlus, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { navigate } from "@/App";
import { useApp } from "@/lib/context";
import {
  deleteExportInvoice,
  fetchExportInvoices,
  loadSavedToken,
  uploadImageBase64,
  upsertExportInvoice,
} from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type ExportRow = {
  id: string;
  product: string;
  grossWeight: string;
  netWeight: string;
  quantity: string;
  origin: string;
  notes: string;
  totalDinar: string;
  totalFils: string;
};

type ExportDetails = {
  institutionName: string;
  address: string;
  title: string;
  dateLabel: string;
  date: string;
  invoiceNumberLabel: string;
  invoiceNumber: string;
  sourceLabel: string;
  sourceName: string;
  facilityNumberLabel: string;
  facilityNumber: string;
  destinationLabel: string;
  destination: string;
  totalLabel: string;
  sumLabel: string;
  totalInWordsLabel: string;
  totalInWords: string;
  dinarLabel: string;
  filsLabel: string;
  productLabel: string;
  weightLabel: string;
  grossWeightLabel: string;
  netWeightLabel: string;
  quantityLabel: string;
  originLabel: string;
  notesLabel: string;
  certificateText: string;
  exportPermissionText: string;
  stampLabel: string;
};

type ExportInvoiceData = {
  details: ExportDetails;
  rows: ExportRow[];
  stampUrl: string;
};

type ExportInvoiceRecord = ExportInvoiceData & {
  id: string;
  createdAt?: string;
  updatedAt?: string;
};

const DRAFT_KEY = "alqadri_export_invoice_draft";
const RECORDS_KEY = "alqadri_export_invoice_records";

const paperInput: CSSProperties = {
  width: "100%",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#172033",
  fontFamily: "Cairo, Arial, sans-serif",
};

const today = () => new Date().toISOString().slice(0, 10);
const makeId = () => `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function defaultDetails(): ExportDetails {
  return {
    institutionName: "مؤسسة القادري الزراعية",
    address: "جرش - طريق عمان",
    title: "فاتورة تصدير",
    dateLabel: "التاريخ",
    date: today(),
    invoiceNumberLabel: "فاتورة رقم",
    invoiceNumber: "",
    sourceLabel: "المصدر:",
    sourceName: "منشأة",
    facilityNumberLabel: "رقم",
    facilityNumber: "()",
    destinationLabel: "المصدر إليه:",
    destination: "",
    totalLabel: "القيمة الإجمالية",
    sumLabel: "المجموع",
    totalInWordsLabel: "المجموع كتابةً",
    totalInWords: "",
    dinarLabel: "دينار",
    filsLabel: "فلس",
    productLabel: "الصنف",
    weightLabel: "الوزن",
    grossWeightLabel: "قائم",
    netWeightLabel: "صافي",
    quantityLabel: "الكمية",
    originLabel: "المنشأ",
    notesLabel: "ملاحظات",
    certificateText: "نشهد أن هذه الفاتورة هي الوحيدة الصادرة عنا بشأن البضاعة المبينة فيها من منشأ أردني، منتجات زراعية، الشحن برا.",
    exportPermissionText: "لا مانع للتصدير",
    stampLabel: "الختم",
  };
}

function newRow(): ExportRow {
  return {
    id: makeId(),
    product: "",
    grossWeight: "",
    netWeight: "",
    quantity: "",
    origin: "أردني",
    notes: "",
    totalDinar: "",
    totalFils: "",
  };
}

function loadRecords(): ExportInvoiceRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECORDS_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.map(normalizeRecord) : [];
  } catch {
    return [];
  }
}

function saveRecords(records: ExportInvoiceRecord[]) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // The server remains the source of truth when local storage is full.
  }
}

function normalizeRecord(raw: Partial<ExportInvoiceRecord>): ExportInvoiceRecord {
  const details = { ...defaultDetails(), ...(raw.details || {}) };
  const rows = Array.isArray(raw.rows) && raw.rows.length
    ? raw.rows.map((row) => ({ ...newRow(), ...row, id: row.id || makeId() }))
    : [newRow()];
  return {
    id: raw.id || makeId(),
    details,
    rows,
    stampUrl: raw.stampUrl || "/stamp-qadri.png",
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function loadDraft(): ExportInvoiceRecord | null {
  try {
    const saved = sessionStorage.getItem(DRAFT_KEY);
    return saved ? normalizeRecord(JSON.parse(saved) as Partial<ExportInvoiceRecord>) : null;
  } catch {
    return null;
  }
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function totalParts(rows: ExportRow[]) {
  const cents = rows.reduce((sum, row) => (
    sum + Math.round(numberValue(row.totalDinar) * 100) + Math.round(numberValue(row.totalFils))
  ), 0);
  return {
    dinar: Math.floor(cents / 100).toLocaleString("en-US"),
    fils: String(cents % 100).padStart(2, "0"),
  };
}

function EditableField({
  value,
  onChange,
  ariaLabel,
  style,
  className = "",
  type = "text",
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  style?: CSSProperties;
  className?: string;
  type?: string;
  placeholder?: string;
  inputMode?: "decimal" | "numeric" | "text";
}) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      type={type}
      placeholder={placeholder}
      inputMode={inputMode}
      className={className}
      style={{ ...paperInput, ...style }}
    />
  );
}

function EditableText({
  value,
  onChange,
  ariaLabel,
  style,
  rows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  style?: CSSProperties;
  rows?: number;
}) {
  return (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      style={{ ...paperInput, resize: "vertical", ...style }}
    />
  );
}

export default function ExportInvoicesPage() {
  const { siteData, isAdmin } = useApp();
  const paperRef = useRef<HTMLDivElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const initial = useMemo(() => loadDraft(), []);
  const [draft, setDraft] = useState<ExportInvoiceRecord>(() => initial || normalizeRecord({}));
  const [records, setRecords] = useState<ExportInvoiceRecord[]>(() => loadRecords());
  const [currentId, setCurrentId] = useState<string | null>(() => initial?.id || null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(initial));
  const [pdfing, setPdfing] = useState(false);

  const fallbackLogo = siteData?.logo?.customUrl || "/logo-alkadri.jpg";
  const calculatedTotal = totalParts(draft.rows);

  const updateDetails = useCallback(<K extends keyof ExportDetails>(key: K, value: ExportDetails[K]) => {
    setDraft((current) => ({ ...current, details: { ...current.details, [key]: value } }));
    setSaved(false);
  }, []);

  const updateRow = useCallback(<K extends keyof ExportRow>(id: string, key: K, value: ExportRow[K]) => {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row) => row.id === id ? { ...row, [key]: value } : row),
    }));
    setSaved(false);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Saving to the server or the record list still remains available.
    }
  }, [draft]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    void (async () => {
      const serverRecords = await fetchExportInvoices();
      if (!active || !serverRecords) return;
      const localRecords = loadRecords();
      const serverIds = new Set(serverRecords.map((record) => record.id));
      const localOnly = localRecords.filter((record) => !serverIds.has(record.id));
      for (const localRecord of localOnly) {
        try {
          const prepared = await prepareForServer(localRecord);
          await upsertExportInvoice(prepared, localRecord.id);
        } catch {
          // Keep the local copy if image migration or network access fails.
        }
      }
      const fresh = localOnly.length ? await fetchExportInvoices() : serverRecords;
      if (active && fresh) {
        const normalized = fresh.map((record) => normalizeRecord(record));
        setRecords(normalized);
        saveRecords(normalized);
      }
    })();
    return () => { active = false; };
  }, [isAdmin]);

  const filteredRecords = records.filter((record) => {
    const haystack = `${record.details.invoiceNumber} ${record.details.destination} ${record.details.date}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const handleNew = () => {
    setDraft(normalizeRecord({}));
    setCurrentId(null);
    setSaved(false);
  };

  const handleOpen = (record: ExportInvoiceRecord) => {
    setDraft(normalizeRecord(record));
    setCurrentId(record.id);
    setSaved(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("نقل فاتورة التصدير إلى المحذوفات؟")) return;
    if (loadSavedToken()) {
      const ok = await deleteExportInvoice(id);
      if (!ok) {
        toast.error("فشل حذف الفاتورة");
        return;
      }
    }
    const next = records.filter((record) => record.id !== id);
    setRecords(next);
    saveRecords(next);
    if (currentId === id) handleNew();
    toast.success("تم حذف الفاتورة");
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const record = { ...draft, id: currentId || draft.id, updatedAt: new Date().toISOString() };
      if (loadSavedToken()) {
        const prepared = await prepareForServer(record);
        const serverRecord = await upsertExportInvoice(prepared, currentId || record.id);
        if (!serverRecord) {
          toast.error("فشل الحفظ المركزي — تحقق من الاتصال");
          return;
        }
        const normalized = normalizeRecord(serverRecord);
        setDraft(normalized);
        setCurrentId(normalized.id);
        const next = [normalized, ...records.filter((item) => item.id !== normalized.id)];
        setRecords(next);
        saveRecords(next);
      } else {
        const normalized = normalizeRecord(record);
        const next = [normalized, ...records.filter((item) => item.id !== normalized.id)];
        setDraft(normalized);
        setCurrentId(normalized.id);
        setRecords(next);
        saveRecords(next);
      }
      setSaved(true);
      toast.success(loadSavedToken() ? "تم الحفظ في السجل المركزي" : "تم الحفظ محلياً");
    } catch (error) {
      toast.error(`فشل الحفظ: ${(error as Error).message || "خطأ غير معروف"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleStampChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setDraft((current) => ({ ...current, stampUrl: String(reader.result || "") }));
      setSaved(false);
    };
    reader.readAsDataURL(file);
  };

  const handlePdf = async () => {
    if (!paperRef.current || pdfing) return;
    setPdfing(true);
    const paper = paperRef.current;
    const hidden: { node: HTMLElement; display: string }[] = [];
    const replaced: { input: HTMLElement; div: HTMLDivElement }[] = [];
    const savedClasses: { node: Element; className: string }[] = [];
    try {
      await document.fonts.ready;
      paper.querySelectorAll(".export-pdf-hide").forEach((node) => {
        const element = node as HTMLElement;
        hidden.push({ node: element, display: element.style.display });
        element.style.display = "none";
      });
      paper.querySelectorAll("input, textarea").forEach((node) => {
        const input = node as HTMLInputElement | HTMLTextAreaElement;
        const style = window.getComputedStyle(input);
        const div = document.createElement("div");
        div.textContent = input.value;
        div.style.cssText = [
          "background:transparent", "border:none", "font-family:Cairo,Arial,sans-serif",
          `font-size:${style.fontSize}`, `font-weight:${style.fontWeight}`, `color:${style.color}`,
          `text-align:${style.textAlign}`, "width:100%", "white-space:pre-wrap", "word-break:break-word",
          `min-height:${style.height}`, `padding:${style.padding}`,
        ].join(";");
        input.parentNode?.insertBefore(div, input);
        input.style.display = "none";
        replaced.push({ input, div });
      });
      paper.querySelectorAll("[class]").forEach((node) => {
        savedClasses.push({ node, className: node.getAttribute("class") || "" });
        node.removeAttribute("class");
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      const canvas = await html2canvas(paper, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: paper.scrollWidth,
        height: paper.scrollHeight,
        scrollX: 0,
        scrollY: 0,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const image = canvas.toDataURL("image/png");
      const pageWidth = 190;
      const pageHeight = 277;
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let heightLeft = imageHeight;
      let position = 10;
      pdf.addImage(image, "PNG", 10, position, pageWidth, imageHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imageHeight + 10;
        pdf.addPage();
        pdf.addImage(image, "PNG", 10, position, pageWidth, imageHeight);
        heightLeft -= pageHeight;
      }
      const safeNumber = (draft.details.invoiceNumber || "جديد").replace(/[^\u0600-\u06FFa-zA-Z0-9_-]/g, "_");
      pdf.save(`فاتورة_تصدير_${safeNumber}.pdf`);
      toast.success("تم تنزيل فاتورة التصدير PDF");
    } catch (error) {
      toast.error(`فشل إنشاء PDF: ${(error as Error).message || "خطأ غير معروف"}`);
    } finally {
      hidden.forEach(({ node, display }) => { node.style.display = display; });
      replaced.forEach(({ input, div }) => {
        div.remove();
        input.style.display = "";
      });
      savedClasses.forEach(({ node, className }) => {
        if (className) node.setAttribute("class", className);
      });
      setPdfing(false);
    }
  };

  return (
    <main dir="rtl" className="min-h-screen bg-[#f4f6f3] text-slate-900">
      <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[#dce5dd] bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => navigate("/")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d6e0d8] bg-white text-[#1c6b46] hover:bg-[#f1f8f3]" aria-label="العودة للرئيسية">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1c6b46] text-white"><FilePlus2 className="h-4 w-4" /></span>
              <h1 className="truncate text-lg font-black text-[#153d2b]">فواتير تصدير</h1>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">محرر فاتورة تصدير قابلة للتعديل</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={handleNew} className="gap-2 rounded-xl border-[#d6e0d8] bg-white arabic">
            <Plus className="h-4 w-4" /> فاتورة جديدة
          </Button>
          <Button variant="outline" onClick={() => void handlePdf()} disabled={pdfing} className="gap-2 rounded-xl border-[#d6e0d8] bg-white arabic">
            {pdfing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="gap-2 rounded-xl bg-[#1c6b46] text-white hover:bg-[#155437] arabic">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? "جاري الحفظ..." : saved ? "محفوظ" : "حفظ"}
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-6">
        <aside className="no-print order-2 rounded-2xl border border-[#dce5dd] bg-white p-4 shadow-sm lg:order-1">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-[#b08a45]">EXPORT ARCHIVE</p>
              <h2 className="mt-1 text-xl font-black text-[#153d2b]">سجل الفواتير</h2>
            </div>
            <span className="rounded-full bg-[#edf5ef] px-2.5 py-1 text-xs font-bold text-[#1c6b46]">{records.length}</span>
          </div>
          <div className="relative mb-3">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث في السجل..." className="h-10 rounded-xl border-[#dbe4dc] bg-[#fbfcfa] pr-9 text-right arabic" />
          </div>
          <button onClick={handleNew} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#aac7b2] bg-[#f4faf5] px-3 py-2.5 text-sm font-bold text-[#1c6b46] hover:bg-[#e8f4eb]">
            <Plus className="h-4 w-4" /> إنشاء فاتورة جديدة
          </button>
          <div className="space-y-2">
            {filteredRecords.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d8e1d9] px-4 py-10 text-center text-sm text-slate-400">
                <FilePlus2 className="mx-auto mb-2 h-8 w-8 text-[#b8cabc]" />
                لا توجد فواتير محفوظة بعد
              </div>
            ) : filteredRecords.map((record) => (
              <div key={record.id} className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${currentId === record.id ? "border-[#8fbd9d] bg-[#f2faf4]" : "border-[#e5ece6] hover:bg-[#fafcf9]"}`}>
                <button onClick={() => handleOpen(record)} className="min-w-0 flex-1 text-right">
                  <span className="block truncate text-sm font-bold text-[#153d2b]">{record.details.invoiceNumber || "فاتورة بلا رقم"}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{record.details.destination || "بدون جهة" } · {record.details.date}</span>
                </button>
                <button onClick={() => void handleDelete(record.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" title="حذف الفاتورة" aria-label="حذف الفاتورة">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="order-1 min-w-0 lg:order-2">
          <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce5dd] bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-[#b08a45]">LIVE DOCUMENT</p>
              <p className="mt-1 text-sm font-bold text-[#153d2b]">عدّل أي نص أو رقم مباشرة داخل الورقة</p>
            </div>
            <span className={`flex items-center gap-1.5 text-xs font-semibold ${saved ? "text-[#1c6b46]" : "text-amber-600"}`}>
              <span className={`h-2 w-2 rounded-full ${saved ? "bg-[#1c6b46]" : "bg-amber-500"}`} />
              {saved ? "آخر نسخة محفوظة" : "تعديلات غير محفوظة"}
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl pb-4">
            <div ref={paperRef} style={{ width: 794, minHeight: 1030, margin: "0 auto", padding: "34px 38px", background: "#fff", color: "#172033", fontFamily: "Cairo, Arial, sans-serif", direction: "rtl", boxShadow: "0 8px 32px rgba(31, 52, 39, .12)", border: "1px solid #d8dfda" }}>
              <div style={{ border: "2px solid #203b2e", minHeight: 950, padding: "22px 24px", display: "flex", flexDirection: "column" }}>
                <header style={{ textAlign: "center", borderBottom: "1px solid #52675a", paddingBottom: 14 }}>
                  <EditableField value={draft.details.institutionName} onChange={(value) => updateDetails("institutionName", value)} ariaLabel="اسم المؤسسة" style={{ textAlign: "center", fontSize: 24, fontWeight: 800 }} />
                  <EditableField value={draft.details.address} onChange={(value) => updateDetails("address", value)} ariaLabel="عنوان المؤسسة" style={{ textAlign: "center", fontSize: 15, color: "#52675a", marginTop: 2 }} />
                  <EditableField value={draft.details.title} onChange={(value) => updateDetails("title", value)} ariaLabel="عنوان الفاتورة" style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#1c6b46", marginTop: 12 }} />
                </header>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: "1px solid #27382e", marginTop: 18 }}>
                  {[
                    ["dateLabel", "date", "تاريخ الفاتورة", "date"],
                    ["invoiceNumberLabel", "invoiceNumber", "رقم الفاتورة", "text"],
                    ["sourceLabel", "sourceName", "المصدر", "text"],
                    ["facilityNumberLabel", "facilityNumber", "رقم المنشأة", "text"],
                  ].map(([labelKey, valueKey, aria, type], index) => (
                    <div key={labelKey} style={{ padding: "8px 10px", borderLeft: index === 0 ? "none" : "1px solid #27382e", minWidth: 0 }}>
                      <EditableField value={draft.details[labelKey as keyof ExportDetails] as string} onChange={(value) => updateDetails(labelKey as keyof ExportDetails, value as never)} ariaLabel={`${aria} - العنوان`} style={{ fontSize: 11, fontWeight: 700, color: "#52675a", textAlign: "center" }} />
                      <div style={{ height: 1, background: "#aab7ae", margin: "4px 0" }} />
                      <EditableField value={draft.details[valueKey as keyof ExportDetails] as string} onChange={(value) => updateDetails(valueKey as keyof ExportDetails, value as never)} ariaLabel={`${aria} - القيمة`} type={type} style={{ fontSize: 13, fontWeight: 700, textAlign: "center" }} />
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #9aa89e", padding: "12px 4px 10px", marginBottom: 16 }}>
                  <EditableField value={draft.details.destinationLabel} onChange={(value) => updateDetails("destinationLabel", value)} ariaLabel="عنوان المصدر إليه" style={{ width: 130, fontWeight: 700, fontSize: 13, color: "#203b2e" }} />
                  <EditableField value={draft.details.destination} onChange={(value) => updateDetails("destination", value)} ariaLabel="جهة المصدر إليها" placeholder="اكتب الجهة أو العميل" style={{ flex: 1, fontSize: 14 }} />
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#203b2e", color: "#fff" }}>
                      <th colSpan={2} style={{ border: "1px solid #14251c", padding: "7px 4px" }}>
                        <EditableField value={draft.details.totalLabel} onChange={(value) => updateDetails("totalLabel", value)} ariaLabel="عنوان القيمة الإجمالية" style={{ color: "#fff", textAlign: "center", fontWeight: 800, fontSize: 11 }} />
                      </th>
                      <th style={{ border: "1px solid #14251c", padding: "7px 4px" }}>
                        <EditableField value={draft.details.productLabel} onChange={(value) => updateDetails("productLabel", value)} ariaLabel="عنوان الصنف" style={{ color: "#fff", textAlign: "center", fontWeight: 800, fontSize: 11 }} />
                      </th>
                      <th colSpan={2} style={{ border: "1px solid #14251c", padding: "7px 4px" }}>
                        <EditableField value={draft.details.weightLabel} onChange={(value) => updateDetails("weightLabel", value)} ariaLabel="عنوان الوزن" style={{ color: "#fff", textAlign: "center", fontWeight: 800, fontSize: 11 }} />
                      </th>
                      <th style={{ border: "1px solid #14251c", padding: "7px 4px" }}>
                        <EditableField value={draft.details.quantityLabel} onChange={(value) => updateDetails("quantityLabel", value)} ariaLabel="عنوان الكمية" style={{ color: "#fff", textAlign: "center", fontWeight: 800, fontSize: 11 }} />
                      </th>
                      <th style={{ border: "1px solid #14251c", padding: "7px 4px" }}>
                        <EditableField value={draft.details.originLabel} onChange={(value) => updateDetails("originLabel", value)} ariaLabel="عنوان المنشأ" style={{ color: "#fff", textAlign: "center", fontWeight: 800, fontSize: 11 }} />
                      </th>
                      <th style={{ border: "1px solid #14251c", padding: "7px 4px" }}>
                        <EditableField value={draft.details.notesLabel} onChange={(value) => updateDetails("notesLabel", value)} ariaLabel="عنوان الملاحظات" style={{ color: "#fff", textAlign: "center", fontWeight: 800, fontSize: 11 }} />
                      </th>
                      <th className="export-pdf-hide" style={{ width: 28, border: "1px solid #14251c" }} />
                    </tr>
                    <tr style={{ background: "#eef4ef", color: "#203b2e" }}>
                      <th style={{ border: "1px solid #27382e", padding: 5 }}><EditableField value={draft.details.filsLabel} onChange={(value) => updateDetails("filsLabel", value)} ariaLabel="عنوان الفلس" style={{ textAlign: "center", fontWeight: 700, fontSize: 10 }} /></th>
                      <th style={{ border: "1px solid #27382e", padding: 5 }}><EditableField value={draft.details.dinarLabel} onChange={(value) => updateDetails("dinarLabel", value)} ariaLabel="عنوان الدينار" style={{ textAlign: "center", fontWeight: 700, fontSize: 10 }} /></th>
                      <th style={{ border: "1px solid #27382e", padding: 5 }} />
                      <th style={{ border: "1px solid #27382e", padding: 5 }}><EditableField value={draft.details.grossWeightLabel} onChange={(value) => updateDetails("grossWeightLabel", value)} ariaLabel="عنوان الوزن القائم" style={{ textAlign: "center", fontWeight: 700, fontSize: 10 }} /></th>
                      <th style={{ border: "1px solid #27382e", padding: 5 }}><EditableField value={draft.details.netWeightLabel} onChange={(value) => updateDetails("netWeightLabel", value)} ariaLabel="عنوان الوزن الصافي" style={{ textAlign: "center", fontWeight: 700, fontSize: 10 }} /></th>
                      <th style={{ border: "1px solid #27382e", padding: 5 }} />
                      <th style={{ border: "1px solid #27382e", padding: 5 }} />
                      <th style={{ border: "1px solid #27382e", padding: 5 }} />
                      <th className="export-pdf-hide" style={{ border: "1px solid #27382e" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.rows.map((row) => (
                      <tr key={row.id}>
                        <td style={{ border: "1px solid #27382e", padding: 4 }}><EditableField value={row.totalFils} onChange={(value) => updateRow(row.id, "totalFils", value)} ariaLabel="فلس البند" inputMode="numeric" style={{ textAlign: "center", fontSize: 11 }} /></td>
                        <td style={{ border: "1px solid #27382e", padding: 4 }}><EditableField value={row.totalDinar} onChange={(value) => updateRow(row.id, "totalDinar", value)} ariaLabel="دينار البند" inputMode="decimal" style={{ textAlign: "center", fontSize: 11 }} /></td>
                        <td style={{ border: "1px solid #27382e", padding: 4 }}><EditableField value={row.product} onChange={(value) => updateRow(row.id, "product", value)} ariaLabel="صنف البند" placeholder="الصنف" style={{ textAlign: "right", fontSize: 11 }} /></td>
                        <td style={{ border: "1px solid #27382e", padding: 4 }}><EditableField value={row.grossWeight} onChange={(value) => updateRow(row.id, "grossWeight", value)} ariaLabel="الوزن القائم للبند" inputMode="decimal" style={{ textAlign: "center", fontSize: 11 }} /></td>
                        <td style={{ border: "1px solid #27382e", padding: 4 }}><EditableField value={row.netWeight} onChange={(value) => updateRow(row.id, "netWeight", value)} ariaLabel="الوزن الصافي للبند" inputMode="decimal" style={{ textAlign: "center", fontSize: 11 }} /></td>
                        <td style={{ border: "1px solid #27382e", padding: 4 }}><EditableField value={row.quantity} onChange={(value) => updateRow(row.id, "quantity", value)} ariaLabel="كمية البند" inputMode="decimal" style={{ textAlign: "center", fontSize: 11 }} /></td>
                        <td style={{ border: "1px solid #27382e", padding: 4 }}><EditableField value={row.origin} onChange={(value) => updateRow(row.id, "origin", value)} ariaLabel="منشأ البند" style={{ textAlign: "center", fontSize: 11 }} /></td>
                        <td style={{ border: "1px solid #27382e", padding: 4 }}><EditableField value={row.notes} onChange={(value) => updateRow(row.id, "notes", value)} ariaLabel="ملاحظات البند" style={{ textAlign: "right", fontSize: 11 }} /></td>
                        <td className="export-pdf-hide" style={{ border: "1px solid #27382e", textAlign: "center" }}>
                          <button onClick={() => setDraft((current) => ({ ...current, rows: current.rows.length > 1 ? current.rows.filter((item) => item.id !== row.id) : current.rows }))} className="text-slate-400 hover:text-red-600" title="حذف البند" aria-label="حذف البند"><X className="mx-auto h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#eef4ef", fontWeight: 800 }}>
                      <td style={{ border: "1px solid #27382e", padding: "8px 4px", textAlign: "center" }}>{calculatedTotal.fils}</td>
                      <td style={{ border: "1px solid #27382e", padding: "8px 4px", textAlign: "center" }}>{calculatedTotal.dinar}</td>
                      <td colSpan={6} style={{ border: "1px solid #27382e", padding: "8px 10px", textAlign: "right" }}>
                        <EditableField value={draft.details.sumLabel} onChange={(value) => updateDetails("sumLabel", value)} ariaLabel="تسمية المجموع أسفل الجدول" style={{ fontWeight: 800, fontSize: 12 }} />
                      </td>
                      <td className="export-pdf-hide" style={{ border: "1px solid #27382e" }} />
                    </tr>
                  </tfoot>
                </table>

                <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #9aa89e", padding: "10px 4px", marginTop: 10 }}>
                  <EditableField value={draft.details.totalInWordsLabel} onChange={(value) => updateDetails("totalInWordsLabel", value)} ariaLabel="عنوان المجموع كتابةً" style={{ width: 130, fontWeight: 700, fontSize: 12, color: "#203b2e" }} />
                  <EditableField value={draft.details.totalInWords} onChange={(value) => updateDetails("totalInWords", value)} ariaLabel="المجموع كتابةً" placeholder="اكتب المجموع بالحروف" style={{ flex: 1, fontSize: 13 }} />
                </div>

                <button onClick={() => setDraft((current) => ({ ...current, rows: [...current.rows, newRow()] }))} className="export-pdf-hide mt-2 flex items-center gap-1 self-start text-xs font-bold text-[#1c6b46] hover:text-[#155437]">
                  <Plus className="h-3.5 w-3.5" /> إضافة بند
                </button>

                <div style={{ marginTop: 24, borderTop: "1px solid #9aa89e", paddingTop: 14 }}>
                  <EditableText value={draft.details.certificateText} onChange={(value) => updateDetails("certificateText", value)} ariaLabel="نص الشهادة" rows={3} style={{ fontSize: 13, lineHeight: 1.9, textAlign: "right" }} />
                  <EditableField value={draft.details.exportPermissionText} onChange={(value) => updateDetails("exportPermissionText", value)} ariaLabel="عبارة السماح بالتصدير" style={{ textAlign: "center", fontSize: 16, fontWeight: 800, color: "#203b2e", marginTop: 10 }} />
                </div>

                <div style={{ display: "flex", direction: "ltr", justifyContent: "flex-start", alignItems: "flex-end", marginTop: "auto", paddingTop: 25 }}>
                  <div style={{ width: 160, textAlign: "center", direction: "ltr" }}>
                    <EditableField value={draft.details.stampLabel} onChange={(value) => updateDetails("stampLabel", value)} ariaLabel="عنوان الختم" style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "#52675a" }} />
                    <img src={draft.stampUrl || "/stamp-qadri.png"} alt="ختم المؤسسة" crossOrigin="anonymous" style={{ width: 125, height: 125, objectFit: "contain", margin: "6px auto 0" }} />
                  </div>
                  <div className="no-print export-pdf-hide" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input ref={stampInputRef} type="file" accept="image/*" hidden onChange={handleStampChange} />
                    <button onClick={() => stampInputRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-[#b9d1bf] bg-[#f4faf5] px-2.5 py-2 text-xs font-bold text-[#1c6b46]"><ImagePlus className="h-3.5 w-3.5" /> تغيير الختم</button>
                    <button onClick={() => { setDraft((current) => ({ ...current, stampUrl: "/stamp-qadri.png" })); setSaved(false); }} className="flex items-center gap-1.5 rounded-lg border border-[#e1e7e2] bg-white px-2.5 py-2 text-xs font-bold text-slate-500"><RotateCcwIcon /> افتراضي</button>
                  </div>
                </div>
                <img src={fallbackLogo} alt="" crossOrigin="anonymous" style={{ display: "none" }} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function RotateCcwIcon() {
  return <span aria-hidden="true" className="text-sm">↺</span>;
}

async function prepareForServer(record: ExportInvoiceRecord): Promise<Record<string, unknown>> {
  const stampUrl = record.stampUrl?.startsWith("data:")
    ? await uploadImageBase64(record.stampUrl)
    : record.stampUrl;
  return { details: record.details, rows: record.rows, stampUrl };
}