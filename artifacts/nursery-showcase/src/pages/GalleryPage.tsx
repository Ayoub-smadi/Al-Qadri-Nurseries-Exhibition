import React, { useRef, useState, useCallback } from 'react';
import { useApp } from '@/lib/context';
import { Photo, Section, Branch } from '@/lib/storage';
import { downloadCatalogPDF, PDFSectionInput } from '@/lib/pdfGen';
import { toast } from 'sonner';
import {
  X, Plus, LogOut, Settings, ImagePlus, Moon, Sun,
  Pencil, Trash2, FolderPlus, FileDown, Loader2, ChevronDown, ChevronUp, MapPin,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

/* ── utils ─────────────────────────────────────────────── */
function uid() { return `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

async function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ── file upload helper ──────────────────────────────── */
function FileUploadBtn({ onFile, children, className }: {
  onFile: (b64: string) => void; children: React.ReactNode; className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return;
          onFile(await fileToBase64(f)); e.target.value = '';
        }} />
      <span onClick={() => ref.current?.click()} className={className ?? 'cursor-pointer'}>{children}</span>
    </>
  );
}

/* ── inline editable text ───────────────────────────── */
function InlineEdit({ value, onSave, className, style }: {
  value: string; onSave: (v: string) => void; className?: string; style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const save = () => { onSave(draft.trim() || value); setEditing(false); };
  if (!editing) return (
    <span className={`cursor-pointer group/ie ${className ?? ''}`} style={style}
      onDoubleClick={() => { setDraft(value); setEditing(true); }}>
      {value}
      <Pencil className="inline-block w-3 h-3 ms-1 opacity-0 group-hover/ie:opacity-40 transition-opacity shrink-0" />
    </span>
  );
  return (
    <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      className={`bg-transparent border-b-2 border-primary outline-none ${className ?? ''}`}
      style={{ ...style, minWidth: '6ch', width: `${Math.max(draft.length, 6)}ch` }} />
  );
}

/* ── PDF selection state type ────────────────────────── */
type PdfSel = Map<string, Set<string>>; // sectionId → Set<photoId>

function buildFullSelection(sections: Section[]): PdfSel {
  const m: PdfSel = new Map();
  for (const s of sections) {
    m.set(s.id, new Set(s.photos.map(p => p.id)));
  }
  return m;
}

/* ── PDF select modal ────────────────────────────────── */
function PDFSelectModal({ open, onClose, sections, lang, targetSectionId, titleAr, titleEn, logoUrl }: {
  open: boolean; onClose: () => void; sections: Section[]; lang: string;
  targetSectionId: string | null; titleAr: string; titleEn: string; logoUrl: string;
}) {
  const isAr = lang === 'ar';
  const visibleSections = targetSectionId ? sections.filter(s => s.id === targetSectionId) : sections;

  const [sel, setSel] = useState<PdfSel>(() => buildFullSelection(visibleSections));
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(visibleSections.map(s => s.id)));
  const [loading, setLoading] = useState(false);

  // Re-init when opened
  React.useEffect(() => {
    if (open) {
      setSel(buildFullSelection(visibleSections));
      setExpanded(new Set(visibleSections.map(s => s.id)));
    }
  }, [open, targetSectionId]); // eslint-disable-line

  const toggleSection = (sId: string) => {
    setSel(prev => {
      const next = new Map(prev);
      const sec = sections.find(s => s.id === sId)!;
      if (next.get(sId)?.size === sec.photos.length) {
        next.set(sId, new Set());
      } else {
        next.set(sId, new Set(sec.photos.map(p => p.id)));
      }
      return next;
    });
  };

  const togglePhoto = (sId: string, pId: string) => {
    setSel(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(sId) ?? []);
      if (set.has(pId)) set.delete(pId); else set.add(pId);
      next.set(sId, set);
      return next;
    });
  };

  const handleDownload = async () => {
    const inputs: PDFSectionInput[] = [];
    for (const s of visibleSections) {
      const chosen = sel.get(s.id) ?? new Set();
      const photos = s.photos.filter(p => chosen.has(p.id));
      if (photos.length > 0) inputs.push({ section: s, photos });
    }
    if (inputs.length === 0) {
      toast.error(isAr ? 'اختر صورة واحدة على الأقل' : 'Select at least one photo');
      return;
    }
    setLoading(true);
    try {
      const fname = targetSectionId
        ? `${visibleSections[0]?.nameAr ?? 'section'}.pdf`
        : 'alqadri-catalog.pdf';
      await downloadCatalogPDF(inputs, titleAr, titleEn, logoUrl, lang, fname);
      onClose();
    } catch (e) {
      toast.error(isAr ? 'حدث خطأ أثناء توليد PDF' : 'PDF generation failed');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const totalPhotos = [...sel.values()].reduce((a, s) => a + s.size, 0);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !loading) onClose(); }}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="arabic text-lg">
            {isAr ? (targetSectionId ? 'تنزيل PDF للقسم' : 'تنزيل كتالوج PDF') : (targetSectionId ? 'Download Section PDF' : 'Download Full Catalog PDF')}
          </DialogTitle>
        </DialogHeader>

        {/* Section + photo checkboxes */}
        <div className="overflow-y-auto flex-1 space-y-3 pr-1 my-2">
          {visibleSections.map(sec => {
            const secSel = sel.get(sec.id) ?? new Set();
            const allChecked = secSel.size === sec.photos.length;
            const someChecked = secSel.size > 0 && !allChecked;
            const isExpanded = expanded.has(sec.id);

            return (
              <div key={sec.id} className="border border-border rounded-xl overflow-hidden">
                {/* Section row */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/40">
                  <Checkbox
                    checked={allChecked}
                    data-state={someChecked ? 'indeterminate' : undefined}
                    onCheckedChange={() => toggleSection(sec.id)}
                    className="shrink-0"
                  />
                  <span className="font-bold arabic flex-1 text-sm">{isAr ? sec.nameAr : sec.nameEn}</span>
                  <span className="text-xs text-muted-foreground">{secSel.size}/{sec.photos.length}</span>
                  <button onClick={() => setExpanded(prev => {
                    const n = new Set(prev);
                    if (n.has(sec.id)) n.delete(sec.id); else n.add(sec.id);
                    return n;
                  })} className="text-muted-foreground hover:text-foreground transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Photos grid */}
                {isExpanded && sec.photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2.5 p-3 bg-background/50">
                    {sec.photos.map(photo => {
                      const checked = secSel.has(photo.id);
                      return (
                        <label key={photo.id}
                          className={`relative cursor-pointer rounded-lg overflow-hidden aspect-square border-2 transition-all ${checked ? 'border-primary shadow-sm' : 'border-transparent opacity-50'}`}
                          onClick={() => togglePhoto(sec.id, photo.id)}>
                          <img src={photo.image} alt={isAr ? photo.nameAr : photo.nameEn}
                            className="w-full h-full object-cover" />
                          <div className={`absolute inset-0 bg-primary/20 transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`} />
                          <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1.5 py-1">
                            <p className="text-white text-[10px] font-semibold truncate arabic text-center leading-tight">
                              {isAr ? photo.nameAr : photo.nameEn}
                            </p>
                          </div>
                          {checked && (
                            <div className="absolute top-1 end-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between pt-3 border-t border-border">
          <span className="text-sm text-muted-foreground arabic">
            {isAr ? `${totalPhotos} صورة مختارة` : `${totalPhotos} photos selected`}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleDownload} disabled={loading || totalPhotos === 0}
              className="bg-primary text-primary-foreground min-w-[110px]">
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin me-1.5" />{isAr ? 'جاري التوليد...' : 'Generating...'}</>
              ) : (
                <><FileDown className="w-4 h-4 me-1.5" />{isAr ? 'تنزيل PDF' : 'Download PDF'}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ══ MAIN PAGE ═══════════════════════════════════════════ */
export default function GalleryPage() {
  const { lang, setLang, isDark, toggleDark, isAdmin, setIsAdmin, siteData, updateSiteData } = useApp();
  const isAr = lang === 'ar';

  /* login */
  const [loginOpen, setLoginOpen] = useState(false);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loginErr, setLoginErr] = useState('');

  /* add photo */
  const [addPhotoSectionId, setAddPhotoSectionId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoNameAr, setPhotoNameAr] = useState('');
  const [photoNameEn, setPhotoNameEn] = useState('');

  /* add section */
  const [addSecOpen, setAddSecOpen] = useState(false);
  const [secNameAr, setSecNameAr] = useState('');
  const [secNameEn, setSecNameEn] = useState('');

  /* footer */
  const [footerOpen, setFooterOpen] = useState(false);
  const [footerDraft, setFooterDraft] = useState({ ...siteData.footer });

  /* PDF select modal */
  const [pdfModalTarget, setPdfModalTarget] = useState<string | null | 'all'>('closed');
  const pdfModalOpen = pdfModalTarget !== 'closed';

  /* branches */
  const [addBranchOpen, setAddBranchOpen] = useState(false);
  const [branchNameAr, setBranchNameAr] = useState('');
  const [branchNameEn, setBranchNameEn] = useState('');
  const [branchLocation, setBranchLocation] = useState('');
  const [branchImageUrl, setBranchImageUrl] = useState('');

  /* ── handlers ── */
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (user === 'Ayoub' && pass === 'Ayoub@123') {
      setIsAdmin(true); setLoginOpen(false); setUser(''); setPass(''); setLoginErr('');
    } else setLoginErr(isAr ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials');
  };

  const handleAddPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl || !addPhotoSectionId) return;
    const photo: Photo = { id: uid(), image: photoUrl, nameAr: photoNameAr, nameEn: photoNameEn };
    updateSiteData({ sections: siteData.sections.map(s => s.id === addPhotoSectionId ? { ...s, photos: [...s.photos, photo] } : s) });
    setPhotoUrl(''); setPhotoNameAr(''); setPhotoNameEn(''); setAddPhotoSectionId(null);
    toast.success(isAr ? 'تمت إضافة الصورة' : 'Photo added');
  };

  const handleDeletePhoto = (sectionId: string, photoId: string) => {
    if (!confirm(isAr ? 'حذف الصورة؟' : 'Delete this photo?')) return;
    updateSiteData({ sections: siteData.sections.map(s => s.id === sectionId ? { ...s, photos: s.photos.filter(p => p.id !== photoId) } : s) });
  };

  const handleDeleteSection = (id: string) => {
    if (!confirm(isAr ? 'حذف القسم وجميع صوره؟' : 'Delete this section and all photos?')) return;
    updateSiteData({ sections: siteData.sections.filter(s => s.id !== id) });
  };

  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secNameAr && !secNameEn) return;
    updateSiteData({ sections: [...siteData.sections, { id: uid(), nameAr: secNameAr, nameEn: secNameEn, photos: [] }] });
    setSecNameAr(''); setSecNameEn(''); setAddSecOpen(false);
    toast.success(isAr ? 'تم إضافة القسم' : 'Section added');
  };

  const updateSectionName = useCallback((id: string, field: 'nameAr' | 'nameEn', val: string) => {
    updateSiteData({ sections: siteData.sections.map(s => s.id === id ? { ...s, [field]: val } : s) });
  }, [siteData.sections, updateSiteData]);

  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchNameAr && !branchNameEn) return;
    const branch: Branch = {
      id: uid(),
      nameAr: branchNameAr,
      nameEn: branchNameEn,
      image: branchImageUrl,
      locationUrl: branchLocation,
    };
    updateSiteData({ branches: [...(siteData.branches ?? []), branch] });
    setBranchNameAr(''); setBranchNameEn(''); setBranchLocation(''); setBranchImageUrl('');
    setAddBranchOpen(false);
    toast.success(isAr ? 'تمت إضافة الفرع' : 'Branch added');
  };

  const handleDeleteBranch = (id: string) => {
    if (!confirm(isAr ? 'حذف الفرع؟' : 'Delete this branch?')) return;
    updateSiteData({ branches: (siteData.branches ?? []).filter(b => b.id !== id) });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ── TOP CONTROLS ── */}
      <div className="no-print fixed top-3 start-3 flex items-center gap-2 z-50">
        <button onClick={() => setLang(isAr ? 'en' : 'ar')}
          className="h-8 px-3 rounded-full bg-card border border-border shadow-sm text-xs font-bold text-muted-foreground hover:text-foreground transition-all">
          {isAr ? 'EN' : 'ع'}
        </button>
        <button onClick={toggleDark}
          className="h-8 w-8 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {!isAdmin && (
        <button className="no-print fixed top-3 end-3 w-2.5 h-2.5 rounded-full bg-border hover:bg-primary transition-colors z-50"
          onClick={() => setLoginOpen(true)} aria-label="Admin" />
      )}

      {/* ── HEADER ── */}
      <header className="border-b border-border pb-0 overflow-hidden">

        {/* ── Top brand bar ── */}
        <div className="flex flex-col items-center pt-10 pb-6 px-8 md:px-16 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            {siteData.logo.customUrl ? (
              <div className="relative group/logo inline-block">
                <img src={siteData.logo.customUrl} alt="logo" className="w-28 h-auto object-contain drop-shadow-md" />
                {isAdmin && (
                  <FileUploadBtn onFile={url => updateSiteData({ logo: { customUrl: url } })}>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-lg">
                      <ImagePlus className="w-6 h-6 text-white" />
                    </div>
                  </FileUploadBtn>
                )}
              </div>
            ) : (
              <div className="relative group/logo inline-block drop-shadow-md">
                <TreeSVG />
                {isAdmin && (
                  <FileUploadBtn onFile={url => updateSiteData({ logo: { customUrl: url } })}>
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded">
                      <ImagePlus className="w-5 h-5 text-white" />
                    </div>
                  </FileUploadBtn>
                )}
              </div>
            )}
          </div>

          {/* Company Name */}
          <h1 className="text-3xl md:text-4xl font-bold arabic mb-1 leading-tight">
            {isAdmin
              ? <InlineEdit value={siteData.titleAr} onSave={v => updateSiteData({ titleAr: v })} className="arabic text-3xl md:text-4xl font-bold" />
              : siteData.titleAr}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground tracking-[0.2em] uppercase latin">
            {isAdmin
              ? <InlineEdit value={siteData.titleEn} onSave={v => updateSiteData({ titleEn: v })} className="latin tracking-widest uppercase" />
              : siteData.titleEn}
          </p>
        </div>

        {/* ── Decorative divider ── */}
        <div className="flex items-center justify-center gap-3 px-8">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-foreground/25 to-foreground/25" />
          <div className="flex gap-1.5 items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
            <div className="w-2.5 h-2.5 rounded-full bg-foreground/60" />
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
          </div>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent via-foreground/25 to-foreground/25" />
        </div>

        {/* ── Owner card ── */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-12 px-8 py-10">

          {/* Photo */}
          <div className="relative shrink-0">
            <div className="w-44 h-44 md:w-52 md:h-52 rounded-full overflow-hidden ring-[3px] ring-foreground/70 ring-offset-4 ring-offset-background shadow-2xl">
              <img
                src="/owner.png"
                alt="مهندس ثامر القادري"
                className="w-full h-full object-cover object-top scale-105"
              />
            </div>
            {/* decorative dot */}
            <div className="absolute -bottom-1 -end-1 w-6 h-6 rounded-full bg-foreground/70 shadow-md" />
          </div>

          {/* Info */}
          <div className="flex flex-col items-center md:items-start gap-2 text-center md:text-start">
            {/* Title badge */}
            <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold arabic bg-foreground/10 text-foreground border border-foreground/20 tracking-wide shadow-sm">
              المدير العام
            </span>

            {/* Name Arabic */}
            <h2 className="text-2xl md:text-3xl font-bold arabic text-foreground leading-snug mt-1">
              مهندس ثامر القادري
            </h2>

            {/* Name English */}
            <p className="text-sm text-muted-foreground latin tracking-widest uppercase">
              Eng. Thamer Al-Qadri
            </p>

            {/* Thin rule */}
            <div className="w-12 h-0.5 rounded-full bg-foreground/30 my-1" />

            {/* Phone */}
            <a
              href="tel:0777772211"
              className="flex items-center gap-2 hover:opacity-70 transition-opacity latin ltr"
              dir="ltr"
            >
              <span className="text-base">📞</span>
              <span className="text-base font-mono font-semibold tracking-widest text-foreground">0777772211</span>
            </a>
          </div>
        </div>
      </header>

      {/* ── SECTIONS ── */}
      <main className="flex-1 px-4 md:px-12 py-10 space-y-16">
        {siteData.sections.map(section => (
          <SectionBlock key={section.id}
            section={section} lang={lang} isAdmin={isAdmin}
            onUpdateName={(f, v) => updateSectionName(section.id, f, v)}
            onAddPhoto={() => setAddPhotoSectionId(section.id)}
            onDeletePhoto={pid => handleDeletePhoto(section.id, pid)}
            onDeleteSection={() => handleDeleteSection(section.id)}
            onDownloadPDF={() => setPdfModalTarget(section.id)}
          />
        ))}
        {siteData.sections.length === 0 && (
          <div className="text-center py-20 text-muted-foreground arabic">
            {isAr ? 'لا توجد أقسام بعد' : 'No sections yet'}
          </div>
        )}
      </main>

      {/* ── BRANCHES ── */}
      {((siteData.branches ?? []).length > 0 || isAdmin) && (
        <section className="px-4 md:px-12 py-12 border-t border-border bg-muted/30">
          {/* Section header */}
          <div className="flex items-center justify-center gap-4 mb-10">
            <div className="flex-1 h-px bg-foreground/15" />
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold arabic text-foreground">فروعنا</h2>
              <p className="text-xs text-muted-foreground tracking-widest uppercase latin mt-0.5">Our Branches</p>
            </div>
            <div className="flex-1 h-px bg-foreground/15" />
            {isAdmin && (
              <button
                onClick={() => setAddBranchOpen(true)}
                className="no-print shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="arabic">{isAr ? 'إضافة فرع' : 'Add Branch'}</span>
              </button>
            )}
          </div>

          {/* Branches grid */}
          {(siteData.branches ?? []).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed border-border rounded-2xl arabic">
              {isAr ? 'لا توجد فروع بعد — اضغط "إضافة فرع" لإضافة أول فرع' : 'No branches yet — click "Add Branch" to add one'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {(siteData.branches ?? []).map(branch => (
                <a
                  key={branch.id}
                  href={branch.locationUrl || '#'}
                  target={branch.locationUrl ? '_blank' : undefined}
                  rel="noreferrer"
                  onClick={e => { if (!branch.locationUrl) e.preventDefault(); }}
                  className="group relative flex flex-col rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 bg-card border border-border cursor-pointer"
                >
                  {/* Branch image */}
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    {branch.image ? (
                      <img
                        src={branch.image}
                        alt={isAr ? branch.nameAr : branch.nameEn}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <MapPin className="w-10 h-10 opacity-30" />
                      </div>
                    )}
                  </div>

                  {/* Branch info */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-foreground/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold arabic text-foreground text-sm leading-tight truncate">
                        {isAr ? branch.nameAr : branch.nameEn}
                      </p>
                      {branch.nameAr && branch.nameEn && (
                        <p className="text-xs text-muted-foreground latin truncate">
                          {isAr ? branch.nameEn : branch.nameAr}
                        </p>
                      )}
                    </div>
                    {branch.locationUrl && (
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors latin shrink-0">
                        ↗
                      </span>
                    )}
                  </div>

                  {/* Admin delete button */}
                  {isAdmin && (
                    <button
                      onClick={e => { e.preventDefault(); e.stopPropagation(); handleDeleteBranch(branch.id); }}
                      className="no-print absolute top-2 end-2 w-7 h-7 bg-black/55 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 backdrop-blur-sm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-4 px-8 bg-card">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-foreground/60 text-center">
          {siteData.footer.email && <a href={`mailto:${siteData.footer.email}`} className="hover:text-foreground transition-colors whitespace-nowrap">{siteData.footer.email}</a>}
          {siteData.footer.phone && <span dir="ltr" className="whitespace-nowrap font-mono">{siteData.footer.phone}</span>}
          {siteData.footer.website && <a href={siteData.footer.website.startsWith('http') ? siteData.footer.website : `https://${siteData.footer.website}`} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors whitespace-nowrap">{siteData.footer.website}</a>}
          {(isAr ? siteData.footer.noteAr : siteData.footer.noteEn) && (
            <span className="arabic whitespace-nowrap">{isAr ? siteData.footer.noteAr : siteData.footer.noteEn}</span>
          )}
        </div>
      </footer>

      {/* ── ADMIN TOOLBAR ── */}
      {isAdmin && (
        <div className="no-print fixed bottom-5 start-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-4 py-2 rounded-full bg-card/95 backdrop-blur-xl border border-primary/30 shadow-2xl">
          <span className="text-xs font-bold text-primary pe-2 border-e border-border arabic">{isAr ? 'تحرير' : 'Edit'}</span>
          <ToolBtn icon={<FolderPlus className="w-3.5 h-3.5" />} label={isAr ? 'قسم جديد' : 'New Section'} onClick={() => setAddSecOpen(true)} />
          <ToolBtn icon={<MapPin className="w-3.5 h-3.5" />} label={isAr ? 'فرع جديد' : 'New Branch'} onClick={() => setAddBranchOpen(true)} />
          <ToolBtn icon={<Settings className="w-3.5 h-3.5" />} label={isAr ? 'التواصل' : 'Contact'} onClick={() => { setFooterDraft({ ...siteData.footer }); setFooterOpen(true); }} />
          <ToolBtn icon={<FileDown className="w-3.5 h-3.5" />} label={isAr ? 'كتالوج PDF' : 'PDF Catalog'} variant="dark"
            onClick={() => setPdfModalTarget('all')} />
          <button onClick={() => setIsAdmin(false)}
            className="flex items-center justify-center w-8 h-8 rounded-full text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Add Branch */}
      <Dialog open={addBranchOpen} onOpenChange={o => { setAddBranchOpen(o); if (!o) { setBranchNameAr(''); setBranchNameEn(''); setBranchLocation(''); setBranchImageUrl(''); } }}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="arabic">{isAr ? 'إضافة فرع جديد' : 'Add New Branch'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddBranch} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{isAr ? 'اسم الفرع (عربي)' : 'Branch Name (AR)'}</Label>
              <Input value={branchNameAr} onChange={e => setBranchNameAr(e.target.value)} dir="rtl" className="arabic" placeholder="مثال: فرع الرياض" />
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'اسم الفرع (إنجليزي)' : 'Branch Name (EN)'}</Label>
              <Input value={branchNameEn} onChange={e => setBranchNameEn(e.target.value)} dir="ltr" placeholder="e.g. Riyadh Branch" />
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'رابط الموقع على الخريطة' : 'Google Maps Link'}</Label>
              <Input
                value={branchLocation}
                onChange={e => setBranchLocation(e.target.value)}
                dir="ltr"
                placeholder="https://maps.google.com/..."
                type="url"
              />
              <p className="text-xs text-muted-foreground arabic">
                {isAr ? 'افتح الموقع في Google Maps → شارك → انسخ الرابط' : 'Open location in Google Maps → Share → Copy link'}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'صورة الفرع' : 'Branch Photo'}</Label>
              <div className="flex gap-2">
                <Input value={branchImageUrl} onChange={e => setBranchImageUrl(e.target.value)} dir="ltr" placeholder={isAr ? 'رابط الصورة...' : 'Image URL...'} className="flex-1" />
                <FileUploadBtn onFile={url => setBranchImageUrl(url)}>
                  <div className="h-9 px-3 rounded-md bg-muted border border-border flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted/80 transition-colors whitespace-nowrap">
                    <ImagePlus className="w-3.5 h-3.5" />
                    {isAr ? 'رفع' : 'Upload'}
                  </div>
                </FileUploadBtn>
              </div>
              {branchImageUrl && (
                <img src={branchImageUrl} alt="preview" className="w-full h-24 object-cover rounded-lg mt-1 border border-border" />
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setAddBranchOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              <Button type="submit" className="bg-primary text-primary-foreground" disabled={!branchNameAr && !branchNameEn}>
                {isAr ? 'إضافة' : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Login */}
      <Dialog open={loginOpen} onOpenChange={o => { setLoginOpen(o); if (!o) { setUser(''); setPass(''); setLoginErr(''); } }}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl text-center arabic">{isAr ? 'دخول المدير' : 'Admin Login'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{isAr ? 'اسم المستخدم' : 'Username'}</Label>
              <Input value={user} onChange={e => setUser(e.target.value)} dir="ltr" autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'كلمة المرور' : 'Password'}</Label>
              <Input type="password" value={pass} onChange={e => setPass(e.target.value)} dir="ltr" />
            </div>
            {loginErr && <p className="text-destructive text-sm">{loginErr}</p>}
            <Button type="submit" className="w-full bg-primary text-primary-foreground">{isAr ? 'دخول' : 'Login'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Photo */}
      <Dialog open={!!addPhotoSectionId} onOpenChange={o => { if (!o) { setAddPhotoSectionId(null); setPhotoUrl(''); setPhotoNameAr(''); setPhotoNameEn(''); } }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="arabic">{isAr ? 'إضافة صورة' : 'Add Photo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPhoto} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{isAr ? 'الصورة' : 'Image'}</Label>
              <div className="flex gap-2">
                <Input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} dir="ltr" placeholder="https://..." className="flex-1" />
                <FileUploadBtn onFile={b64 => setPhotoUrl(b64)}>
                  <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5">
                    <ImagePlus className="w-4 h-4" />
                    {isAr ? 'رفع' : 'Upload'}
                  </Button>
                </FileUploadBtn>
              </div>
              {photoUrl && (
                <img src={photoUrl} alt="preview" className="w-full h-44 object-cover rounded-xl mt-2"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{isAr ? 'الاسم عربي' : 'Name (AR)'}</Label>
                <Input value={photoNameAr} onChange={e => setPhotoNameAr(e.target.value)} dir="rtl" className="arabic" />
              </div>
              <div className="space-y-1.5">
                <Label>{isAr ? 'الاسم إنجليزي' : 'Name (EN)'}</Label>
                <Input value={photoNameEn} onChange={e => setPhotoNameEn(e.target.value)} dir="ltr" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setAddPhotoSectionId(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              <Button type="submit" className="bg-primary text-primary-foreground" disabled={!photoUrl}>{isAr ? 'إضافة' : 'Add'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Section */}
      <Dialog open={addSecOpen} onOpenChange={setAddSecOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="arabic">{isAr ? 'قسم جديد' : 'New Section'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSection} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{isAr ? 'اسم القسم عربي' : 'Section Name (AR)'}</Label>
              <Input value={secNameAr} onChange={e => setSecNameAr(e.target.value)} dir="rtl" className="arabic" />
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'اسم القسم إنجليزي' : 'Section Name (EN)'}</Label>
              <Input value={secNameEn} onChange={e => setSecNameEn(e.target.value)} dir="ltr" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddSecOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              <Button type="submit" className="bg-primary text-primary-foreground">{isAr ? 'إضافة' : 'Add'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Footer Edit */}
      <Dialog open={footerOpen} onOpenChange={setFooterOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="arabic">{isAr ? 'معلومات التواصل' : 'Contact Info'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {[
              { key: 'email', label: isAr ? 'البريد الإلكتروني' : 'Email', type: 'email', dir: 'ltr' },
              { key: 'phone', label: isAr ? 'رقم الهاتف' : 'Phone', type: 'tel', dir: 'ltr' },
              { key: 'website', label: isAr ? 'رابط الموقع' : 'Website', type: 'text', dir: 'ltr' },
              { key: 'noteAr', label: isAr ? 'ملاحظة عربية' : 'Note (AR)', type: 'text', dir: 'rtl' },
              { key: 'noteEn', label: isAr ? 'ملاحظة إنجليزية' : 'Note (EN)', type: 'text', dir: 'ltr' },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input type={f.type} dir={f.dir as 'ltr' | 'rtl'}
                  value={footerDraft[f.key as keyof typeof footerDraft]}
                  onChange={e => setFooterDraft({ ...footerDraft, [f.key]: e.target.value })} />
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFooterOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={() => { updateSiteData({ footer: footerDraft }); setFooterOpen(false); toast.success(isAr ? 'تم الحفظ' : 'Saved'); }}
                className="bg-primary text-primary-foreground">{isAr ? 'حفظ' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Select Modal */}
      {pdfModalOpen && (
        <PDFSelectModal
          open={pdfModalOpen}
          onClose={() => setPdfModalTarget('closed')}
          sections={siteData.sections}
          lang={lang}
          targetSectionId={pdfModalTarget === 'all' ? null : pdfModalTarget}
          titleAr={siteData.titleAr}
          titleEn={siteData.titleEn}
          logoUrl={siteData.logo.customUrl}
        />
      )}
    </div>
  );
}

/* ── Section block ───────────────────────────────────── */
function SectionBlock({ section, lang, isAdmin, onUpdateName, onAddPhoto, onDeletePhoto, onDeleteSection, onDownloadPDF }: {
  section: Section; lang: string; isAdmin: boolean;
  onUpdateName: (f: 'nameAr' | 'nameEn', v: string) => void;
  onAddPhoto: () => void; onDeletePhoto: (id: string) => void;
  onDeleteSection: () => void; onDownloadPDF: () => void;
}) {
  const isAr = lang === 'ar';
  return (
    <section className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 h-px bg-border" />
        <div className="text-center shrink-0">
          <h2 className="text-2xl md:text-3xl font-bold arabic text-foreground">
            {isAdmin
              ? <InlineEdit value={section.nameAr} onSave={v => onUpdateName('nameAr', v)} className="arabic text-2xl font-bold" />
              : section.nameAr}
          </h2>
          <p className="text-xs text-muted-foreground tracking-widest uppercase latin mt-0.5">
            {isAdmin
              ? <InlineEdit value={section.nameEn} onSave={v => onUpdateName('nameEn', v)} className="latin text-xs uppercase tracking-widest" />
              : section.nameEn}
          </p>
        </div>
        <div className="flex-1 h-px bg-border" />
        {isAdmin && (
          <div className="no-print flex items-center gap-1 shrink-0">
            <AdminIconBtn onClick={onAddPhoto} title={isAr ? 'إضافة صورة' : 'Add photo'} variant="primary"><Plus className="w-3.5 h-3.5" /></AdminIconBtn>
            <AdminIconBtn onClick={onDownloadPDF} title={isAr ? 'تنزيل PDF' : 'Download PDF'}><FileDown className="w-3.5 h-3.5" /></AdminIconBtn>
            <AdminIconBtn onClick={onDeleteSection} title={isAr ? 'حذف القسم' : 'Delete section'} variant="danger"><Trash2 className="w-3.5 h-3.5" /></AdminIconBtn>
          </div>
        )}
      </div>

      {/* Photos */}
      {section.photos.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground text-sm border-2 border-dashed border-border rounded-2xl arabic">
          {isAr ? 'لا توجد صور في هذا القسم' : 'No photos in this section'}
          {isAdmin && <p className="mt-1 text-primary text-xs">{isAr ? 'اضغط + لإضافة صور' : 'Press + to add photos'}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {section.photos.map(photo => (
            <div key={photo.id} className="group relative rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 bg-card aspect-[4/5]">
              <img src={photo.image} alt={isAr ? photo.nameAr : photo.nameEn}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
              {(photo.nameAr || photo.nameEn) && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent pt-12 pb-4 px-4">
                  <p className="text-white text-base font-bold leading-tight arabic drop-shadow-sm">{isAr ? photo.nameAr : photo.nameEn}</p>
                  {photo.nameAr && photo.nameEn && (
                    <p className="text-white/65 text-xs mt-0.5 latin">{isAr ? photo.nameEn : photo.nameAr}</p>
                  )}
                </div>
              )}
              {isAdmin && (
                <button onClick={() => onDeletePhoto(photo.id)}
                  className="no-print absolute top-2.5 end-2.5 w-8 h-8 bg-black/55 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 backdrop-blur-sm">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Small icon button ───────────────────────────────── */
function AdminIconBtn({ onClick, title, variant = 'default', children }: {
  onClick: () => void; title: string; variant?: 'default' | 'primary' | 'danger'; children: React.ReactNode;
}) {
  const cls = {
    default: 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted',
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    danger: 'bg-card border border-border text-destructive hover:bg-destructive/10',
  }[variant];
  return (
    <button onClick={onClick} title={title}
      className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${cls}`}>
      {children}
    </button>
  );
}

/* ── Toolbar button ──────────────────────────────────── */
function ToolBtn({ icon, label, onClick, variant = 'default' }: {
  icon: React.ReactNode; label: string; onClick: () => void; variant?: 'default' | 'dark';
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors ${variant === 'dark' ? 'bg-foreground text-background hover:bg-foreground/90' : 'bg-accent border border-border text-foreground hover:bg-muted'}`}>
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ── Tree SVG Logo ───────────────────────────────────── */
function TreeSVG() {
  return (
    <svg width="64" height="84" viewBox="0 0 64 84" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Layer 1 – top */}
      <polygon points="32,4 54,34 10,34" fill="hsl(150 30% 38%)" />
      {/* Layer 2 – middle */}
      <polygon points="32,22 58,52 6,52" fill="hsl(150 35% 32%)" />
      {/* Layer 3 – bottom */}
      <polygon points="32,40 62,72 2,72" fill="hsl(150 40% 26%)" />
      {/* Trunk */}
      <rect x="27" y="72" width="10" height="12" rx="2" fill="hsl(27 55% 40%)" />
    </svg>
  );
}
