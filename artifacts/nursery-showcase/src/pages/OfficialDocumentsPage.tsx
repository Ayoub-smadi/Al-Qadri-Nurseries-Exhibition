import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ArrowRight, Check, Download, FileDown, FilePlus2, ImagePlus, Loader2, Pencil, Plus, Search, Stamp, Trash2, X } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { navigate } from "@/App";
import { useApp } from "@/lib/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { deleteOfficialDocument, fetchOfficialDocuments, loadSavedToken, migrateAllLegacyImages, uploadImageBase64, upsertOfficialDocument } from "@/lib/storage";

const STORAGE_KEY = "alqadri_official_documents";

export interface OfficialDocumentRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  documentNumber: string;
  issueDate: string;
  bismillah: string;
  heading: string;
  recipient: string;
  greeting: string;
  testifiesText: string;
  institution: string;
  ownerPrefix: string;
  owner: string;
  bringingPrefix: string;
  seedlings: string;
  varietyPrefix: string;
  variety: string;
  sourcePrefix: string;
  source: string;
  locationPrefix: string;
  sourceLocation: string;
  locationSeparator: string;
  sourceGovernorate: string;
  sourceCountry: string;
  sentenceEnd: string;
  producedFrom: string;
  bodyHealth: string;
  bodyWarranty: string;
  bodyCommitment: string;
  closing: string;
  institutionLabel: string;
  institutionName: string;
  ownerLabel: string;
  ownerName: string;
  signatureLabel: string;
  signatureName: string;
  stampLabel: string;
  dateLabel: string;
  dateValue: string;
  logoUrl: string;
  stampUrl: string;
}

const today = () => new Date().toLocaleDateString("ar-JO");
const toArabicDigits = (value: string) => value.replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);

function normalizeDocument(record: OfficialDocumentRecord): OfficialDocumentRecord {
  return {
    ...record,
    documentNumber: toArabicDigits(record.documentNumber || ""),
    testifiesText: record.testifiesText ?? "تشهد ",
    ownerPrefix: record.ownerPrefix ?? "، ومالكها السيد ",
    bringingPrefix: record.bringingPrefix ?? "، بأنها بصدد جلب شتلات ",
    varietyPrefix: record.varietyPrefix ?? " من صنف ",
    sourcePrefix: record.sourcePrefix ?? " من ",
    locationPrefix: record.locationPrefix ?? " الكائن في ",
    locationSeparator: record.locationSeparator ?? " – ",
    sentenceEnd: record.sentenceEnd ?? ".",
  };
}

function makeId() {
  return `official-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultDocument(logoUrl = ""): OfficialDocumentRecord {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    createdAt: now,
    updatedAt: now,
    documentNumber: "٠١ / ٢٠٢٦",
    issueDate: today(),
    bismillah: "بسم الله الرحمن الرحيم",
    heading: "كتاب رسمي / شهادة وتعهد",
    recipient: "إلى السادة:",
    greeting: "تحية طيبة وبعد،،،",
    testifiesText: "تشهد ",
    institution: "",
    ownerPrefix: "، ومالكها السيد ",
    owner: "",
    bringingPrefix: "، بأنها بصدد جلب شتلات ",
    seedlings: "",
    varietyPrefix: " من صنف ",
    variety: "",
    sourcePrefix: " من ",
    source: "",
    locationPrefix: " الكائن في ",
    sourceLocation: "",
    locationSeparator: " – ",
    sourceGovernorate: "",
    sourceCountry: "",
    sentenceEnd: ".",
    producedFrom: "",
    bodyHealth: "ونؤكد أن الشتلات ناتجة عن ، وسليمة وخالية من الأمراض والآفات الحشرية والفطرية، ومطابقة للمواصفات المطلوبة.",
    bodyWarranty: "كما أن الشتلات مكفولة من المشتل المصدر من حيث الصنف والحالة الصحية، وسيتم إرفاق نسخة من شهادة الكفالة والمستندات والوثائق اللازمة حسب الأصول.",
    bodyCommitment: "وتتعهد المؤسسة بأن تكون الشتلات مطابقة للصنف والعدد والمواصفات المطلوبة، وفقًا للإجراءات والاشتراطات والتعليمات الرسمية المعمول بها.",
    closing: "وتفضلوا بقبول فائق الاحترام والتقدير،،،",
    institutionLabel: "اسم المؤسسة",
    institutionName: "",
    ownerLabel: "اسم المالك / المفوض",
    ownerName: "",
    signatureLabel: "التوقيع",
    signatureName: "",
    stampLabel: "الختم",
    dateLabel: "التاريخ",
    dateValue: "",
    logoUrl: logoUrl || "/logo-alkadri.jpg",
    stampUrl: "/stamp-qadri.png",
  };
}

function loadDocuments(): OfficialDocumentRecord[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.map((record) => normalizeDocument(record)) : [];
  } catch {
    return [];
  }
}

function saveDocuments(records: OfficialDocumentRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch { /* local cache is best-effort; the server is the source of truth */ }
}

async function makeServerDocument(record: OfficialDocumentRecord): Promise<OfficialDocumentRecord> {
  const resolveImage = async (value: string) => (
    value.startsWith("data:") ? uploadImageBase64(value) : value
  );
  return {
    ...record,
    logoUrl: await resolveImage(record.logoUrl),
    stampUrl: await resolveImage(record.stampUrl),
  };
}

function Field({
  value,
  onChange,
  className = "",
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel: string;
}) {
  return (
      <input
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
        size={Math.max(value.length, 3)}
      onChange={(event) => onChange(event.target.value)}
      className={`official-paper-field ${className}`}
    />
  );
}

function TextField({
  value,
  onChange,
  className = "",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`official-paper-field official-paper-textarea ${className}`}
      rows={3}
    />
  );
}

function readImage(file: File, onRead: (dataUrl: string) => void) {
  if (!file.type.startsWith("image/")) {
    toast.error("يرجى اختيار ملف صورة");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => onRead(String(reader.result));
  reader.onerror = () => toast.error("تعذر قراءة الصورة");
  reader.readAsDataURL(file);
}

export default function OfficialDocumentsPage() {
  const { siteData, isAdmin } = useApp();
  const fallbackLogo = siteData.logo?.customUrl || "/logo-alkadri.jpg";
  const [records, setRecords] = useState<OfficialDocumentRecord[]>(() => loadDocuments());
  const [draft, setDraft] = useState<OfficialDocumentRecord>(() => createDefaultDocument(fallbackLogo));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportAfterLoad, setExportAfterLoad] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    void (async () => {
      void migrateAllLegacyImages();
      const serverRecords = await fetchOfficialDocuments();
      if (serverRecords === null || !active) return;

      const localRecords = loadDocuments();
      const serverIds = new Set(serverRecords.map((record: OfficialDocumentRecord) => record.id));
      const localOnly = localRecords.filter((record) => !serverIds.has(record.id));

      // Import records created before central storage was enabled. Uploaded images
      // become permanent /api/images URLs before the JSON record is written.
      for (const localRecord of localOnly) {
        try {
          const prepared = await makeServerDocument(localRecord);
          await upsertOfficialDocument(prepared as unknown as Record<string, unknown>, prepared.id);
        } catch (error) {
          console.warn("[official-documents] migration skipped", error);
        }
      }

      const refreshed = localOnly.length > 0 ? await fetchOfficialDocuments() : serverRecords;
      if (active && refreshed) {
        const normalized = (refreshed as OfficialDocumentRecord[]).map(normalizeDocument);
        setRecords(normalized);
        saveDocuments(normalized);
      }
    })();
    return () => { active = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (!draft.logoUrl || draft.logoUrl === "/logo-alkadri.jpg") {
      setDraft((current) => ({ ...current, logoUrl: current.logoUrl || fallbackLogo }));
    }
  }, [fallbackLogo]);

  const update = (key: keyof OfficialDocumentRecord) => (value: string) => {
    setDraft((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
    setSaved(false);
  };

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...records]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .filter((record) => !term || `${record.heading} ${record.documentNumber} ${record.recipient}`.toLowerCase().includes(term));
  }, [records, search]);

  const handleNew = () => {
    setDraft(createDefaultDocument(fallbackLogo));
    setSelectedId(null);
    setSaved(false);
  };

  const handleSave = async () => {
    if (saving) return;
    const record = { ...draft, updatedAt: new Date().toISOString() };
    setSaving(true);
    try {
      if (loadSavedToken()) {
        const prepared = await makeServerDocument(record);
        const serverRecord = await upsertOfficialDocument(prepared as unknown as Record<string, unknown>, prepared.id);
        if (!serverRecord) {
          toast.error("فشل الحفظ المركزي — تحقق من تسجيل الدخول والاتصال");
          return;
        }
        const savedRecord = serverRecord as OfficialDocumentRecord;
        const next = records.some((item) => item.id === savedRecord.id)
          ? records.map((item) => (item.id === savedRecord.id ? savedRecord : item))
          : [savedRecord, ...records];
        setRecords(next);
        saveDocuments(next);
        setDraft(savedRecord);
        setSelectedId(savedRecord.id);
        setSaved(true);
        toast.success("تم حفظ الكتاب الرسمي في السجل المركزي");
        return;
      }

      // Keep the existing local path useful while the admin is not signed in.
      const next = records.some((item) => item.id === record.id)
        ? records.map((item) => (item.id === record.id ? record : item))
        : [record, ...records];
      setRecords(next);
      saveDocuments(next);
      setDraft(record);
      setSelectedId(record.id);
      setSaved(true);
      toast.success("تم الحفظ محلياً — سجّل الدخول لمشاركته بين الأجهزة");
    } catch (error) {
      toast.error(`فشل حفظ الكتاب: ${(error as Error).message || "خطأ غير معروف"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = (record: OfficialDocumentRecord) => {
    setDraft(normalizeDocument(record));
    setSelectedId(record.id);
    setSaved(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("هل تريد حذف هذا الكتاب من السجل؟")) return;
    if (loadSavedToken()) {
      const deleted = await deleteOfficialDocument(id);
      if (!deleted) {
        toast.error("فشل حذف الكتاب من السجل المركزي");
        return;
      }
    }
    const next = records.filter((record) => record.id !== id);
    setRecords(next);
    saveDocuments(next);
    if (selectedId === id) handleNew();
    toast.success("تم حذف الكتاب الرسمي");
  };

  const exportPdf = async () => {
    if (!paperRef.current) return;
    const button = document.activeElement as HTMLElement | null;
    button?.blur();
    const sourcePaper = paperRef.current;
    const pdfPaper = sourcePaper.cloneNode(true) as HTMLDivElement;
    pdfPaper.classList.add("official-pdf-render");
    pdfPaper.style.width = "794px";
    pdfPaper.style.minHeight = "1123px";
    pdfPaper.style.margin = "0";
    pdfPaper.style.boxShadow = "none";

    // html2canvas can render native form controls blurry or with misplaced
    // Arabic text. Replace them with ordinary text nodes in the PDF clone.
    pdfPaper.querySelectorAll("input, textarea").forEach((field) => {
      const isTextarea = field.tagName.toLowerCase() === "textarea";
      const value = (field as HTMLInputElement | HTMLTextAreaElement).value;
      const replacement = document.createElement(isTextarea ? "div" : "span");
      replacement.className = `${field.className} official-pdf-value`;
      replacement.textContent = value;
      replacement.setAttribute("dir", "auto");
      replacement.style.border = "0";
      replacement.style.background = "transparent";
      replacement.style.outline = "none";
      replacement.style.cursor = "default";
      replacement.style.transition = "none";
      if (isTextarea) {
        replacement.style.display = "block";
        replacement.style.width = "100%";
        replacement.style.height = "auto";
        replacement.style.minHeight = "0";
        replacement.style.whiteSpace = "pre-wrap";
        replacement.style.overflow = "visible";
        replacement.style.overflowWrap = "break-word";
      }
      field.replaceWith(replacement);
    });

    const host = document.createElement("div");
    host.className = "official-pdf-host";
    host.appendChild(pdfPaper);
    document.body.appendChild(host);

    try {
      await document.fonts.ready;
      const images = Array.from(host.querySelectorAll("img"));
      await Promise.all(images.map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }));
      const canvas = await html2canvas(pdfPaper, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      pdf.addImage(canvas.toDataURL("PNG"), "PNG", 0, 0, 210, 297);
      const safeNumber = (draft.documentNumber || "جديد").replace(/[^\u0600-\u06FFa-zA-Z0-9-_]/g, "_");
      pdf.save(`كتاب_رسمي_${safeNumber}.pdf`);
      toast.success("تم تنزيل الكتاب بصيغة PDF");
    } catch {
      toast.error("تعذر إنشاء ملف PDF، حاول مرة أخرى");
    } finally {
      host.remove();
    }
  };

  useEffect(() => {
    if (!exportAfterLoad) return;
    setExportAfterLoad(false);
    const frame = window.requestAnimationFrame(() => void exportPdf());
    return () => window.cancelAnimationFrame(frame);
  }, [exportAfterLoad, draft]);

  const handleHistoryExport = (record: OfficialDocumentRecord) => {
    setDraft(record);
    setSelectedId(record.id);
    setExportAfterLoad(true);
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>, key: "logoUrl" | "stampUrl") => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) readImage(file, update(key));
  };

  return (
    <main dir="rtl" className="official-documents-page min-h-screen bg-[#f4f6f3] text-slate-900">
      <header className="official-documents-header no-print">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate("/")} className="official-icon-button" aria-label="العودة للرئيسية" title="العودة للرئيسية">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="official-header-mark"><FilePlus2 className="h-4 w-4" /></span>
              <h1 className="truncate text-lg font-black text-[#153d2b]">كتب رسمية</h1>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">محرر الكتب والشهادات والتعهدات</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleNew} className="gap-2 rounded-xl border-[#d6e0d8] bg-white arabic">
            <Plus className="h-4 w-4" /> كتاب جديد
          </Button>
           <Button onClick={() => void handleSave()} disabled={saving} className="gap-2 rounded-xl bg-[#1c6b46] text-white hover:bg-[#155437] arabic">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            {saving ? "جاري الحفظ..." : saved ? "محفوظ" : "حفظ في السجل"}
          </Button>
        </div>
      </header>

      <div className="official-documents-layout mx-auto max-w-[1500px] px-4 py-5 lg:px-6">
        <aside className="official-history-panel no-print">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-[#b08a45]">ARCHIVE</p>
              <h2 className="mt-1 text-xl font-black text-[#153d2b]">سجل الكتب</h2>
            </div>
            <span className="rounded-full bg-[#edf5ef] px-2.5 py-1 text-xs font-bold text-[#1c6b46]">{records.length}</span>
          </div>
          <div className="relative mb-4">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث في السجل..." className="h-10 rounded-xl border-[#dbe4dc] bg-[#fbfcfa] pr-9 text-right arabic" />
          </div>
          <button onClick={handleNew} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#aac7b2] bg-[#f4faf5] px-3 py-2.5 text-sm font-bold text-[#1c6b46] transition hover:bg-[#e8f4eb]">
            <Plus className="h-4 w-4" /> إنشاء كتاب جديد
          </button>
          <div className="space-y-2">
            {filteredRecords.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d8e1d9] px-4 py-10 text-center text-sm text-slate-400">
                <FilePlus2 className="mx-auto mb-2 h-8 w-8 text-[#b8cabc]" />
                لا توجد كتب محفوظة بعد
              </div>
            ) : filteredRecords.map((record) => (
              <div key={record.id} className={`official-history-card ${selectedId === record.id ? "is-selected" : ""}`}>
                <button onClick={() => handleOpen(record)} className="min-w-0 flex-1 text-right">
                  <span className="block truncate text-sm font-bold text-[#153d2b]">{record.heading || "كتاب رسمي"}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500">{record.documentNumber || "بدون رقم"} · {record.issueDate}</span>
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button onClick={() => handleHistoryExport(record)} className="official-small-button text-[#1c6b46]" title="تنزيل PDF" aria-label="تنزيل PDF">
                    <FileDown className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(record.id)} className="official-small-button text-slate-400 hover:text-red-600" title="حذف" aria-label="حذف">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="official-editor-area">
          <div className="official-editor-toolbar no-print">
            <div>
              <p className="text-xs font-bold text-[#b08a45]">LIVE DOCUMENT</p>
              <h2 className="mt-1 text-base font-black text-[#153d2b]">حرّر النص مباشرة داخل الورقة</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`hidden items-center gap-1.5 text-xs font-semibold sm:flex ${saved ? "text-[#1c6b46]" : "text-amber-600"}`}>
                <span className={`h-2 w-2 rounded-full ${saved ? "bg-[#1c6b46]" : "bg-amber-500"}`} />
                {saved ? "آخر نسخة محفوظة" : "تعديلات غير محفوظة"}
              </span>
              <Button variant="outline" onClick={exportPdf} className="gap-2 rounded-xl border-[#d6e0d8] bg-white arabic">
                <FileDown className="h-4 w-4 text-[#1c6b46]" /> تنزيل PDF
              </Button>
            </div>
          </div>

          <div ref={paperRef} className="official-paper" lang="ar">
            <div className="official-paper-outer-border" />
            <div className="official-paper-inner-border" />
            <div className="official-paper-content">
              <div className="official-paper-topline">
                <div className="official-paper-brand">
                  <img src={draft.logoUrl || fallbackLogo} alt="شعار المؤسسة" className="official-paper-logo" crossOrigin="anonymous" />
                  <Field value={draft.institution} onChange={update("institution")} className="official-paper-brand-name" ariaLabel="اسم المؤسسة في الترويسة" />
                </div>
                <div className="official-paper-meta">
                  <label>رقم الكتاب <Field value={draft.documentNumber} onChange={(value) => update("documentNumber")(toArabicDigits(value))} ariaLabel="رقم الكتاب" /></label>
                  <label>التاريخ <Field value={draft.issueDate} onChange={update("issueDate")} ariaLabel="تاريخ الكتاب" /></label>
                </div>
              </div>

              <div className="official-paper-bismillah">
                <Field value={draft.bismillah} onChange={update("bismillah")} ariaLabel="البسملة" />
              </div>
              <div className="official-paper-title-wrap">
                <Field value={draft.heading} onChange={update("heading")} className="official-paper-title" ariaLabel="عنوان الكتاب" />
                <span className="official-paper-title-rule" />
              </div>

              <div className="official-paper-salutation">
                <Field value={draft.recipient} onChange={update("recipient")} ariaLabel="الجهة المرسل إليها" />
                <Field value={draft.greeting} onChange={update("greeting")} ariaLabel="التحية" />
              </div>

              <div className="official-paper-body">
                 <p>
                   <Field value={draft.testifiesText} onChange={update("testifiesText")} ariaLabel="بداية عبارة التشهد" /><Field value={draft.institution} onChange={update("institution")} ariaLabel="اسم المؤسسة في نص الكتاب" /><Field value={draft.ownerPrefix} onChange={update("ownerPrefix")} ariaLabel="العبارة قبل اسم المالك" /><Field value={draft.owner} onChange={update("owner")} ariaLabel="اسم المالك" /><Field value={draft.bringingPrefix} onChange={update("bringingPrefix")} ariaLabel="عبارة جلب الشتلات" /><Field value={draft.seedlings} onChange={update("seedlings")} ariaLabel="نوع الشتلات" /><Field value={draft.varietyPrefix} onChange={update("varietyPrefix")} ariaLabel="العبارة قبل الصنف" /><Field value={draft.variety} onChange={update("variety")} ariaLabel="صنف الشتلات" /><Field value={draft.sourcePrefix} onChange={update("sourcePrefix")} ariaLabel="العبارة قبل المصدر" /><Field value={draft.source} onChange={update("source")} ariaLabel="مصدر الشتلات" /><Field value={draft.locationPrefix} onChange={update("locationPrefix")} ariaLabel="العبارة قبل مكان المصدر" /><Field value={draft.sourceLocation} onChange={update("sourceLocation")} ariaLabel="مكان المصدر" /><Field value={draft.locationSeparator} onChange={update("locationSeparator")} ariaLabel="الفاصل الأول للموقع" /><Field value={draft.sourceGovernorate} onChange={update("sourceGovernorate")} ariaLabel="محافظة المصدر" /><Field value={draft.locationSeparator} onChange={update("locationSeparator")} ariaLabel="الفاصل الثاني للموقع" /><Field value={draft.sourceCountry} onChange={update("sourceCountry")} ariaLabel="دولة المصدر" /><Field value={draft.sentenceEnd} onChange={update("sentenceEnd")} ariaLabel="نهاية الجملة" />
                </p>
                <TextField value={draft.bodyHealth} onChange={update("bodyHealth")} ariaLabel="فقرة سلامة الشتلات" />
                <TextField value={draft.bodyWarranty} onChange={update("bodyWarranty")} ariaLabel="فقرة الكفالة والمستندات" />
                <TextField value={draft.bodyCommitment} onChange={update("bodyCommitment")} ariaLabel="فقرة التعهد" />
              </div>

              <div className="official-paper-closing">
                <TextField value={draft.closing} onChange={update("closing")} ariaLabel="الخاتمة" />
              </div>

              <div className="official-paper-signatures">
                <div className="official-signature-block">
                  <Field value={draft.institutionLabel} onChange={update("institutionLabel")} ariaLabel="تسمية اسم المؤسسة" className="official-paper-label" />
                  <Field value={draft.institutionName} onChange={update("institutionName")} ariaLabel="قيمة اسم المؤسسة" className="official-paper-signature-line" />
                </div>
                <div className="official-signature-block">
                  <Field value={draft.ownerLabel} onChange={update("ownerLabel")} ariaLabel="تسمية اسم المالك" className="official-paper-label" />
                  <Field value={draft.ownerName} onChange={update("ownerName")} ariaLabel="قيمة اسم المالك" className="official-paper-signature-line" />
                </div>
                <div className="official-signature-block">
                  <Field value={draft.signatureLabel} onChange={update("signatureLabel")} ariaLabel="تسمية التوقيع" className="official-paper-label" />
                  <Field value={draft.signatureName} onChange={update("signatureName")} ariaLabel="قيمة التوقيع" className="official-paper-signature-line" />
                </div>
                <div className="official-stamp-block">
                  <Field value={draft.stampLabel} onChange={update("stampLabel")} ariaLabel="تسمية الختم" className="official-paper-label" />
                  <img src={draft.stampUrl || "/stamp-qadri.png"} alt="ختم المؤسسة" className="official-paper-stamp" crossOrigin="anonymous" />
                </div>
              </div>
              <div className="official-paper-footer-date">
                <Field value={draft.dateLabel} onChange={update("dateLabel")} ariaLabel="تسمية التاريخ" />
                <Field value={draft.dateValue} onChange={update("dateValue")} ariaLabel="قيمة التاريخ" />
              </div>
            </div>
          </div>

          <div className="official-assets-panel no-print">
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-[#b08a45]" />
              <div>
                <p className="text-sm font-bold text-[#153d2b]">هوية الكتاب</p>
                <p className="text-xs text-slate-500">استبدل الشعار أو الختم لهذا الكتاب فقط</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleImageChange(event, "logoUrl")} />
              <input ref={stampInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleImageChange(event, "stampUrl")} />
              <button onClick={() => logoInputRef.current?.click()} className="official-asset-button"><ImagePlus className="h-4 w-4" /> تغيير الشعار</button>
              <button onClick={() => stampInputRef.current?.click()} className="official-asset-button"><Stamp className="h-4 w-4" /> تغيير الختم</button>
              <button onClick={() => { update("logoUrl")(fallbackLogo); update("stampUrl")("/stamp-qadri.png"); }} className="official-asset-button"><X className="h-4 w-4" /> استعادة الافتراضي</button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}