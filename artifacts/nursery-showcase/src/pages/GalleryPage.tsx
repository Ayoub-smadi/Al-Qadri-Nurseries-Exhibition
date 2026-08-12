import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { navigate } from '@/App';
import { useApp } from '@/lib/context';
import { Photo, Section, Branch, SocialLink, SocialPlatform, Highlight, FeaturedImage, ShowcaseItem, uploadImage, uploadImageFromUrl, adminLogin, adminSetup, checkNeedsSetup, setSessionToken, loadSavedToken, validateToken, QuoteItem, QuoteRequest, Invoice, InvoiceItem, Receipt, Disbursement, submitQuote, fetchQuotes, updateQuote, deleteQuote, restoreQuote, permanentDeleteQuote, adminCreateQuote, fetchInvoices, createInvoice, updateInvoice, deleteInvoice, updateInvoiceStatus, fetchReceipts, createReceipt, updateReceipt, deleteReceipt, fetchDisbursements, createDisbursement, updateDisbursement, deleteDisbursement } from '@/lib/storage';
import { QuotationForm } from '@/components/QuotationForm';
import { AdminQuotationsList } from '@/components/AdminQuotationsList';
import { downloadCatalogPDF, downloadQadriCatalogPDF, downloadQuotePDF, downloadQuotePDFNoHeader, shareQuotePDFToWhatsApp, downloadInvoicePDF, downloadCertificatePDF, downloadReceiptPDF, downloadDisbursementPDF, CertificateData, PDFSectionInput } from '@/lib/pdfGen';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  X, Plus, LogOut, Settings, ImagePlus, Moon, Sun,
  Pencil, Trash2, FolderPlus, FileDown, Loader2, ChevronDown, ChevronUp, MapPin,
  TreePine, Package, Building2, Globe, Flower2, Share2, Phone, Mail,
  Search, Receipt as ReceiptIcon, ShoppingCart, CheckCircle2, Circle, Minus, Inbox,
  ArrowUp, ArrowDown, Download, Upload, FileSpreadsheet, RotateCcw,
  FileText, Trash, ArchiveRestore, Award, ArrowUpFromLine, FilePlus, Camera, GripVertical,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

/* ── utils ─────────────────────────────────────────────── */
function uid() { return `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    // Warm bell chime — two sine+triangle layers with natural decay
    const bellNotes = [
      { freq: 659.3, delay: 0,    vol: 0.30 },  // E5
      { freq: 880.0, delay: 0.18, vol: 0.24 },  // A5
      { freq: 1108.7, delay: 0.34, vol: 0.20 }, // C#6
    ];
    bellNotes.forEach(({ freq, delay, vol }) => {
      const t = ctx.currentTime + delay;
      // Primary sine (fundamental)
      const osc1 = ctx.createOscillator();
      const g1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = freq;
      osc1.connect(g1); g1.connect(ctx.destination);
      g1.gain.setValueAtTime(0, t);
      g1.gain.linearRampToValueAtTime(vol, t + 0.008);
      g1.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      osc1.start(t); osc1.stop(t + 1.5);
      // Harmonic shimmer (×2 freq, quieter)
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.value = freq * 2.756; // inharmonic partial — bell character
      osc2.connect(g2); g2.connect(ctx.destination);
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(vol * 0.12, t + 0.006);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc2.start(t); osc2.stop(t + 0.7);
    });
  } catch { /* ignore */ }
}

/* ── Social platform config ─────────────────────────────── */
const SOCIAL_PLATFORMS: { value: SocialPlatform; labelAr: string; labelEn: string; color: string }[] = [
  { value: 'facebook',  labelAr: 'فيسبوك',       labelEn: 'Facebook',   color: '#1877F2' },
  { value: 'instagram', labelAr: 'إنستجرام',     labelEn: 'Instagram',  color: '#E1306C' },
  { value: 'whatsapp',  labelAr: 'واتساب',       labelEn: 'WhatsApp',   color: '#25D366' },
  { value: 'youtube',   labelAr: 'يوتيوب',       labelEn: 'YouTube',    color: '#FF0000' },
  { value: 'website',   labelAr: 'الموقع',       labelEn: 'Website',    color: '#0EA5E9' },
  { value: 'email',     labelAr: 'الإيميل',      labelEn: 'Email',      color: '#8B5CF6' },
  { value: 'catalog',   labelAr: 'كتيب المشتل',  labelEn: 'Catalog',    color: '#16A34A' },
];

function SocialIcon({ platform, size = 40 }: { platform: SocialPlatform; size?: number }) {
  const cfg = SOCIAL_PLATFORMS.find(p => p.value === platform)!;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill={cfg.color} />
      {platform === 'facebook' && (
        <path d="M22 20h-2.5v8H17v-8h-2v-3h2v-1.8C17 13.4 18.1 12 20.5 12H23v3h-1.5c-.6 0-.5.3-.5.6V17H23l-.4 3H21z" fill="white"/>
      )}
      {platform === 'instagram' && (
        <>
          <rect x="11" y="11" width="18" height="18" rx="5" stroke="white" strokeWidth="2" fill="none"/>
          <circle cx="20" cy="20" r="4.5" stroke="white" strokeWidth="2" fill="none"/>
          <circle cx="25.5" cy="14.5" r="1.2" fill="white"/>
        </>
      )}
      {platform === 'whatsapp' && (
        <path d="M20 11a9 9 0 0 0-7.8 13.5L11 29l4.7-1.2A9 9 0 1 0 20 11zm0 16.2a7.2 7.2 0 0 1-3.7-1l-.3-.2-2.8.7.8-2.7-.2-.3A7.2 7.2 0 1 1 20 27.2zm4-5.4c-.2-.1-1.3-.6-1.5-.7-.2-.1-.3-.1-.4.1s-.5.7-.6.8c-.1.1-.2.1-.4 0a5.5 5.5 0 0 1-2.8-2.5c-.1-.2 0-.3.1-.4l.3-.4c.1-.1.1-.2.2-.4 0-.1 0-.3-.1-.4s-.5-1.2-.7-1.6c-.2-.4-.3-.4-.5-.4h-.4c-.1 0-.3.1-.5.3a2.9 2.9 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.8.6.3 1.1.4 1.5.5.6.2 1.2.1 1.6-.1.5-.2 1.3-.5 1.5-1.1.2-.5.2-1 .1-1.1-.1-.1-.2-.2-.4-.3z" fill="white"/>
      )}
      {platform === 'youtube' && (
        <>
          <path d="M28.5 15.5s-.3-2-1.2-2.8c-1.1-1.2-2.4-1.2-3-1.3C21.7 11.2 20 11.2 20 11.2s-1.7 0-4.3.2c-.6.1-1.9.1-3 1.3-.9.8-1.2 2.8-1.2 2.8S11.2 17.7 11.2 20v2.2c0 2.2.3 4.5.3 4.5s.3 2 1.2 2.8c1.1 1.2 2.6 1.1 3.3 1.2C18 30.9 20 31 20 31s1.7 0 4.3-.3c.6-.1 1.9-.1 3-1.2.9-.8 1.2-2.8 1.2-2.8s.3-2.2.3-4.5V20c0-2.2-.3-4.5-.3-4.5z" fill="white"/>
          <polygon points="17.5,16.5 17.5,23.5 24,20" fill={cfg.color}/>
        </>
      )}
      {platform === 'website' && (
        <>
          <circle cx="20" cy="20" r="9" stroke="white" strokeWidth="2" fill="none"/>
          <ellipse cx="20" cy="20" rx="4.5" ry="9" stroke="white" strokeWidth="1.5" fill="none"/>
          <line x1="11" y1="20" x2="29" y2="20" stroke="white" strokeWidth="1.5"/>
          <line x1="12.5" y1="15" x2="27.5" y2="15" stroke="white" strokeWidth="1.2"/>
          <line x1="12.5" y1="25" x2="27.5" y2="25" stroke="white" strokeWidth="1.2"/>
        </>
      )}
      {platform === 'email' && (
        <>
          <rect x="11" y="14" width="18" height="12" rx="2" stroke="white" strokeWidth="2" fill="none"/>
          <polyline points="11,14 20,21 29,14" stroke="white" strokeWidth="2" fill="none"/>
        </>
      )}
      {platform === 'catalog' && (
        <>
          <rect x="12" y="10" width="14" height="18" rx="2" stroke="white" strokeWidth="2" fill="none"/>
          <path d="M12 14h14" stroke="white" strokeWidth="1.5"/>
          <path d="M15 18h8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M15 21.5h6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M15 25h5" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
        </>
      )}
    </svg>
  );
}

/* ── file upload helper ──────────────────────────────── */
function FileUploadBtn({ onFile, onLoading, children, className }: {
  onFile: (url: string) => void;
  onLoading?: (v: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return;
          onLoading?.(true);
          try {
            const url = await uploadImage(f);
            onFile(url);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Upload failed';
            toast.error(`فشل رفع الصورة — ${msg}`);
          } finally {
            onLoading?.(false);
            e.target.value = '';
          }
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
function PDFSelectModal({ open, onClose, sections, lang, targetSectionId, titleAr, titleEn, logoUrl, companyDetails }: {
  open: boolean; onClose: () => void; sections: Section[]; lang: string;
  targetSectionId: string | null; titleAr: string; titleEn: string; logoUrl: string;
  companyDetails: { locationAr: string; locationEn: string; phone: string; email: string; website: string };
}) {
  const isAr = lang === 'ar';
  const visibleSections = targetSectionId ? sections.filter(s => s.id === targetSectionId) : sections;

  const emptySelection = () => {
    const m: PdfSel = new Map();
    for (const s of visibleSections) m.set(s.id, new Set());
    return m;
  };

  const [sel, setSel] = useState<PdfSel>(() => emptySelection());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(visibleSections.map(s => s.id)));
  const [search, setSearch] = useState('');
  // photoPositions: photoId → position number string (1 = first, blank = unordered)
  const [photoPositions, setPhotoPositions] = useState<Map<string, string>>(new Map());
  // photoQuantities: photoId → quantity string (set per-catalog, not stored on plant)
  const [photoQuantities, setPhotoQuantities] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);

  // Re-init when opened
  React.useEffect(() => {
    if (open) {
      setSel(emptySelection());
      setSearch('');
      setExpanded(new Set(visibleSections.map(s => s.id)));
      setPhotoPositions(new Map());
      setPhotoQuantities(new Map());
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
      const selectedPhotos = s.photos.filter(p => chosen.has(p.id));
      // Sort by position number; blank/unset goes to the end in original order
      selectedPhotos.sort((a, b) => {
        const pa = photoPositions.get(a.id);
        const pb = photoPositions.get(b.id);
        const na = pa !== undefined && pa !== '' ? Number(pa) : Infinity;
        const nb = pb !== undefined && pb !== '' ? Number(pb) : Infinity;
        if (na !== nb) return na - nb;
        return s.photos.indexOf(a) - s.photos.indexOf(b);
      });
      const photos = selectedPhotos.map(p => {
        const qStr = photoQuantities.get(p.id);
        return qStr ? { ...p, quantity: Number(qStr) } : { ...p, quantity: undefined };
      });
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
        : 'كتالوج-القادري.pdf';
      await downloadQadriCatalogPDF(
        inputs,
        logoUrl,
        titleAr,
        titleEn,
        companyDetails.locationAr,
        companyDetails.locationEn,
        { phone: companyDetails.phone, email: companyDetails.email, website: companyDetails.website },
        fname
      );
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

        {/* Search */}
        <div className="shrink-0 relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'ابحث عن نبتة...' : 'Search plants...'}
            className="ps-9 arabic"
            dir={isAr ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Section + photo list */}
        <div className="overflow-y-auto flex-1 space-y-3 pr-1 my-1">
          {visibleSections.map(sec => {
            const secSel = sel.get(sec.id) ?? new Set();

            // Filter by search
            const q = search.trim().toLowerCase();
            const filteredPhotos = q
              ? sec.photos.filter(p => p.nameAr.toLowerCase().includes(q) || (p.nameEn ?? '').toLowerCase().includes(q))
              : sec.photos;

            // Hide section entirely if search active and no matches
            if (q && filteredPhotos.length === 0) return null;

            const allChecked = secSel.size === sec.photos.length;
            const someChecked = secSel.size > 0 && !allChecked;
            const isExpanded = expanded.has(sec.id) || q.length > 0;

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
                  <span className="font-bold arabic flex-1 text-sm">{isAr ? sec.nameAr : (sec.nameEn || sec.nameAr)}</span>
                  <span className="text-xs text-muted-foreground">{secSel.size}/{sec.photos.length}</span>
                  <button onClick={() => setExpanded(prev => {
                    const n = new Set(prev);
                    if (n.has(sec.id)) n.delete(sec.id); else n.add(sec.id);
                    return n;
                  })} className="text-muted-foreground hover:text-foreground transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Photos list */}
                {isExpanded && filteredPhotos.length > 0 && (
                  <div className="divide-y divide-border">
                    {filteredPhotos.map((photo) => {
                      const checked = secSel.has(photo.id);
                      return (
                        <div key={photo.id}
                          className={`flex items-center gap-3 px-3 py-2 transition-colors ${checked ? 'bg-background' : 'bg-background/40 opacity-60'}`}>
                          {/* Thumbnail */}
                          <img src={photo.image} alt={isAr ? photo.nameAr : (photo.nameEn || photo.nameAr)}
                            className="w-10 h-10 rounded-md object-cover shrink-0 ring-1 ring-border" loading="lazy" />
                          {/* Name */}
                          <span className="flex-1 text-sm arabic truncate">{isAr ? photo.nameAr : (photo.nameEn || photo.nameAr)}</span>
                          {/* Quantity */}
                          <input
                            type="number"
                            min="0"
                            value={photoQuantities.get(photo.id) ?? ''}
                            onChange={e => setPhotoQuantities(prev => {
                              const next = new Map(prev);
                              if (e.target.value === '') next.delete(photo.id);
                              else next.set(photo.id, e.target.value);
                              return next;
                            })}
                            placeholder={isAr ? 'عدد' : 'qty'}
                            className="w-14 shrink-0 rounded-md border border-input bg-background px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                            dir="ltr"
                          />
                          {/* Position (order in catalog) */}
                          <input
                            type="number"
                            min="1"
                            value={photoPositions.get(photo.id) ?? ''}
                            onChange={e => setPhotoPositions(prev => {
                              const next = new Map(prev);
                              if (e.target.value === '') next.delete(photo.id);
                              else next.set(photo.id, e.target.value);
                              return next;
                            })}
                            placeholder={isAr ? 'ترتيب' : 'order'}
                            className="w-16 shrink-0 rounded-md border border-input bg-background px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                            dir="ltr"
                          />
                          {/* Checkbox */}
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => togglePhoto(sec.id, photo.id)}
                            className="shrink-0"
                          />
                        </div>
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
  const { lang, setLang, isDark, toggleDark, isAdmin, setIsAdmin, siteData, updateSiteData, dataLoaded, sessionExpired, setSessionExpired } = useApp();
  const isAr = lang === 'ar';

  /* login */
  const [loginOpen, setLoginOpen] = useState(false);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [setupPass2, setSetupPass2] = useState('');

  /* news ticker */
  const [editingTicker, setEditingTicker] = useState(false);
  const [tickerDraft, setTickerDraft] = useState('');

  /* add photo */
  const [addPhotoSectionId, setAddPhotoSectionId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoNameAr, setPhotoNameAr] = useState('');
  const [photoNameEn, setPhotoNameEn] = useState('');
  const [photoDescAr, setPhotoDescAr] = useState('');
  const [photoDescEn, setPhotoDescEn] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUrlLoading, setPhotoUrlLoading] = useState(false);

  /* edit photo */
  const [editPhotoTarget, setEditPhotoTarget] = useState<{ sectionId: string; photo: Photo } | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editPhotoNameAr, setEditPhotoNameAr] = useState('');
  const [editPhotoNameEn, setEditPhotoNameEn] = useState('');
  const [editPhotoDescAr, setEditPhotoDescAr] = useState('');
  const [editPhotoDescEn, setEditPhotoDescEn] = useState('');
  const [editPhotoExtraImages, setEditPhotoExtraImages] = useState<string[]>([]);
  const [editPhotoUploading, setEditPhotoUploading] = useState(false);
  const [editPhotoUrlLoading, setEditPhotoUrlLoading] = useState(false);
  const [editExtraUploading, setEditExtraUploading] = useState(false);

  /* owner photo carousel */
  const [ownerPhotoIdx, setOwnerPhotoIdx] = useState(0);

  /* plant lightbox */
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);

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
  const [branchMapEmbed, setBranchMapEmbed] = useState('');
  const [branchCoords, setBranchCoords] = useState('');
  const [branchImageUrl, setBranchImageUrl] = useState('');
  const [branchImgUploading, setBranchImgUploading] = useState(false);

  /* social links */
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [editingSocial, setEditingSocial] = useState<SocialLink | null>(null);
  const [socialPlatform, setSocialPlatform] = useState<SocialPlatform>('facebook');
  const [socialUrl, setSocialUrl] = useState('');

  /* search */
  const [searchQuery, setSearchQuery] = useState('');

  /* quote request */
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteCart, setQuoteCart] = useState<QuoteCartItem[]>([]);

  /* admin quotes */
  const [adminQuotesOpen, setAdminQuotesOpen] = useState(false);
  const [pendingQuoteCount, setPendingQuoteCount] = useState(0);
  /* admin invoices */
  const [adminInvoicesOpen, setAdminInvoicesOpen] = useState(false);
  /* admin receipts */
  const [adminReceiptsOpen, setAdminReceiptsOpen] = useState(false);
  /* admin disbursements */
  const [adminDisbursementsOpen, setAdminDisbursementsOpen] = useState(false);
  /* qadri-old & no-header quotation records */
  const [qadriOldOpen, setQadriOldOpen] = useState(false);
  const [noHeaderOpen, setNoHeaderOpen] = useState(false);
  /* experience certificate */
  const [certOpen, setCertOpen] = useState(false);

  /* backup / restore */
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);

  /* financial backup / restore */
  const financialRestoreInputRef = useRef<HTMLInputElement>(null);
  const [financialBackingUp, setFinancialBackingUp] = useState(false);
  const [financialRestoring, setFinancialRestoring] = useState(false);

  /* quotes backup / restore */
  const quoteRestoreInputRef = useRef<HTMLInputElement>(null);
  const [quoteBacking, setQuoteBacking] = useState(false);
  const [quoteRestoring, setQuoteRestoring] = useState(false);

  /* admin sidebar */
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [quotationFormOpen, setQuotationFormOpen] = useState(false);
  const [adminQuotationsListOpen, setAdminQuotationsListOpen] = useState(false);

  /* excel import */
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const [xlsxOpen, setXlsxOpen] = useState(false);
  const [xlsxResult, setXlsxResult] = useState<{ added: number; sections: string[] } | null>(null);
  const [xlsxError, setXlsxError] = useState<string | null>(null);
  const [xlsxLoading, setXlsxLoading] = useState(false);

  /* ── poll for new quote requests every 5 s, notify per-quote ── */
  const seenQuoteIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!isAdmin) { setPendingQuoteCount(0); seenQuoteIdsRef.current = null; return; }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    let destroyed = false;

    const poll = async () => {
      const qs = await fetchQuotes();
      if (!qs || destroyed) return;

      const pending = qs.filter(q => q.status !== 'priced');
      setPendingQuoteCount(pending.length);

      const currentIds = new Set(qs.map(q => q.id));

      if (seenQuoteIdsRef.current === null) {
        // First load — seed the set without firing notifications
        seenQuoteIdsRef.current = currentIds;
        return;
      }

      // Fire one notification per new quote
      const newQuotes = qs.filter(q => !seenQuoteIdsRef.current!.has(q.id));
      newQuotes.forEach((q, idx) => {
        // Stagger sounds slightly so they don't stack
        setTimeout(() => playNotificationSound(), idx * 600);

        if ('Notification' in window && Notification.permission === 'granted') {
          const shipping =
            q.shipping_method === 'pickup'         ? 'استلام من المشتل' :
            q.shipping_method === 'delivery'       ? 'توصيل' :
            q.shipping_method === 'delivery_plant' ? 'توصيل + زراعة' : 'طلب';
          const itemCount = Array.isArray(q.items) ? q.items.length : 1;
          new Notification('🌿 طلب عرض سعر جديد — مشاتل القادري', {
            body: `${q.customer_name} · ${itemCount} نبتة · ${shipping}`,
            tag: `quote-${q.id}`,   // unique per quote — no overlap
          });
        }
      });

      seenQuoteIdsRef.current = currentIds;
    };

    poll();
    const id = setInterval(poll, 5_000);
    return () => { destroyed = true; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  /* ── restore admin session on page load — validate token first ── */
  useEffect(() => {
    const saved = loadSavedToken();
    if (saved) {
      setSessionToken(saved);
      validateToken().then(valid => {
        if (valid) {
          setIsAdmin(true);
        } else {
          setSessionToken(null);
        }
      });
    }
  }, []);

  /* ── open login modal when session expires mid-session ── */
  useEffect(() => {
    if (sessionExpired) {
      openLoginModal();
      setSessionExpired(false);
      toast.error(isAr ? 'انتهت صلاحية الجلسة — سجّل الدخول مجدداً' : 'Session expired — please log in again', { duration: 6000 });
    }
  }, [sessionExpired]);

  /* ── handlers ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLoading) return;
    setLoginErr('');
    setLoginLoading(true);
    try {
      if (isSetupMode) {
        if (pass !== setupPass2) {
          setLoginErr(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
          return;
        }
        if (pass.length < 6) {
          setLoginErr(isAr ? 'كلمة المرور قصيرة جداً (6 أحرف على الأقل)' : 'Password too short (min 6 chars)');
          return;
        }
        const ok = await adminSetup(user, pass);
        if (ok) {
          const token = await adminLogin(user, pass);
          if (token) {
            setSessionToken(token);
            setIsAdmin(true); setLoginOpen(false); setUser(''); setPass(''); setSetupPass2(''); setLoginErr(''); setIsSetupMode(false);
            toast.success(isAr ? 'تم إنشاء حساب المدير بنجاح' : 'Admin account created');
          }
        } else {
          setLoginErr(isAr ? 'فشل إنشاء الحساب' : 'Setup failed');
        }
        return;
      }
      const token = await adminLogin(user, pass);
      if (token) {
        setSessionToken(token);
        setIsAdmin(true); setLoginOpen(false); setUser(''); setPass(''); setLoginErr('');
      } else {
        setLoginErr(isAr ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const openLoginModal = () => {
    setLoginOpen(true);
    checkNeedsSetup().then(needs => setIsSetupMode(needs)).catch(() => {});
  };

  /* ── financial backup: download invoices + receipts + disbursements as JSON ── */
  const handleFinancialBackup = async () => {
    setFinancialBackingUp(true);
    try {
      const [invoices, receipts, disbursements] = await Promise.all([
        fetchInvoices(),
        fetchReceipts(),
        fetchDisbursements(),
      ]);
      const payload = {
        version: 1,
        date: new Date().toISOString(),
        invoices: invoices ?? [],
        receipts: receipts === 'unauthorized' ? [] : (receipts ?? []),
        disbursements: disbursements === 'unauthorized' ? [] : (disbursements ?? []),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `alqadri-financial-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(isAr ? 'تم تنزيل نسخة احتياطية للسجلات المالية' : 'Financial backup downloaded');
    } catch {
      toast.error(isAr ? 'فشل في تنزيل النسخة الاحتياطية' : 'Backup failed');
    } finally {
      setFinancialBackingUp(false);
    }
  };

  /* ── financial restore: upload JSON backup and recreate records ── */
  const handleFinancialRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!confirm(isAr ? 'سيتم إضافة السجلات المالية من الملف (لن يُحذف أي سجل موجود). متأكد؟' : 'Records from the file will be added (existing records are not deleted). Continue?')) return;
    setFinancialRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        invoices?: Invoice[];
        receipts?: Receipt[];
        disbursements?: Disbursement[];
      };
      let ok = 0;
      let fail = 0;
      for (const inv of parsed.invoices ?? []) {
        const res = await createInvoice({
          customerName: inv.customer_name,
          date: inv.date,
          items: inv.items as InvoiceItem[],
          notes: inv.notes ?? '',
          status: inv.status,
          discount: Number(inv.discount) || 0,
          invoiceNumber: inv.number,
        });
        if (res && res !== 'unauthorized' && !('error' in res)) ok++; else fail++;
      }
      for (const r of parsed.receipts ?? []) {
        const res = await createReceipt({
          receivedFrom: r.received_from,
          amount: Number(r.amount),
          amountText: r.amount_text,
          description: r.description,
          paymentMethod: r.payment_method,
          date: r.date,
          notes: r.notes ?? '',
          receiptNumber: r.number,
        });
        if (res && res !== 'unauthorized' && !('error' in res)) ok++; else fail++;
      }
      for (const d of parsed.disbursements ?? []) {
        const res = await createDisbursement({
          paidTo: d.paid_to,
          amount: Number(d.amount),
          amountText: d.amount_text,
          description: d.description,
          paymentMethod: d.payment_method,
          date: d.date,
          notes: d.notes ?? '',
          disbursementNumber: d.number,
        });
        if (res && res !== 'unauthorized' && !('error' in res)) ok++; else fail++;
      }
      if (fail > 0) {
        toast.error(isAr ? `تم استعادة ${ok} سجل، فشل ${fail}` : `Restored ${ok}, failed ${fail}`);
      } else {
        toast.success(isAr ? `تم استعادة ${ok} سجل مالي بنجاح` : `Restored ${ok} financial records`);
      }
    } catch {
      toast.error(isAr ? 'فشل في قراءة الملف' : 'Failed to read backup file');
    } finally {
      setFinancialRestoring(false);
    }
  };

  /* ── quotes backup: download all quote requests as JSON ── */
  const handleQuoteBackup = async () => {
    setQuoteBacking(true);
    try {
      const quotes = await fetchQuotes();
      const payload = {
        version: 1,
        date: new Date().toISOString(),
        quotes: quotes ?? [],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `alqadri-quotes-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(isAr ? 'تم تنزيل نسخة احتياطية من عروض الأسعار' : 'Quotes backup downloaded');
    } catch {
      toast.error(isAr ? 'فشل في تنزيل النسخة الاحتياطية' : 'Backup failed');
    } finally {
      setQuoteBacking(false);
    }
  };

  /* ── quotes restore: upload JSON and recreate quote records ── */
  const handleQuoteRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!confirm(isAr ? 'سيتم إضافة عروض الأسعار من الملف (لن يُحذف أي عرض موجود). متأكد؟' : 'Quotes from the file will be added (existing quotes are not deleted). Continue?')) return;
    setQuoteRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { quotes?: QuoteRequest[] };
      let ok = 0; let fail = 0;
      for (const q of parsed.quotes ?? []) {
        const id = await adminCreateQuote({
          shippingMethod: (q.shipping_method as 'pickup' | 'delivery' | 'plant_only' | 'delivery_plant') ?? 'pickup',
          shippingAddress: q.shipping_address ?? '',
          customerName: q.customer_name,
          phone: q.phone ?? '',
          items: q.items as QuoteItem[],
          notes: q.notes ?? '',
          shippingFee: Number(q.shipping_fee) || 0,
          plantingFee: Number(q.planting_fee) || 0,
          discount: Number(q.discount) || 0,
          tax: Number(q.tax) || 0,
        });
        if (id) ok++; else fail++;
      }
      if (fail > 0) {
        toast.error(isAr ? `تم استعادة ${ok} عرض، فشل ${fail}` : `Restored ${ok}, failed ${fail}`);
      } else {
        toast.success(isAr ? `تم استعادة ${ok} عرض سعر بنجاح` : `Restored ${ok} quotes`);
      }
    } catch {
      toast.error(isAr ? 'فشل في قراءة الملف' : 'Failed to read backup file');
    } finally {
      setQuoteRestoring(false);
    }
  };

  /* ── backup: download siteData as JSON file ── */
  const handleBackup = () => {
    const payload = { version: 1, date: new Date().toISOString(), siteData };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `alqadri-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(isAr ? 'تم تنزيل النسخة الاحتياطية' : 'Backup downloaded');
  };

  /* ── restore: upload JSON backup file ── */
  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!confirm(isAr ? 'سيتم استبدال جميع بيانات الموقع بالنسخة الاحتياطية. متأكد؟' : 'This will replace all site data with the backup. Are you sure?')) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const data = parsed.siteData ?? parsed;
      await updateSiteData(data);
      toast.success(isAr ? 'تم استعادة البيانات بنجاح' : 'Data restored successfully');
    } catch {
      toast.error(isAr ? 'فشل في قراءة الملف' : 'Failed to read backup file');
    } finally {
      setRestoring(false);
    }
  };

  /* ── Excel import: parse xlsx and add plants to sections ── */
  const HEADER_MAP: Record<string, string[]> = {
    section_ar: ['القسم', 'قسم', 'section', 'section_ar', 'القسم العربي', 'اسم القسم'],
    section_en: ['القسم الانجليزي', 'section_en', 'section en', 'section english', 'قسم انجليزي'],
    name_ar:    ['الاسم العربي', 'الاسم', 'name_ar', 'name ar', 'اسم عربي', 'اسم النبتة'],
    name_en:    ['الاسم الانجليزي', 'name_en', 'name en', 'اسم انجليزي', 'english name'],
    desc_ar:    ['الوصف العربي', 'وصف', 'desc_ar', 'description', 'الوصف'],
    desc_en:    ['الوصف الانجليزي', 'desc_en', 'description en', 'وصف انجليزي'],
    image:      ['رابط الصورة', 'image', 'image_url', 'صورة', 'الصورة', 'url', 'link', 'رابط'],
  };

  const matchHeader = (raw: string): string | null => {
    const norm = raw.trim().toLowerCase();
    for (const [key, aliases] of Object.entries(HEADER_MAP)) {
      if (aliases.some(a => a.toLowerCase() === norm)) return key;
    }
    return null;
  };

  const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setXlsxLoading(true);
    setXlsxError(null);
    setXlsxResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (rows.length === 0) { setXlsxError(isAr ? 'الملف فارغ' : 'File is empty'); setXlsxLoading(false); return; }

      const firstRow = rows[0];
      const colMap: Record<string, string> = {};
      for (const raw of Object.keys(firstRow)) {
        const key = matchHeader(raw);
        if (key) colMap[key] = raw;
      }
      if (!colMap.section_ar && !colMap.name_ar) {
        setXlsxError(isAr ? 'لم يتم التعرف على الأعمدة. تأكد من الرؤوس: القسم، الاسم العربي، رابط الصورة' : 'Could not detect columns. Use headers: القسم, الاسم العربي, رابط الصورة');
        setXlsxLoading(false); return;
      }

      const newSections = siteData.sections.map(s => ({ ...s, photos: [...s.photos] }));
      let addedCount = 0;
      const affectedSections: Set<string> = new Set();

      for (const row of rows) {
        const sectionNameAr = (colMap.section_ar ? row[colMap.section_ar] : '').toString().trim();
        const sectionNameEn = (colMap.section_en ? row[colMap.section_en] : '').toString().trim();
        const nameAr = (colMap.name_ar ? row[colMap.name_ar] : '').toString().trim();
        const nameEn = (colMap.name_en ? row[colMap.name_en] : '').toString().trim();
        const descAr = (colMap.desc_ar ? row[colMap.desc_ar] : '').toString().trim();
        const descEn = (colMap.desc_en ? row[colMap.desc_en] : '').toString().trim();
        const imageUrl = (colMap.image ? row[colMap.image] : '').toString().trim();

        if (!nameAr && !imageUrl) continue;

        let sec = newSections.find(s => s.nameAr === sectionNameAr);
        if (!sec && sectionNameAr) {
          sec = { id: uid(), nameAr: sectionNameAr, nameEn: sectionNameEn || sectionNameAr, photos: [] };
          newSections.push(sec);
        }
        if (!sec) sec = newSections[0];
        if (!sec) continue;

        sec.photos.push({
          id: uid(),
          image: imageUrl,
          nameAr: nameAr || sectionNameAr,
          nameEn: nameEn || '',
          descriptionAr: descAr || undefined,
          descriptionEn: descEn || undefined,
        });
        addedCount++;
        affectedSections.add(sec.nameAr);
      }

      if (addedCount === 0) { setXlsxError(isAr ? 'لم يتم العثور على نباتات صالحة في الملف' : 'No valid plants found in file'); setXlsxLoading(false); return; }

      await updateSiteData({ ...siteData, sections: newSections });
      setXlsxResult({ added: addedCount, sections: Array.from(affectedSections) });
    } catch (err) {
      setXlsxError(isAr ? 'فشل في قراءة الملف — تأكد أنه ملف Excel صحيح' : 'Failed to read file — ensure it is a valid Excel file');
      console.error(err);
    } finally {
      setXlsxLoading(false);
    }
  };

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl || !addPhotoSectionId) return;
    let finalUrl = photoUrl;
    if (photoUrl.startsWith('http') && !photoUrl.startsWith('/api/')) {
      setPhotoUrlLoading(true);
      try {
        finalUrl = await uploadImageFromUrl(photoUrl);
      } catch {
        toast.error(isAr ? 'فشل استيراد الصورة — تأكد من الرابط' : 'Failed to import image — check the URL');
        setPhotoUrlLoading(false);
        return;
      }
      setPhotoUrlLoading(false);
    }
    const photo: Photo = { id: uid(), image: finalUrl, nameAr: photoNameAr, nameEn: photoNameEn, descriptionAr: photoDescAr, descriptionEn: photoDescEn };
    updateSiteData({ sections: siteData.sections.map(s => s.id === addPhotoSectionId ? { ...s, photos: [...s.photos, photo] } : s) });
    setPhotoUrl(''); setPhotoNameAr(''); setPhotoNameEn(''); setPhotoDescAr(''); setPhotoDescEn(''); setAddPhotoSectionId(null);
  };

  const handleDeletePhoto = (sectionId: string, photoId: string) => {
    if (!confirm(isAr ? 'حذف الصورة؟' : 'Delete this photo?')) return;
    updateSiteData({ sections: siteData.sections.map(s => s.id === sectionId ? { ...s, photos: s.photos.filter(p => p.id !== photoId) } : s) });
  };

  const handleDeleteSection = (id: string) => {
    if (!confirm(isAr ? 'حذف القسم وجميع صوره؟' : 'Delete this section and all photos?')) return;
    updateSiteData({ sections: siteData.sections.filter(s => s.id !== id) });
  };

  const handleMoveSection = (id: string, dir: 'up' | 'down') => {
    const idx = siteData.sections.findIndex(s => s.id === id);
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === siteData.sections.length - 1) return;
    const next = [...siteData.sections];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    updateSiteData({ sections: next });
  };

  const handleReorderPhotos = (sectionId: string, fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    updateSiteData({
      sections: siteData.sections.map(s => {
        if (s.id !== sectionId) return s;
        const photos = [...s.photos];
        const [moved] = photos.splice(fromIdx, 1);
        photos.splice(toIdx, 0, moved);
        return { ...s, photos };
      }),
    });
  };

  const handleQuickImageUpload = (sectionId: string, photo: Photo, url: string) => {
    updateSiteData({
      sections: siteData.sections.map(s =>
        s.id !== sectionId ? s : {
          ...s,
          photos: s.photos.map(p => p.id !== photo.id ? p : { ...p, image: url }),
        }
      ),
    });
    toast.success('تم تحديث الصورة');
  };

  const handleEditPhotoOpen = (sectionId: string, photo: Photo) => {
    setEditPhotoTarget({ sectionId, photo });
    setEditPhotoUrl(photo.image);
    setEditPhotoNameAr(photo.nameAr);
    setEditPhotoNameEn(photo.nameEn);
    setEditPhotoDescAr(photo.descriptionAr || '');
    setEditPhotoDescEn(photo.descriptionEn || '');
    setEditPhotoExtraImages(photo.extraImages ?? []);
  };

  const handleSaveEditPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPhotoTarget) return;
    let finalUrl = editPhotoUrl;
    if (editPhotoUrl.startsWith('http') && !editPhotoUrl.startsWith('/api/')) {
      setEditPhotoUrlLoading(true);
      try {
        finalUrl = await uploadImageFromUrl(editPhotoUrl);
      } catch {
        toast.error(isAr ? 'فشل استيراد الصورة — تأكد من الرابط' : 'Failed to import image — check the URL');
        setEditPhotoUrlLoading(false);
        return;
      }
      setEditPhotoUrlLoading(false);
    }
    const updated: Photo = {
      ...editPhotoTarget.photo,
      image: finalUrl,
      nameAr: editPhotoNameAr,
      nameEn: editPhotoNameEn,
      descriptionAr: editPhotoDescAr,
      descriptionEn: editPhotoDescEn,
      extraImages: editPhotoExtraImages,
    };
    updateSiteData({
      sections: siteData.sections.map(s =>
        s.id === editPhotoTarget.sectionId
          ? { ...s, photos: s.photos.map(p => p.id === updated.id ? updated : p) }
          : s
      ),
    });
    setEditPhotoTarget(null);
    toast.success(isAr ? 'تم حفظ التعديلات' : 'Changes saved');
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
      mapEmbedUrl: branchMapEmbed || undefined,
      coordinates: branchCoords.trim() || undefined,
    };
    updateSiteData({ branches: [...(siteData.branches ?? []), branch] });
    setBranchNameAr(''); setBranchNameEn(''); setBranchLocation(''); setBranchMapEmbed(''); setBranchCoords(''); setBranchImageUrl('');
    setAddBranchOpen(false);
    toast.success(isAr ? 'تمت إضافة الفرع' : 'Branch added');
  };

  const handleDeleteBranch = (id: string) => {
    if (!confirm(isAr ? 'حذف الفرع؟' : 'Delete this branch?')) return;
    updateSiteData({ branches: (siteData.branches ?? []).filter(b => b.id !== id) });
  };

  const openAddSocial = () => {
    setEditingSocial(null);
    setSocialPlatform('facebook');
    setSocialUrl('');
    setSocialModalOpen(true);
  };

  const openEditSocial = (link: SocialLink) => {
    setEditingSocial(link);
    setSocialPlatform(link.platform);
    setSocialUrl(link.url);
    setSocialModalOpen(true);
  };

  const handleSaveSocial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socialUrl.trim()) return;
    let finalUrl = socialUrl.trim();
    if (socialPlatform === 'email' && !finalUrl.startsWith('mailto:')) {
      finalUrl = `mailto:${finalUrl}`;
    }
    const links = siteData.socialLinks ?? [];
    if (editingSocial) {
      updateSiteData({ socialLinks: links.map(l => l.id === editingSocial.id ? { ...l, platform: socialPlatform, url: finalUrl } : l) });
      toast.success(isAr ? 'تم التعديل' : 'Updated');
    } else {
      const existing = links.find(l => l.platform === socialPlatform);
      if (existing) {
        updateSiteData({ socialLinks: links.map(l => l.platform === socialPlatform ? { ...l, url: finalUrl } : l) });
      } else {
        updateSiteData({ socialLinks: [...links, { id: uid(), platform: socialPlatform, url: finalUrl }] });
      }
      toast.success(isAr ? 'تمت الإضافة' : 'Added');
    }
    setSocialModalOpen(false);
  };

  const handleDeleteSocial = (id: string) => {
    if (!confirm(isAr ? 'حذف الرابط؟' : 'Delete this link?')) return;
    updateSiteData({ socialLinks: (siteData.socialLinks ?? []).filter(l => l.id !== id) });
  };

  if (!dataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="flex flex-col items-center gap-4">
          <svg width="56" height="76" viewBox="0 0 56 76" fill="none" className="animate-pulse">
            <polygon points="28,4 50,32 6,32" fill="#4a7c59"/>
            <polygon points="28,22 54,52 2,52" fill="#3d6b4a"/>
            <polygon points="28,40 56,72 0,72" fill="#2e5438"/>
            <rect x="23" y="72" width="10" height="12" rx="2" fill="#8b5e3c"/>
          </svg>
          <div className="w-8 h-8 border-4 border-green-700/30 border-t-green-700 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const ticker = siteData.newsTicker;
  const tickerActive = ticker?.enabled && ticker?.text;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ── NEWS TICKER BAR ── */}
      {(tickerActive || isAdmin) && (
        <div className="no-print fixed top-0 left-0 right-0 z-[60] bg-black text-white h-8 flex items-center overflow-hidden" dir="ltr">
          {/* Logo slot */}
          <div className="shrink-0 h-full flex items-center px-2 bg-black border-r border-white/20 gap-1.5">
            {ticker?.logoUrl ? (
              <div className="relative group/tlogo flex items-center">
                <img src={ticker.logoUrl} alt="logo" className="h-5 w-auto object-contain" />
                {isAdmin && (
                  <FileUploadBtn onFile={url => updateSiteData({ newsTicker: { ...ticker!, logoUrl: url } })}>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/tlogo:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <ImagePlus className="w-3 h-3 text-white" />
                    </div>
                  </FileUploadBtn>
                )}
              </div>
            ) : isAdmin ? (
              <FileUploadBtn onFile={url => updateSiteData({ newsTicker: { ...(ticker ?? { enabled: true, text: '' }), logoUrl: url } })}>
                <div className="w-5 h-5 border border-dashed border-white/40 rounded flex items-center justify-center cursor-pointer hover:border-white/80 transition-colors">
                  <ImagePlus className="w-3 h-3 text-white/60" />
                </div>
              </FileUploadBtn>
            ) : null}
          </div>

          {/* Scrolling text */}
          <div className="flex-1 overflow-hidden relative h-full flex items-center">
            {editingTicker ? (
              <form className="flex items-center gap-1 px-2 w-full" onSubmit={e => { e.preventDefault(); updateSiteData({ newsTicker: { ...(ticker ?? { enabled: true, logoUrl: '' }), text: tickerDraft } }); setEditingTicker(false); }}>
                <input autoFocus value={tickerDraft} onChange={e => setTickerDraft(e.target.value)}
                  className="flex-1 bg-white/10 text-white text-xs px-2 py-0.5 rounded border border-white/30 outline-none arabic"
                  placeholder="نص الشريط الإخباري..." dir="rtl" />
                <button type="submit" className="text-[10px] px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded">✓</button>
                <button type="button" onClick={() => setEditingTicker(false)} className="text-[10px] px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded">✗</button>
              </form>
            ) : (
              <>
                {ticker?.text
                  ? <span className="ticker-text text-xs arabic font-medium tracking-wide">{ticker.text}</span>
                  : isAdmin && <span className="text-xs text-white/40 arabic px-3">اضغط تحرير لكتابة نص الشريط...</span>
                }
              </>
            )}
          </div>

          {/* Admin controls */}
          {isAdmin && !editingTicker && (
            <div className="shrink-0 flex items-center gap-1 px-2 border-l border-white/20">
              <button onClick={() => { setTickerDraft(ticker?.text ?? ''); setEditingTicker(true); }}
                className="text-[10px] px-2 py-0.5 bg-white/15 hover:bg-white/25 rounded transition-colors">
                تحرير
              </button>
              <button onClick={() => updateSiteData({ newsTicker: { ...(ticker ?? { logoUrl: '', text: '' }), enabled: !ticker?.enabled } })}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${ticker?.enabled ? 'bg-green-600/60 hover:bg-red-600/60' : 'bg-white/15 hover:bg-white/25'}`}>
                {ticker?.enabled ? 'مفعّل' : 'مخفي'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TOP CONTROLS ── */}
      <div className="no-print fixed start-3 flex items-center gap-2 z-50" style={{ top: tickerActive || isAdmin ? '2.5rem' : '0.75rem' }}>
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
        <button className="no-print fixed end-3 w-2.5 h-2.5 rounded-full bg-border hover:bg-primary transition-colors z-50"
          style={{ top: tickerActive ? '2.75rem' : '0.75rem' }}
          onClick={() => openLoginModal()} aria-label="Admin" />
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
              ? <InlineEdit value={isAr ? siteData.titleAr : siteData.titleEn} onSave={v => updateSiteData(isAr ? { titleAr: v } : { titleEn: v })} className="arabic text-3xl md:text-4xl font-bold" />
              : (isAr ? siteData.titleAr : (siteData.titleEn || siteData.titleAr))}
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground tracking-[0.2em] uppercase latin">
            {isAr ? siteData.titleEn : siteData.titleAr}
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
        {(() => {
          const allPhotos = [
            ...(siteData.owner?.photo ? [siteData.owner.photo] : []),
            ...(siteData.owner?.extraPhotos ?? []),
          ];
          const safeIdx = Math.min(ownerPhotoIdx, Math.max(0, allPhotos.length - 1));
          const bgUrl = siteData.owner?.bgImage || '/nursery-owner-bg.jpg';
          return (
            <div
              className="relative overflow-hidden min-h-[380px] md:min-h-[440px]"
              style={{ backgroundImage: `url(${bgUrl})`, backgroundSize: 'cover', backgroundPosition: 'center 30%' }}
            >
              {/* Gradient overlay — heavier on RIGHT side (where content sits) */}
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.08) 0%, rgba(0,10,3,0.40) 40%, rgba(0,15,5,0.82) 70%, rgba(0,18,5,0.94) 100%)' }}
              />
              {/* Subtle top/bottom vignette */}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.20) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.30) 100%)' }} />

              {/* Content — pushed to the RIGHT (justify-start in RTL = visual right) */}
              <div className="relative h-full flex items-center justify-start px-6 md:px-14 py-12 md:py-16" dir="rtl">
                <div className="flex flex-col md:flex-row items-center gap-8 md:gap-10 max-w-xl w-full md:w-auto">

                  {/* Photo column — circle with transparent offset (no white BG) */}
                  <div className="flex flex-col items-center gap-4 shrink-0">
                    <div className="relative group/owner">
                      {/* Decorative outer rings */}
                      <div className="absolute inset-0 rounded-full ring-1 ring-white/20 scale-110 pointer-events-none" />
                      <div className="absolute inset-0 rounded-full ring-1 ring-white/10 scale-125 pointer-events-none" />
                      {/* Circle — ring-offset-transparent so no white gap */}
                      <div className="w-44 h-44 md:w-52 md:h-52 rounded-full overflow-hidden ring-[3px] ring-white/70 ring-offset-4 ring-offset-transparent shadow-[0_0_40px_rgba(0,0,0,0.55)]">
                        <img
                          src={allPhotos[safeIdx] || '/owner.png'}
                          alt="مهندس ثامر القادري"
                          className="w-full h-full object-cover object-top scale-105 transition-all duration-500"
                        />
                      </div>
                      {/* Green status dot */}
                      <div className="absolute bottom-2 end-2 w-5 h-5 rounded-full bg-green-400 ring-2 ring-black/30 shadow-md" />
                      {isAdmin && (
                        <FileUploadBtn
                          onFile={url => updateSiteData({ owner: { ...siteData.owner, photo: url } })}
                          className="no-print absolute inset-0 rounded-full flex flex-col items-center justify-center gap-1 bg-black/60 text-white opacity-0 group-hover/owner:opacity-100 transition-opacity cursor-pointer"
                        >
                          <ImagePlus className="w-7 h-7" />
                          <span className="text-xs arabic font-semibold">{isAr ? 'تغيير الصورة' : 'Change'}</span>
                        </FileUploadBtn>
                      )}
                    </div>

                    {/* Thumbnail strip */}
                    {(allPhotos.length > 1 || isAdmin) && (
                      <div className="flex items-center gap-2 flex-wrap justify-center">
                        {allPhotos.map((ph, idx) => (
                          <div key={idx} className="relative group/thumb">
                            <button
                              onClick={() => setOwnerPhotoIdx(idx)}
                              className={`w-9 h-9 rounded-full overflow-hidden ring-2 transition-all ${safeIdx === idx ? 'ring-white scale-110 shadow-md' : 'ring-white/30 opacity-60 hover:opacity-100'}`}
                            >
                              <img src={ph} alt="" className="w-full h-full object-cover object-top" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  if (idx === 0) {
                                    const next = allPhotos.slice(1);
                                    updateSiteData({ owner: { ...siteData.owner, photo: next[0] ?? '', extraPhotos: next.slice(1) } });
                                  } else {
                                    updateSiteData({ owner: { ...siteData.owner, extraPhotos: (siteData.owner?.extraPhotos ?? []).filter((_, i) => i !== idx - 1) } });
                                  }
                                  setOwnerPhotoIdx(0);
                                }}
                                className="no-print absolute -top-0.5 -end-0.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        {isAdmin && (
                          <FileUploadBtn
                            onFile={url => {
                              const extras = siteData.owner?.extraPhotos ?? [];
                              updateSiteData({ owner: { ...siteData.owner, extraPhotos: [...extras, url] } });
                            }}
                          >
                            <div className="w-9 h-9 rounded-full border-2 border-dashed border-white/40 bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer transition-colors">
                              <Plus className="w-4 h-4 text-white/70" />
                            </div>
                          </FileUploadBtn>
                        )}
                      </div>
                    )}
                    {isAdmin && allPhotos.length <= 1 && (
                      <FileUploadBtn
                        onFile={url => updateSiteData({ owner: { ...siteData.owner, extraPhotos: [...(siteData.owner?.extraPhotos ?? []), url] } })}
                      >
                        <div className="no-print flex items-center gap-1 text-xs cursor-pointer arabic text-white/50 hover:text-white transition-colors">
                          <Plus className="w-3 h-3" />
                          {isAr ? 'إضافة صورة أخرى' : 'Add photo'}
                        </div>
                      </FileUploadBtn>
                    )}
                  </div>

                  {/* Info column */}
                  <div className="flex flex-col items-center md:items-start gap-3 text-center md:text-start">
                    {/* Badge */}
                    <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold arabic tracking-widest uppercase bg-white/10 text-white border border-white/25 backdrop-blur-sm shadow-sm">
                      {isAr ? 'المدير العام' : 'General Manager'}
                    </span>

                    {/* Name */}
                    <h2 className="text-3xl md:text-4xl font-bold arabic leading-tight text-white drop-shadow-lg mt-1">
                      {isAr ? 'مهندس ثامر القادري' : 'Eng. Thamer Al-Qadri'}
                    </h2>
                    <p className="text-sm latin tracking-[0.2em] uppercase text-white/55 -mt-1">
                      {isAr ? 'ENG. THAMER AL-QADRI' : 'مهندس ثامر القادري'}
                    </p>

                    {/* Decorative divider */}
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="h-px w-8 bg-white/30" />
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400/80" />
                      <div className="h-px flex-1 bg-white/15" />
                    </div>

                    {/* Phone */}
                    <a href="tel:0777772211" className="flex items-center gap-3 group/phone" dir="ltr">
                      <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center group-hover/phone:bg-white/20 transition-colors">
                        <span className="text-sm">📞</span>
                      </div>
                      <span className="text-lg font-mono font-bold tracking-widest text-white group-hover/phone:text-white/80 transition-colors">
                        0777772211
                      </span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Admin controls — top-left (visual) = top-start in RTL */}
              {isAdmin && (
                <div className="no-print absolute top-3 start-3 flex gap-1.5 z-10">
                  <FileUploadBtn onFile={url => updateSiteData({ owner: { ...siteData.owner, bgImage: url } })}>
                    <div className="h-7 px-3 rounded-full bg-black/60 text-white text-xs flex items-center gap-1.5 cursor-pointer hover:bg-black/80 transition-colors backdrop-blur-sm arabic whitespace-nowrap">
                      <ImagePlus className="w-3 h-3" />
                      {isAr ? 'تغيير الخلفية' : 'Change BG'}
                    </div>
                  </FileUploadBtn>
                  {siteData.owner?.bgImage && (
                    <button
                      onClick={() => updateSiteData({ owner: { ...siteData.owner, bgImage: '' } })}
                      className="h-7 px-2 rounded-full bg-red-500/80 text-white text-xs flex items-center gap-1 hover:bg-red-600 transition-colors backdrop-blur-sm arabic"
                      title={isAr ? 'استعادة الخلفية الافتراضية' : 'Reset to default BG'}
                    >
                      <X className="w-3 h-3" />
                      <span className="text-[10px]">{isAr ? 'إعادة' : 'Reset'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </header>

      {/* ── FEATURED IMAGES ── */}
      <FeaturedImagesSection
        images={siteData.featuredImages ?? []}
        video={siteData.featuredVideo ?? null}
        mode={siteData.featuredMode ?? 'images'}
        isAr={isAr}
        isAdmin={isAdmin}
        onUpdate={items => updateSiteData({ featuredImages: items })}
        onUpdateVideo={v => updateSiteData({ featuredVideo: v })}
        onUpdateMode={m => updateSiteData({ featuredMode: m })}
      />

      {/* ── STORE SHOWCASE ── */}
      <StoreShowcaseSection
        items={siteData.storeShowcase ?? []}
        isAr={isAr}
        isAdmin={isAdmin}
        onUpdate={items => updateSiteData({ storeShowcase: items })}
      />

      {/* ── GALLERY TITLE ── */}
      <div className="text-center pt-12 pb-2 px-4">
        <h2 className="text-2xl md:text-3xl font-bold arabic text-foreground mb-2">{isAr ? 'معرض مشاتل القادري الزراعية' : 'Al-Qadri Nurseries Gallery'}</h2>
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-px bg-foreground/20" />
          <div className="w-2 h-2 rounded-full bg-foreground/30" />
          <div className="w-12 h-px bg-foreground/20" />
        </div>
      </div>

      {/* ── SEARCH + QUOTE BUTTON ── */}
      <div className="px-4 md:px-12 pt-6 pb-0 flex gap-2 max-w-2xl mx-auto w-full">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'ابحث عن نبات أو شجرة...' : 'Search plants...'}
            className="w-full ps-9 pe-3 h-10 rounded-xl border border-border bg-card text-sm arabic focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
            dir={isAr ? 'rtl' : 'ltr'}
          />
        </div>
        <button
          onClick={() => setQuoteOpen(true)}
          className="no-print relative flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold arabic whitespace-nowrap hover:bg-primary/90 transition-colors shadow-sm"
        >
          <ReceiptIcon className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">{isAr ? 'طلب عرض سعر' : 'Request Quote'}</span>
          <span className="sm:hidden">{isAr ? 'عرض سعر' : 'Quote'}</span>
          {quoteCart.length > 0 && (
            <span className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {quoteCart.length}
            </span>
          )}
        </button>
      </div>

      {/* ── SEARCH NOTE ── */}
      {(isAdmin || (siteData.searchNote?.ar || siteData.searchNote?.en)) && (
        <div className="px-4 md:px-12 pt-3 pb-0 max-w-2xl mx-auto w-full">
          {isAdmin ? (
            <div className="group relative">
              <InlineEdit
                value={isAr ? (siteData.searchNote?.ar || '') : (siteData.searchNote?.en || '')}
                onSave={v => {
                  const note = siteData.searchNote ?? { ar: '', en: '' };
                  updateSiteData({ searchNote: isAr ? { ...note, ar: v } : { ...note, en: v } });
                }}
                className="text-sm text-muted-foreground arabic w-full block"
              />
              {!(siteData.searchNote?.ar || siteData.searchNote?.en) && (
                <span className="text-xs text-primary/50 italic arabic">
                  {isAr ? 'انقر مرتين لإضافة ملاحظة تحت البحث...' : 'Double-click to add a note below search...'}
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground arabic text-center">
              {isAr ? siteData.searchNote?.ar : (siteData.searchNote?.en || siteData.searchNote?.ar)}
            </p>
          )}
        </div>
      )}

      {/* ── SECTIONS ── */}
      <main className="flex-1 px-4 md:px-12 py-10 space-y-16">
        {(() => {
          const q = searchQuery.trim().toLowerCase();
          const filtered = q
            ? siteData.sections
                .map(s => ({ ...s, photos: s.photos.filter(p => p.nameAr.toLowerCase().includes(q) || p.nameEn.toLowerCase().includes(q)) }))
                .filter(s => s.photos.length > 0)
            : siteData.sections;
          return filtered;
        })().map((section, _i, arr) => {
          const realIdx = siteData.sections.findIndex(s => s.id === section.id);
          return (
          <SectionBlock key={section.id}
            section={section} lang={lang} isAdmin={isAdmin}
            onUpdateName={(f, v) => updateSectionName(section.id, f, v)}
            onAddPhoto={() => setAddPhotoSectionId(section.id)}
            onDeletePhoto={pid => handleDeletePhoto(section.id, pid)}
            onEditPhoto={photo => handleEditPhotoOpen(section.id, photo)}
            onDeleteSection={() => handleDeleteSection(section.id)}
            onDownloadPDF={() => setPdfModalTarget(section.id)}
            onMoveUp={() => handleMoveSection(section.id, 'up')}
            onMoveDown={() => handleMoveSection(section.id, 'down')}
            isFirst={realIdx === 0}
            isLast={realIdx === siteData.sections.length - 1}
            onOpenLightbox={setLightboxPhoto}
            onReorderPhotos={(from, to) => handleReorderPhotos(section.id, from, to)}
            onImageUpload={(photo, url) => handleQuickImageUpload(section.id, photo, url)}
          />
          );
        })}
        {siteData.sections.length === 0 && (
          <div className="text-center py-20 text-muted-foreground arabic">
            {isAr ? 'لا توجد أقسام بعد' : 'No sections yet'}
          </div>
        )}
      </main>

      {/* ── SERVICES ── */}
      <section className="border-y border-border bg-muted/20 px-4 md:px-12 py-12">
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="flex-1 h-px bg-foreground/15" />
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold arabic text-foreground">{isAr ? 'خدماتنا' : 'Our Services'}</h2>
            <p className="text-xs text-muted-foreground tracking-widest uppercase latin mt-0.5">{isAr ? 'Our Services' : 'خدماتنا'}</p>
          </div>
          <div className="flex-1 h-px bg-foreground/15" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
          {[
            { icon: <TreePine className="w-8 h-8" />, nameAr: 'قسم الأشجار', nameEn: 'Trees Division' },
            { icon: <Package className="w-8 h-8" />, nameAr: 'توريد المنتجات الزراعية', nameEn: 'Agricultural Supply' },
            { icon: <Building2 className="w-8 h-8" />, nameAr: 'تأسيس المشاريع الزراعية', nameEn: 'Agricultural Projects' },
            { icon: <Globe className="w-8 h-8" />, nameAr: 'الاستيراد والتصدير', nameEn: 'Import & Export' },
            { icon: <Flower2 className="w-8 h-8" />, nameAr: 'تنسيق وصيانة الحدائق', nameEn: 'Garden Landscaping' },
          ].map((service, i) => (
            <div key={i} className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow text-center">
              <div className="w-14 h-14 rounded-full bg-foreground/8 flex items-center justify-center text-foreground/70">
                {service.icon}
              </div>
              <p className="text-sm font-bold arabic text-foreground leading-snug">{isAr ? service.nameAr : service.nameEn}</p>
              <p className="text-[10px] text-muted-foreground latin tracking-wide uppercase">{isAr ? service.nameEn : service.nameAr}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SOCIAL LINKS ── */}
      {((siteData.socialLinks ?? []).length > 0 || isAdmin) && (
        <section className="px-4 md:px-12 py-12 border-t border-border bg-background">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex-1 h-px bg-foreground/15" />
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold arabic text-foreground">{isAr ? 'روابطنا' : 'Our Links'}</h2>
              <p className="text-xs text-muted-foreground tracking-widest uppercase latin mt-0.5">{isAr ? 'Our Links' : 'روابطنا'}</p>
            </div>
            <div className="flex-1 h-px bg-foreground/15" />
            {isAdmin && (
              <button
                onClick={openAddSocial}
                className="no-print shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="arabic">{isAr ? 'إضافة رابط' : 'Add Link'}</span>
              </button>
            )}
          </div>

          {(siteData.socialLinks ?? []).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm border-2 border-dashed border-border rounded-2xl arabic">
              {isAr ? 'لا توجد روابط بعد — اضغط "إضافة رابط" لإضافة أول رابط' : 'No links yet — click "Add Link" to add one'}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-6 flex-wrap max-w-2xl mx-auto">
              {(siteData.socialLinks ?? []).map(link => {
                const cfg = SOCIAL_PLATFORMS.find(p => p.value === link.platform)!;
                return (
                  <div key={link.id} className="relative group/social flex flex-col items-center gap-2">
                    <a
                      href={link.url ? (link.url.startsWith('http') ? link.url : `https://${link.url}`) : '#'}
                      target={link.url ? '_blank' : undefined}
                      rel="noreferrer noopener"
                      onClick={e => { if (!link.url) e.preventDefault(); }}
                      className="block transition-transform duration-200 hover:scale-110 hover:-translate-y-0.5 drop-shadow-md hover:drop-shadow-xl"
                      title={isAr ? cfg.labelAr : cfg.labelEn}
                    >
                      <SocialIcon platform={link.platform} size={56} />
                    </a>
                    <span className="text-xs text-muted-foreground arabic font-medium">{isAr ? cfg.labelAr : cfg.labelEn}</span>
                    {isAdmin && (
                      <div className="no-print absolute -top-2 -end-2 flex gap-0.5 opacity-0 group-hover/social:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEditSocial(link)}
                          className="w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary/80 transition-colors"
                          title={isAr ? 'تعديل' : 'Edit'}
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSocial(link.id)}
                          className="w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center hover:bg-red-700 transition-colors"
                          title={isAr ? 'حذف' : 'Delete'}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ── BRANCH MAP SECTION ── */}
      <section className="bg-[#0d2614] py-14 px-4 md:px-12">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 mb-10">
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-emerald-400" />
            <h2 className="arabic text-2xl font-bold text-white tracking-wide">فروعنا على الخريطة</h2>
            <MapPin className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="w-16 h-0.5 rounded-full bg-emerald-500/60 mt-1" />
        </div>

        {/* 6-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 max-w-7xl mx-auto">
          {/* Branch 1 – بوابة الشمال */}
          <div className="group rounded-2xl overflow-hidden shadow-xl border border-white/10 bg-white/5 backdrop-blur-sm flex flex-col transition-transform hover:-translate-y-1 duration-300">
            <div className="relative overflow-hidden" style={{ height: 260 }}>
              <iframe
                title="مشتل بوابة الشمال"
                src="https://maps.google.com/maps?q=6V8M%2B8F5+%D8%AC%D8%B1%D8%B4%2C+%D8%A7%D9%84%D8%A3%D8%B1%D8%AF%D9%86&z=16&output=embed&hl=ar"
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-t-2xl" />
            </div>
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="arabic text-white font-semibold text-sm leading-tight">مشتل بوابة-جسر السيل</span>
                <span className="arabic text-emerald-300/70 text-xs">مشاتل القادري الزراعية</span>
              </div>
              <a
                href="https://maps.app.goo.gl/wAR3tZPQFRTC8Lcm6"
                target="_blank"
                rel="noreferrer"
                className="arabic shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                الاتجاهات
              </a>
            </div>
          </div>

          {/* Branch 2 – الرشايدة */}
          <div className="group rounded-2xl overflow-hidden shadow-xl border border-white/10 bg-white/5 backdrop-blur-sm flex flex-col transition-transform hover:-translate-y-1 duration-300">
            <div className="relative overflow-hidden" style={{ height: 260 }}>
              <iframe
                title="مشتل الرشايدة"
                src="https://maps.google.com/maps?q=32.2645247,35.8972786&z=16&output=embed&hl=ar"
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-t-2xl" />
            </div>
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="arabic text-white font-semibold text-sm leading-tight">مشتل الرشايدة</span>
                <span className="arabic text-emerald-300/70 text-xs">مشاتل القادري الزراعية</span>
              </div>
              <a
                href="https://maps.app.goo.gl/NYeaSdKKni6mXKVv8"
                target="_blank"
                rel="noreferrer"
                className="arabic shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                الاتجاهات
              </a>
            </div>
          </div>

          {/* Branch 3 – المشتل الرئيسي */}
          <div className="group rounded-2xl overflow-hidden shadow-xl border border-white/10 bg-white/5 backdrop-blur-sm flex flex-col transition-transform hover:-translate-y-1 duration-300">
            <div className="relative overflow-hidden" style={{ height: 260 }}>
              <iframe
                title="المشتل الرئيسي"
                src="https://maps.google.com/maps?q=32.554679,35.796279&z=15&output=embed&hl=ar"
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-t-2xl" />
            </div>
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="arabic text-white font-semibold text-sm leading-tight">مشتل اربد — كفر يوبا</span>
                <span className="arabic text-emerald-300/70 text-xs">مشاتل القادري الزراعية</span>
              </div>
              <a
                href="https://maps.app.goo.gl/6gCRmpEuGQqFP6iD8"
                target="_blank"
                rel="noreferrer"
                className="arabic shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                الاتجاهات
              </a>
            </div>
          </div>

          {/* Branch 4 – مادبا */}
          <div className="group rounded-2xl overflow-hidden shadow-xl border border-white/10 bg-white/5 backdrop-blur-sm flex flex-col transition-transform hover:-translate-y-1 duration-300">
            <div className="relative overflow-hidden" style={{ height: 260 }}>
              <iframe
                title="مشتل مادبا"
                src="https://maps.google.com/maps?q=%D9%85%D8%B4%D8%A7%D8%AA%D9%84+%D8%A7%D9%84%D9%82%D8%A7%D8%AF%D8%B1%D9%8A+%D8%A7%D9%84%D8%B2%D8%B1%D8%A7%D8%B9%D9%8A%D8%A9+%D8%A7%D9%85+%D8%A7%D9%84%D8%B9%D9%85%D8%AF+%D9%85%D8%A7%D8%AF%D8%A8%D8%A7&z=15&output=embed&hl=ar"
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-t-2xl" />
            </div>
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="arabic text-white font-semibold text-sm leading-tight">مشتل مادبا — ام العمد</span>
                <span className="arabic text-emerald-300/70 text-xs">مشاتل القادري الزراعية</span>
              </div>
              <a
                href="https://share.google/Bo0YwWOPgtvuCLcAJ"
                target="_blank"
                rel="noreferrer"
                className="arabic shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                الاتجاهات
              </a>
            </div>
          </div>

          {/* Branch 5 – الكرك */}
          <div className="group rounded-2xl overflow-hidden shadow-xl border border-white/10 bg-white/5 backdrop-blur-sm flex flex-col transition-transform hover:-translate-y-1 duration-300">
            <div className="relative overflow-hidden" style={{ height: 260 }}>
              <iframe
                title="مشتل الكرك"
                src="https://maps.google.com/maps?q=31.1709744,35.7330598&z=15&output=embed&hl=ar"
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-t-2xl" />
            </div>
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="arabic text-white font-semibold text-sm leading-tight">مشتل الكرك - الثنية</span>
                <span className="arabic text-emerald-300/70 text-xs">مشاتل القادري الزراعية</span>
              </div>
              <a
                href="https://maps.app.goo.gl/cq5ndF9QjdZ3Ko3h7"
                target="_blank"
                rel="noreferrer"
                className="arabic shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                الاتجاهات
              </a>
            </div>
          </div>

          {/* Branch 6 – الأغوار */}
          <div className="group rounded-2xl overflow-hidden shadow-xl border border-white/10 bg-white/5 backdrop-blur-sm flex flex-col transition-transform hover:-translate-y-1 duration-300">
            <div className="relative overflow-hidden" style={{ height: 260 }}>
              <iframe
                title="مزرعة الأغوار"
                src="https://maps.google.com/maps?q=%D9%85%D8%B2%D8%B1%D8%B9%D8%A9+%D8%A7%D9%84%D9%82%D8%A7%D8%AF%D8%B1%D9%8A+%D8%A7%D9%84%D8%B4%D9%88%D9%86%D8%A9+%D8%A7%D9%84%D8%B4%D9%85%D8%A7%D9%84%D9%8A%D8%A9&z=14&output=embed&hl=ar"
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-t-2xl" />
            </div>
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="arabic text-white font-semibold text-sm leading-tight">مزرعة الاغوار — الشونة الشمالية</span>
                <span className="arabic text-emerald-300/70 text-xs">مشاتل القادري الزراعية</span>
              </div>
              <a
                href="https://share.google/qKy3QZErdK1cNaUOg"
                target="_blank"
                rel="noreferrer"
                className="arabic shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                الاتجاهات
              </a>
            </div>
          </div>

          {/* Dynamic branches added via admin */}
          {(siteData.branches ?? []).map(branch => (
            <div key={branch.id} className="group relative rounded-2xl overflow-hidden shadow-xl border border-white/10 bg-white/5 backdrop-blur-sm flex flex-col transition-transform hover:-translate-y-1 duration-300">
              <div className="relative overflow-hidden" style={{ height: 260 }}>
                {(branch.mapEmbedUrl || branch.coordinates) ? (
                  <iframe
                    title={branch.nameAr}
                    src={branch.mapEmbedUrl || `https://maps.google.com/maps?q=${encodeURIComponent(branch.coordinates!)}&z=16&output=embed`}
                    className="w-full h-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (branch.image || siteData.owner.bgImage) ? (
                  <img src={branch.image || siteData.owner.bgImage} alt={branch.nameAr} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <MapPin className="w-12 h-12 text-emerald-400/40" />
                  </div>
                )}
                <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-white/10 rounded-t-2xl" />
              </div>
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="arabic text-white font-semibold text-sm leading-tight">{isAr ? branch.nameAr : (branch.nameEn || branch.nameAr)}</span>
                  <span className="arabic text-emerald-300/70 text-xs">مشاتل القادري الزراعية</span>
                </div>
                {branch.locationUrl && (
                  <a
                    href={branch.locationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="arabic shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    الاتجاهات
                  </a>
                )}
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleDeleteBranch(branch.id)}
                  className="no-print absolute top-2 end-2 w-7 h-7 bg-black/55 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 backdrop-blur-sm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Contact bar */}
        {(siteData.footer.website || siteData.footer.phone || siteData.footer.email) && (
          <div className="mt-10 pt-8 border-t border-white/10 flex flex-wrap items-center justify-center gap-6 sm:gap-12">
            {siteData.footer.website && (
              <a
                href={siteData.footer.website.startsWith('http') ? siteData.footer.website : `https://${siteData.footer.website}`}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center shrink-0 group-hover:bg-emerald-600/50 transition-colors">
                  <Globe className="w-5 h-5 text-emerald-300" />
                </div>
                <span className="text-white/90 text-base font-medium latin tracking-wide">{siteData.footer.website}</span>
              </a>
            )}
            {siteData.footer.phone && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-emerald-300" />
                </div>
                <span dir="ltr" className="text-white/90 text-base font-medium font-mono tracking-wide">{siteData.footer.phone}</span>
              </div>
            )}
            {siteData.footer.email && (
              <a
                href={`mailto:${siteData.footer.email}`}
                className="group flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center shrink-0 group-hover:bg-emerald-600/50 transition-colors">
                  <Mail className="w-5 h-5 text-emerald-300" />
                </div>
                <span className="text-white/90 text-base font-medium latin tracking-wide">{siteData.footer.email}</span>
              </a>
            )}
          </div>
        )}
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-4 px-8 bg-card">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-foreground/60 text-center">
          {(isAr ? siteData.footer.noteAr : siteData.footer.noteEn) && (
            <span className="arabic whitespace-nowrap">{isAr ? siteData.footer.noteAr : siteData.footer.noteEn}</span>
          )}
        </div>
      </footer>

      {/* ── ADMIN SIDEBAR ── */}
      {isAdmin && (
        <>
          {/* Hidden file inputs */}
          <input ref={restoreInputRef} type="file" accept=".json" className="hidden" onChange={handleRestoreFile} />
          <input ref={financialRestoreInputRef} type="file" accept=".json" className="hidden" onChange={handleFinancialRestoreFile} />
          <input ref={quoteRestoreInputRef} type="file" accept=".json" className="hidden" onChange={handleQuoteRestoreFile} />

          {/* Sidebar — fixed on physical RIGHT, always visible */}
          <div
            className="no-print fixed top-0 bottom-0 z-50 flex"
            style={{ right: 0, width: sidebarOpen ? 230 : 48, transition: 'width 0.25s ease' }}
          >
            {/* Collapse tab */}
            <button
              onClick={() => setSidebarOpen(o => !o)}
              className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-12 rounded-l-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors z-10"
              title={sidebarOpen ? 'إخفاء' : 'إظهار'}
            >
              {sidebarOpen
                ? <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
                : <ChevronDown className="w-3.5 h-3.5 rotate-90" />}
            </button>

            {/* Panel */}
            <div className="flex-1 h-full flex flex-col bg-card border-l border-border shadow-2xl overflow-hidden">

              {sidebarOpen ? (
                <>
                  {/* Header */}
                  <div className="shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-border"
                    style={{ background: 'linear-gradient(135deg,#1b5e2010,#2e7d3218)' }}>
                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 shadow-sm flex items-center justify-center bg-primary">
                      {siteData.logo?.customUrl
                        ? <img src={siteData.logo.customUrl} alt="logo" className="w-full h-full object-contain p-0.5" />
                        : <TreePine className="w-4 h-4 text-primary-foreground" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold arabic text-foreground leading-tight">{isAr ? 'لوحة التحكم' : 'Admin Panel'}</p>
                      <p className="text-[10px] text-muted-foreground arabic">{siteData.titleAr || (isAr ? 'مشاتل القادري' : 'Al-Qadri')}</p>
                    </div>
                    {pendingQuoteCount > 0 && (
                      <span className="ms-auto shrink-0 min-w-[22px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {pendingQuoteCount > 99 ? '99+' : pendingQuoteCount}
                      </span>
                    )}
                  </div>

                  {/* Scrollable content */}
                  <div className="flex-1 overflow-y-auto p-2.5 space-y-3">

                    <SideSection label={isAr ? '📋 المحتوى' : '📋 Content'}>
                      <SideBtn icon={<FolderPlus className="w-4 h-4" />} label={isAr ? 'قسم جديد' : 'New Section'} onClick={() => setAddSecOpen(true)} />
                      <SideBtn icon={<MapPin className="w-4 h-4" />} label={isAr ? 'فرع جديد' : 'New Branch'} onClick={() => setAddBranchOpen(true)} />
                      <SideBtn icon={<Share2 className="w-4 h-4" />} label={isAr ? 'روابطنا' : 'Social Links'} onClick={openAddSocial} />
                      <SideBtn icon={<Settings className="w-4 h-4" />} label={isAr ? 'التواصل' : 'Contact Info'} onClick={() => { setFooterDraft({ ...siteData.footer }); setFooterOpen(true); }} />
                    </SideSection>

                    <SideSection label={isAr ? '💰 السجلات المالية' : '💰 Financial'}>
                      <SideBtnBadge icon={<Inbox className="w-4 h-4" />} label={isAr ? 'طلبات العروض' : 'Quote Requests'} badge={pendingQuoteCount} onClick={() => { setAdminQuotesOpen(true); setPendingQuoteCount(0); }} />
                      <SideBtn icon={<FileText className="w-4 h-4" />} label={isAr ? 'الفواتير' : 'Invoices'} onClick={() => setAdminInvoicesOpen(true)} />
                      <SideSubBtn icon={<FileText className="w-3.5 h-3.5" />} label="عروض قادري قديم" onClick={() => setQadriOldOpen(true)} />
                      <SideSubBtn icon={<FileText className="w-3.5 h-3.5" />} label="عروض دون ترويسة" onClick={() => setNoHeaderOpen(true)} />
                      <SideBtn icon={<ReceiptIcon className="w-4 h-4" />} label={isAr ? 'سندات القبض' : 'Receipts'} onClick={() => setAdminReceiptsOpen(true)} />
                      <SideBtn icon={<ArrowUpFromLine className="w-4 h-4" />} label={isAr ? 'سندات الصرف' : 'Disbursements'} onClick={() => setAdminDisbursementsOpen(true)} />
                    </SideSection>

                    <SideSection label={isAr ? '📄 التقارير' : '📄 Reports'}>
                      <SideBtn icon={<Award className="w-4 h-4" />} label={isAr ? 'شهادة خبرة' : 'Certificate'} onClick={() => setCertOpen(true)} />
                      <SideBtn icon={<FileDown className="w-4 h-4" />} label={isAr ? 'كتالوج PDF' : 'PDF Catalog'} highlight onClick={() => setPdfModalTarget('all')} />
                      <SideBtn icon={<FileSpreadsheet className="w-4 h-4" />} label={isAr ? 'استيراد Excel' : 'Import Excel'} onClick={() => { setXlsxOpen(true); setXlsxResult(null); setXlsxError(null); }} />
                    </SideSection>

                    <SideSection label={isAr ? '💾 النسخ الاحتياطية' : '💾 Backups'}>
                      <SideBtn icon={<Download className="w-4 h-4" />} label={isAr ? 'باك أب النباتات' : 'Plants Backup'} onClick={handleBackup} />
                      <SideBtn icon={restoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} label={isAr ? 'استرجاع النباتات' : 'Plants Restore'} onClick={() => restoreInputRef.current?.click()} />
                      <SideBtn icon={financialBackingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} label={isAr ? 'باك أب مالي' : 'Financial Backup'} onClick={handleFinancialBackup} />
                      <SideBtn icon={financialRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} label={isAr ? 'استرجاع مالي' : 'Financial Restore'} onClick={() => financialRestoreInputRef.current?.click()} />
                      <SideBtn icon={quoteBacking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} label={isAr ? 'باك أب العروض' : 'Quotes Backup'} onClick={handleQuoteBackup} />
                      <SideBtn icon={quoteRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} label={isAr ? 'استرجاع العروض' : 'Quotes Restore'} onClick={() => quoteRestoreInputRef.current?.click()} />
                    </SideSection>
                  </div>

                  {/* Logout */}
                  <div className="shrink-0 border-t border-border p-2.5">
                    <button
                      onClick={() => { setSessionToken(null); setIsAdmin(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium arabic"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>{isAr ? 'تسجيل الخروج' : 'Logout'}</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Collapsed — show icon strip */
                <div className="flex-1 flex flex-col items-center py-4 gap-3 overflow-y-auto">
                  <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-sm shrink-0">
                    <TreePine className="w-4 h-4 text-primary-foreground" />
                  </div>
                  {pendingQuoteCount > 0 && (
                    <button onClick={() => { setAdminQuotesOpen(true); setPendingQuoteCount(0); }}
                      className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-accent transition-colors text-primary">
                      <Inbox className="w-4.5 h-4.5" />
                      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {pendingQuoteCount > 99 ? '99+' : pendingQuoteCount}
                      </span>
                    </button>
                  )}
                  {[
                    { icon: <FolderPlus className="w-4 h-4" />, action: () => setAddSecOpen(true) },
                    { icon: <FileText className="w-4 h-4" />, action: () => setAdminInvoicesOpen(true) },
                    { icon: <FileDown className="w-4 h-4" />, action: () => setPdfModalTarget('all') },
                  ].map((item, i) => (
                    <button key={i} onClick={item.action}
                      className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-accent transition-colors text-primary">
                      {item.icon}
                    </button>
                  ))}
                  <div className="flex-1" />
                  <button onClick={() => { setSessionToken(null); setIsAdmin(false); }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-destructive/10 transition-colors text-destructive">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── MODALS ── */}

      {/* ── Excel Import Dialog ── */}
      <Dialog open={xlsxOpen} onOpenChange={o => { setXlsxOpen(o); if (!o) { setXlsxResult(null); setXlsxError(null); } }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="arabic flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              {isAr ? 'استيراد نباتات من Excel' : 'Import Plants from Excel'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Format guide */}
            <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-2">
              <p className="text-xs font-bold arabic text-foreground/70">{isAr ? 'أعمدة الملف المطلوبة:' : 'Required Excel columns:'}</p>
              <div className="grid grid-cols-2 gap-1 text-xs arabic text-foreground/60">
                <span>القسم</span><span className="text-muted-foreground">section name (AR)</span>
                <span>الاسم العربي</span><span className="text-muted-foreground">plant name (AR)</span>
                <span>الاسم الانجليزي</span><span className="text-muted-foreground">plant name (EN) — optional</span>
                <span>رابط الصورة</span><span className="text-muted-foreground">image URL</span>
                <span>الوصف العربي</span><span className="text-muted-foreground">description (AR) — optional</span>
              </div>
              <p className="text-[10px] text-muted-foreground arabic">{isAr ? '⚠ استخدم روابط صور (http...) وليس صور مرفوعة' : '⚠ Use image URLs (http...) not uploaded images'}</p>
            </div>

            {/* Result / Error */}
            {xlsxError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-sm arabic text-destructive">{xlsxError}</div>
            )}
            {xlsxResult && (
              <div className="rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3 space-y-1">
                <p className="text-sm font-bold arabic text-green-700 dark:text-green-400">
                  ✓ {isAr ? `تمت إضافة ${xlsxResult.added} نبتة بنجاح` : `Added ${xlsxResult.added} plants successfully`}
                </p>
                <p className="text-xs arabic text-green-600 dark:text-green-500">
                  {isAr ? 'الأقسام: ' : 'Sections: '}{xlsxResult.sections.join('، ')}
                </p>
              </div>
            )}

            {/* File input */}
            <input ref={xlsxInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleExcelFile} />
            <div className="flex gap-2">
              <Button
                onClick={() => { setXlsxResult(null); setXlsxError(null); xlsxInputRef.current?.click(); }}
                disabled={xlsxLoading}
                className="flex-1 arabic"
              >
                {xlsxLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin me-2" />{isAr ? 'جاري الاستيراد...' : 'Importing...'}</>
                  : <><FileSpreadsheet className="w-4 h-4 me-2" />{isAr ? 'اختر ملف Excel' : 'Choose Excel File'}</>}
              </Button>
              <Button variant="outline" onClick={() => setXlsxOpen(false)} className="arabic">
                {xlsxResult ? (isAr ? 'إغلاق' : 'Close') : (isAr ? 'إلغاء' : 'Cancel')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Branch */}
      <Dialog open={addBranchOpen} onOpenChange={o => { setAddBranchOpen(o); if (!o) { setBranchNameAr(''); setBranchNameEn(''); setBranchLocation(''); setBranchMapEmbed(''); setBranchCoords(''); setBranchImageUrl(''); } }}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="arabic">{isAr ? 'إضافة فرع جديد' : 'Add New Branch'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddBranch} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{isAr ? 'اسم الفرع (عربي)' : 'Branch Name (AR)'}</Label>
              <Input value={branchNameAr} onChange={e => setBranchNameAr(e.target.value)} dir="rtl" className="arabic" placeholder="مثال: فرع عمّان" />
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'اسم الفرع (إنجليزي)' : 'Branch Name (EN)'}</Label>
              <Input value={branchNameEn} onChange={e => setBranchNameEn(e.target.value)} dir="ltr" placeholder="e.g. Amman Branch" />
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'إحداثيات الموقع' : 'Location Coordinates'}</Label>
              <Input
                value={branchCoords}
                onChange={e => setBranchCoords(e.target.value)}
                dir="ltr"
                placeholder="31.9234, 35.9234"
              />
              <p className="text-xs text-muted-foreground arabic leading-relaxed">
                افتح Google Maps → اضغط على الموقع بالزر الأيمن → انسخ الإحداثيات
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'رابط الاتجاهات' : 'Directions Link'}</Label>
              <Input
                value={branchLocation}
                onChange={e => setBranchLocation(e.target.value)}
                dir="ltr"
                placeholder="https://maps.app.goo.gl/..."
              />
              <p className="text-xs text-muted-foreground arabic">
                Google Maps → شارك → انسخ الرابط (يظهر على زر "الاتجاهات")
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'صورة الفرع (اختياري)' : 'Branch Photo (optional)'}</Label>
              <div className="flex gap-2">
                <Input value={branchImageUrl} onChange={e => setBranchImageUrl(e.target.value)} dir="ltr" placeholder={isAr ? 'رابط الصورة...' : 'Image URL...'} className="flex-1" />
                <FileUploadBtn onFile={url => setBranchImageUrl(url)} onLoading={setBranchImgUploading}>
                  <div className={`h-9 px-3 rounded-md bg-muted border border-border flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted/80 transition-colors whitespace-nowrap ${branchImgUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                    {branchImgUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
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
      <Dialog open={loginOpen} onOpenChange={o => { setLoginOpen(o); if (!o) { setUser(''); setPass(''); setSetupPass2(''); setLoginErr(''); setIsSetupMode(false); } }}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl text-center arabic">
              {isSetupMode ? (isAr ? 'إعداد حساب المدير' : 'Create Admin Account') : (isAr ? 'دخول المدير' : 'Admin Login')}
            </DialogTitle>
            {isSetupMode && (
              <p className="text-sm text-muted-foreground text-center arabic pt-1">
                {isAr ? 'لم يتم إنشاء أي حساب بعد — أنشئ حساب المدير الأول' : 'No admin account yet — create the first one'}
              </p>
            )}
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{isAr ? 'اسم المستخدم' : 'Username'}</Label>
              <Input type="text" value={user} onChange={e => setUser(e.target.value)} dir="ltr" autoComplete="username" />
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'كلمة المرور' : 'Password'}</Label>
              <Input type="password" value={pass} onChange={e => setPass(e.target.value)} dir="ltr" autoComplete={isSetupMode ? 'new-password' : 'current-password'} />
            </div>
            {isSetupMode && (
              <div className="space-y-1.5">
                <Label>{isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}</Label>
                <Input type="password" value={setupPass2} onChange={e => setSetupPass2(e.target.value)} dir="ltr" autoComplete="new-password" />
              </div>
            )}
            {loginErr && <p className="text-destructive text-sm">{loginErr}</p>}
            <Button type="submit" disabled={loginLoading} className="w-full bg-primary text-primary-foreground">
              {loginLoading
                ? (isAr ? '⏳ جاري الدخول...' : '⏳ Logging in...')
                : isSetupMode
                  ? (isAr ? 'إنشاء الحساب' : 'Create Account')
                  : (isAr ? 'دخول' : 'Login')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Photo */}
      <Dialog open={!!addPhotoSectionId} onOpenChange={o => { if (!o) { setAddPhotoSectionId(null); setPhotoUrl(''); setPhotoNameAr(''); setPhotoNameEn(''); setPhotoDescAr(''); setPhotoDescEn(''); } }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="arabic">{isAr ? 'إضافة نبتة' : 'Add Plant'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPhoto} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{isAr ? 'الصورة' : 'Image'}</Label>
              <div className="flex gap-2">
                <Input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} dir="ltr" placeholder="https://..." className="flex-1" />
                {photoUrl.startsWith('http') && !photoUrl.startsWith('/api/') && (
                  <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" disabled={photoUrlLoading}
                    onClick={async () => {
                      setPhotoUrlLoading(true);
                      try {
                        const stored = await uploadImageFromUrl(photoUrl);
                        setPhotoUrl(stored);
                      } catch (err) {
                        const msg = err instanceof Error ? err.message : 'Failed';
                        toast.error(isAr ? `فشل تحميل الصورة — ${msg}` : `Failed to load image — ${msg}`);
                      } finally { setPhotoUrlLoading(false); }
                    }}>
                    {photoUrlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isAr ? 'تحميل' : 'Load'}
                  </Button>
                )}
                <FileUploadBtn onFile={url => setPhotoUrl(url)} onLoading={setPhotoUploading}>
                  <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" disabled={photoUploading}>
                    {photoUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
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
            <div className="space-y-1.5">
              <Label>{isAr ? 'وصف مختصر (عربي) — اختياري' : 'Short description (AR) — optional'}</Label>
              <textarea value={photoDescAr} onChange={e => setPhotoDescAr(e.target.value)} dir="rtl" rows={2}
                className="arabic w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder={isAr ? 'مثال: نبتة استوائية تحب الضوء غير المباشر...' : 'e.g. Tropical plant that thrives in indirect light...'} />
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'وصف مختصر (إنجليزي) — اختياري' : 'Short description (EN) — optional'}</Label>
              <textarea value={photoDescEn} onChange={e => setPhotoDescEn(e.target.value)} dir="ltr" rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="e.g. Tropical plant that thrives in indirect light..." />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setAddPhotoSectionId(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              <Button type="submit" className="bg-primary text-primary-foreground" disabled={!photoUrl}>{isAr ? 'إضافة' : 'Add'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Photo */}
      <Dialog open={!!editPhotoTarget} onOpenChange={o => { if (!o) setEditPhotoTarget(null); }}>
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="arabic">{isAr ? 'تعديل النبتة' : 'Edit Plant'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEditPhoto} className="flex flex-col flex-1 min-h-0 pt-2">
            <div className="space-y-4 overflow-y-auto flex-1 pr-1 pb-2">
              <div className="space-y-1.5">
                <Label>{isAr ? 'الصورة' : 'Image'}</Label>
                <div className="flex gap-2">
                  <Input value={editPhotoUrl} onChange={e => setEditPhotoUrl(e.target.value)} dir="ltr" placeholder="https://..." className="flex-1" />
                  {editPhotoUrl.startsWith('http') && !editPhotoUrl.startsWith('/api/') && (
                    <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" disabled={editPhotoUrlLoading}
                      onClick={async () => {
                        setEditPhotoUrlLoading(true);
                        try {
                          const stored = await uploadImageFromUrl(editPhotoUrl);
                          setEditPhotoUrl(stored);
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : 'Failed';
                          toast.error(isAr ? `فشل تحميل الصورة — ${msg}` : `Failed to load image — ${msg}`);
                        } finally { setEditPhotoUrlLoading(false); }
                      }}>
                      {editPhotoUrlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {isAr ? 'تحميل' : 'Load'}
                    </Button>
                  )}
                  <FileUploadBtn onFile={url => setEditPhotoUrl(url)} onLoading={setEditPhotoUploading}>
                    <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" disabled={editPhotoUploading}>
                      {editPhotoUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                      {isAr ? 'رفع' : 'Upload'}
                    </Button>
                  </FileUploadBtn>
                </div>
                {editPhotoUrl && (
                  <img src={editPhotoUrl} alt="preview" className="w-full h-44 object-cover rounded-xl mt-2"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{isAr ? 'الاسم عربي' : 'Name (AR)'}</Label>
                  <Input value={editPhotoNameAr} onChange={e => setEditPhotoNameAr(e.target.value)} dir="rtl" className="arabic" />
                </div>
                <div className="space-y-1.5">
                  <Label>{isAr ? 'الاسم إنجليزي' : 'Name (EN)'}</Label>
                  <Input value={editPhotoNameEn} onChange={e => setEditPhotoNameEn(e.target.value)} dir="ltr" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{isAr ? 'وصف مختصر (عربي) — اختياري' : 'Short description (AR) — optional'}</Label>
                <textarea value={editPhotoDescAr} onChange={e => setEditPhotoDescAr(e.target.value)} dir="rtl" rows={2}
                  className="arabic w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={isAr ? 'مثال: نبتة استوائية تحب الضوء غير المباشر...' : 'e.g. Tropical plant that thrives in indirect light...'} />
              </div>
              <div className="space-y-1.5">
                <Label>{isAr ? 'وصف مختصر (إنجليزي) — اختياري' : 'Short description (EN) — optional'}</Label>
                <textarea value={editPhotoDescEn} onChange={e => setEditPhotoDescEn(e.target.value)} dir="ltr" rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Tropical plant that thrives in indirect light..." />
              </div>

              {/* Extra images */}
              <div className="space-y-2">
                <Label>{isAr ? 'صور إضافية (كاروسيل)' : 'Extra images (carousel)'}</Label>
                {editPhotoExtraImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editPhotoExtraImages.map((img, idx) => (
                      <div key={idx} className="relative group/ei w-16 h-16 rounded-lg overflow-hidden ring-1 ring-border">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button type="button"
                          onClick={() => setEditPhotoExtraImages(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover/ei:opacity-100 transition-opacity flex items-center justify-center">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <FileUploadBtn
                  onFile={url => setEditPhotoExtraImages(prev => [...prev, url])}
                  onLoading={setEditExtraUploading}
                >
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 arabic" disabled={editExtraUploading}>
                    {editExtraUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    {isAr ? 'إضافة صورة للكاروسيل' : 'Add image to carousel'}
                  </Button>
                </FileUploadBtn>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border shrink-0">
              <Button type="button" variant="outline" onClick={() => setEditPhotoTarget(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              <Button type="submit" className="bg-primary text-primary-foreground" disabled={!editPhotoUrl}>{isAr ? 'حفظ' : 'Save'}</Button>
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

      {/* Social Links Modal */}
      <Dialog open={socialModalOpen} onOpenChange={o => { setSocialModalOpen(o); }}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="arabic">
              {editingSocial
                ? (isAr ? 'تعديل الرابط' : 'Edit Link')
                : (isAr ? 'إضافة رابط جديد' : 'Add New Link')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSocial} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="arabic">{isAr ? 'المنصة' : 'Platform'}</Label>
              <div className="grid grid-cols-2 gap-2">
                {SOCIAL_PLATFORMS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setSocialPlatform(p.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-sm arabic font-medium ${
                      socialPlatform === p.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                  >
                    <SocialIcon platform={p.value} size={28} />
                    <span>{isAr ? p.labelAr : p.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="arabic">
                {socialPlatform === 'email'
                  ? (isAr ? 'البريد الإلكتروني' : 'Email Address')
                  : (isAr ? 'الرابط' : 'URL')}
              </Label>
              <Input
                value={socialUrl}
                onChange={e => setSocialUrl(e.target.value)}
                dir="ltr"
                placeholder={
                  socialPlatform === 'whatsapp'  ? 'https://wa.me/9665XXXXXXXX'
                  : socialPlatform === 'facebook'  ? 'https://facebook.com/yourpage'
                  : socialPlatform === 'instagram' ? 'https://instagram.com/yourprofile'
                  : socialPlatform === 'youtube'   ? 'https://youtube.com/@yourchannel'
                  : socialPlatform === 'website'   ? 'https://www.yourwebsite.com'
                  : socialPlatform === 'email'     ? 'info@example.com'
                  : socialPlatform === 'catalog'   ? 'https://drive.google.com/file/...'
                  : 'https://'
                }
                type={socialPlatform === 'email' ? 'email' : 'url'}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setSocialModalOpen(false)}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground" disabled={!socialUrl.trim()}>
                {isAr ? 'حفظ' : 'Save'}
              </Button>
            </div>
          </form>
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
          companyDetails={{
            locationAr: "جرش – الرشايدة",
            locationEn: "Jerash - Al-Rashaidah",
            phone: siteData.footer.phone || "00962777772211",
            email: siteData.footer.email || "tamerqadri@gmail.com",
            website: siteData.footer.website || "https://alkadrionline.com/",
          }}
        />
      )}

      {/* Admin Quotation Form Dialog */}
      {isAdmin && quotationFormOpen && (
        <Dialog open={quotationFormOpen} onOpenChange={setQuotationFormOpen}>
          <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto p-4" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right arabic">إنشاء عرض سعر</DialogTitle>
            </DialogHeader>
            <QuotationForm onClose={() => setQuotationFormOpen(false)} />
          </DialogContent>
        </Dialog>
      )}

      {/* Admin Quotations List Dialog */}
      {isAdmin && (
        <AdminQuotationsList
          open={adminQuotationsListOpen}
          onClose={() => setAdminQuotationsListOpen(false)}
        />
      )}

      {/* Quote Request Modal */}
      <QuoteRequestModal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        sections={siteData.sections}
        lang={lang}
        cart={quoteCart}
        setCart={setQuoteCart}
      />

      {/* Admin Quotes Modal */}
      {isAdmin && (
        <AdminQuotesModal
          open={adminQuotesOpen}
          onClose={() => setAdminQuotesOpen(false)}
          lang={lang}
          siteData={siteData}
        />
      )}

      {/* Admin Invoices Modal */}
      {isAdmin && (
        <AdminInvoicesModal
          open={adminInvoicesOpen}
          onClose={() => setAdminInvoicesOpen(false)}
          lang={lang}
          siteData={siteData}
          onSessionExpired={() => { setSessionToken(null); setIsAdmin(false); openLoginModal(); }}
        />
      )}

      {/* Admin Receipts Modal */}
      {isAdmin && (
        <AdminReceiptsModal
          open={adminReceiptsOpen}
          onClose={() => setAdminReceiptsOpen(false)}
          lang={lang}
          logoUrl={siteData.logo?.customUrl ?? ''}
          onSessionExpired={() => { setSessionToken(null); setIsAdmin(false); setAdminReceiptsOpen(false); setSessionExpired(true); }}
        />
      )}

      {/* Admin Disbursements Modal */}
      {isAdmin && (
        <AdminDisbursementsModal
          open={adminDisbursementsOpen}
          onClose={() => setAdminDisbursementsOpen(false)}
          lang={lang}
          logoUrl={siteData.logo?.customUrl ?? ''}
          onSessionExpired={() => { setSessionToken(null); setIsAdmin(false); setAdminDisbursementsOpen(false); setSessionExpired(true); }}
        />
      )}

      {/* Qadri Old Quotation Records Modal */}
      {isAdmin && (
        <QadriOldRecordsModal
          open={qadriOldOpen}
          onClose={() => setQadriOldOpen(false)}
          isAr={isAr}
        />
      )}

      {/* No Header Quotation Records Modal */}
      {isAdmin && (
        <NoHeaderRecordsModal
          open={noHeaderOpen}
          onClose={() => setNoHeaderOpen(false)}
          isAr={isAr}
        />
      )}

      {/* Experience Certificate Modal */}
      {isAdmin && (
        <CertificateModal
          open={certOpen}
          onClose={() => setCertOpen(false)}
          lang={lang}
          logoUrl={siteData.logo?.customUrl ?? ''}
        />
      )}

      {/* Plant Lightbox */}
      {lightboxPhoto && (
        <PlantLightbox photo={lightboxPhoto} lang={lang} onClose={() => setLightboxPhoto(null)} />
      )}
    </div>
  );
}

/* ── Section block ───────────────────────────────────── */
const SECTION_PAGE_SIZE = 24;

function SectionBlock({ section, lang, isAdmin, onUpdateName, onAddPhoto, onDeletePhoto, onEditPhoto, onDeleteSection, onDownloadPDF, onMoveUp, onMoveDown, isFirst, isLast, onOpenLightbox, onReorderPhotos, onImageUpload }: {
  section: Section; lang: string; isAdmin: boolean;
  onUpdateName: (f: 'nameAr' | 'nameEn', v: string) => void;
  onAddPhoto: () => void;
  onDeletePhoto: (id: string) => void;
  onEditPhoto: (photo: Photo) => void;
  onDeleteSection: () => void;
  onDownloadPDF: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  onOpenLightbox: (photo: Photo) => void;
  onReorderPhotos: (fromIdx: number, toIdx: number) => void;
  onImageUpload?: (photo: Photo, url: string) => void;
}) {
  const isAr = lang === 'ar';
  const [visibleCount, setVisibleCount] = useState(SECTION_PAGE_SIZE);
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const visiblePhotos = section.photos.slice(0, visibleCount);
  const hasMore = section.photos.length > visibleCount;
  const remaining = section.photos.length - visibleCount;

  return (
    <section className="w-full max-w-5xl mx-auto" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 600px' }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 h-px bg-border" />
        <div className="text-center shrink-0">
          <h2 className="text-2xl md:text-3xl font-bold arabic text-foreground">
            {isAdmin
              ? <InlineEdit value={isAr ? section.nameAr : (section.nameEn || section.nameAr)} onSave={v => onUpdateName(isAr ? 'nameAr' : 'nameEn', v)} className="arabic text-2xl font-bold" />
              : (isAr ? section.nameAr : (section.nameEn || section.nameAr))}
          </h2>
          <p className="text-xs text-muted-foreground tracking-widest uppercase latin mt-0.5">
            {isAr ? section.nameEn : section.nameAr}
          </p>
        </div>
        <div className="flex-1 h-px bg-border" />
        {isAdmin && (
          <div className="no-print flex items-center gap-1 shrink-0">
            <AdminIconBtn onClick={onMoveUp} title={isAr ? 'تحريك لأعلى' : 'Move up'} variant="default" disabled={isFirst}>
              <ArrowUp className="w-3.5 h-3.5" />
            </AdminIconBtn>
            <AdminIconBtn onClick={onMoveDown} title={isAr ? 'تحريك لأسفل' : 'Move down'} variant="default" disabled={isLast}>
              <ArrowDown className="w-3.5 h-3.5" />
            </AdminIconBtn>
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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {visiblePhotos.map((photo, idx) => {
              const realIdx = section.photos.indexOf(photo);
              const isDragging = dragIdx.current === realIdx;
              const isOver = dragOverIdx === realIdx && dragIdx.current !== realIdx;
              return isAdmin ? (
                <div
                  key={photo.id}
                  draggable
                  onDragStart={() => { dragIdx.current = realIdx; }}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(realIdx); }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={() => {
                    if (dragIdx.current !== null && dragIdx.current !== realIdx) {
                      onReorderPhotos(dragIdx.current, realIdx);
                    }
                    dragIdx.current = null;
                    setDragOverIdx(null);
                  }}
                  onDragEnd={() => { dragIdx.current = null; setDragOverIdx(null); }}
                  className={`cursor-grab active:cursor-grabbing rounded-2xl transition-all duration-150 ${isDragging ? 'opacity-40 scale-95' : ''} ${isOver ? 'ring-2 ring-primary ring-offset-2 scale-[1.02]' : ''}`}
                >
                  <PlantCard photo={photo} lang={lang} isAdmin={isAdmin}
                    onEdit={() => onEditPhoto(photo)}
                    onDelete={() => onDeletePhoto(photo.id)}
                    onOpenLightbox={onOpenLightbox}
                    onImageUpload={onImageUpload ? url => onImageUpload(photo, url) : undefined}
                  />
                </div>
              ) : (
                <PlantCard key={photo.id} photo={photo} lang={lang} isAdmin={isAdmin}
                  onEdit={() => onEditPhoto(photo)}
                  onDelete={() => onDeletePhoto(photo.id)}
                  onOpenLightbox={onOpenLightbox}
                  onImageUpload={onImageUpload ? url => onImageUpload(photo, url) : undefined}
                />
              );
            })}
          </div>
          {hasMore && (
            <div className="flex flex-col items-center gap-2 mt-10">
              <p className="text-xs text-muted-foreground arabic">
                {isAr
                  ? `يعرض ${visibleCount} من أصل ${section.photos.length}`
                  : `Showing ${visibleCount} of ${section.photos.length}`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setVisibleCount(c => c + SECTION_PAGE_SIZE)}
                  className="px-5 py-2 rounded-full border border-primary text-primary text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors arabic"
                >
                  {isAr ? `تحميل ${Math.min(remaining, SECTION_PAGE_SIZE)} نبتة أخرى` : `Load ${Math.min(remaining, SECTION_PAGE_SIZE)} more`}
                </button>
                {remaining > SECTION_PAGE_SIZE && (
                  <button
                    onClick={() => setVisibleCount(section.photos.length)}
                    className="px-5 py-2 rounded-full border border-border text-muted-foreground text-sm font-medium hover:bg-muted transition-colors arabic"
                  >
                    {isAr ? `عرض الكل (${section.photos.length})` : `Show all (${section.photos.length})`}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ── Plant Card (with multi-image carousel) ──────────── */
function PlantCard({ photo, lang, isAdmin, onEdit, onDelete, onOpenLightbox, onImageUpload }: {
  photo: Photo; lang: string; isAdmin: boolean;
  onEdit: () => void; onDelete: () => void;
  onOpenLightbox: (photo: Photo) => void;
  onImageUpload?: (url: string) => void;
}) {
  const isAr = lang === 'ar';
  const allImages = [photo.image, ...(photo.extraImages ?? [])].filter(Boolean);
  const [imgIdx, setImgIdx] = useState(0);
  const safeIdx = Math.min(imgIdx, allImages.length - 1);
  const [imgUploading, setImgUploading] = useState(false);
  const imgFileRef = useRef<HTMLInputElement>(null);

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setImgIdx(i => (i - 1 + allImages.length) % allImages.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setImgIdx(i => (i + 1) % allImages.length); };

  return (
    <div className="group relative rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 bg-card aspect-[4/5] cursor-pointer"
      onClick={() => !isAdmin && onOpenLightbox({ ...photo, image: allImages[safeIdx] ?? photo.image })}>

      {/* hidden file input for quick image swap */}
      {isAdmin && onImageUpload && (
        <input ref={imgFileRef} type="file" accept="image/*" className="hidden"
          onChange={async e => {
            const f = e.target.files?.[0]; if (!f) return;
            setImgUploading(true);
            try {
              const url = await uploadImage(f);
              onImageUpload(url);
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Upload failed';
              toast.error(`فشل رفع الصورة — ${msg}`);
            } finally {
              setImgUploading(false);
              e.target.value = '';
            }
          }} />
      )}

      {/* image */}
      <img src={allImages[safeIdx] || photo.image}
        alt={isAr ? photo.nameAr : (photo.nameEn || photo.nameAr)}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />

      {/* zoom hint (visitor) */}
      {!isAdmin && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/20 backdrop-blur-sm rounded-full p-3">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>
        </div>
      )}

      {/* click-to-upload overlay (admin) */}
      {isAdmin && onImageUpload && (
        <div
          onClick={e => { e.stopPropagation(); imgFileRef.current?.click(); }}
          className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center cursor-pointer z-10">
          {imgUploading ? (
            <div className="opacity-100 bg-black/50 backdrop-blur-sm rounded-full p-3">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          ) : (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/50 backdrop-blur-sm rounded-full p-3">
              <Camera className="w-6 h-6 text-white" />
            </div>
          )}
        </div>
      )}

      {/* carousel nav — shown when multiple images */}
      {allImages.length > 1 && (
        <>
          <button onClick={prev}
            className="absolute top-1/2 start-1.5 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 backdrop-blur-sm z-10">
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
          <button onClick={next}
            className="absolute top-1/2 end-1.5 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 backdrop-blur-sm z-10">
            <ChevronDown className="w-4 h-4 -rotate-90" />
          </button>
          {/* dots */}
          <div className="absolute top-2.5 inset-x-0 flex justify-center gap-1 z-10">
            {allImages.map((_, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setImgIdx(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === safeIdx ? 'bg-white scale-125' : 'bg-white/50'}`} />
            ))}
          </div>
          {/* counter badge */}
          <div className="absolute top-2.5 end-2.5 px-1.5 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-mono backdrop-blur-sm z-10">
            {safeIdx + 1}/{allImages.length}
          </div>
        </>
      )}

      {/* name overlay */}
      {(photo.nameAr || photo.nameEn) && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent pt-12 pb-4 px-4">
          <p className="text-white text-base font-bold leading-tight arabic drop-shadow-sm">{isAr ? photo.nameAr : (photo.nameEn || photo.nameAr)}</p>
          {photo.nameAr && photo.nameEn && (
            <p className="text-white/65 text-xs mt-0.5 latin">{isAr ? photo.nameEn : photo.nameAr}</p>
          )}
          {(photo.descriptionAr || photo.descriptionEn) && (
            <p className="text-white/50 text-[11px] mt-1 arabic line-clamp-1">
              {isAr ? (photo.descriptionAr || photo.descriptionEn) : (photo.descriptionEn || photo.descriptionAr)}
            </p>
          )}
        </div>
      )}

      {/* admin buttons */}
      {isAdmin && (
        <>
          <button onClick={e => { e.stopPropagation(); onEdit(); }}
            className="no-print absolute top-2.5 start-2.5 w-8 h-8 bg-primary/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary backdrop-blur-sm z-20">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="no-print absolute top-2.5 end-2.5 w-8 h-8 bg-black/55 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 backdrop-blur-sm z-20">
            <X className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

/* ── Plant Lightbox ──────────────────────────────────── */
function PlantLightbox({ photo, lang, onClose }: { photo: Photo; lang: string; onClose: () => void }) {
  const isAr = lang === 'ar';
  const allImages = [photo.image, ...(photo.extraImages ?? [])].filter(Boolean);
  const [imgIdx, setImgIdx] = useState(0);
  const safeIdx = Math.min(imgIdx, allImages.length - 1);

  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setImgIdx(i => (i - 1 + allImages.length) % allImages.length);
      if (e.key === 'ArrowRight') setImgIdx(i => (i + 1) % allImages.length);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, allImages.length]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" dir={isAr ? 'rtl' : 'ltr'}
      onClick={onClose}>
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* card */}
      <div className="relative z-10 w-full max-w-5xl max-h-[92vh] bg-card rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
        onClick={e => e.stopPropagation()}>

        {/* image side */}
        <div className="md:w-[65%] aspect-[4/5] md:aspect-auto md:max-h-[92vh] bg-muted shrink-0 relative">
          <img src={allImages[safeIdx] || photo.image}
            alt={isAr ? photo.nameAr : (photo.nameEn || photo.nameAr)}
            className="w-full h-full object-contain transition-opacity duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

          {/* image nav when multiple */}
          {allImages.length > 1 && (
            <>
              <button onClick={() => setImgIdx(i => (i - 1 + allImages.length) % allImages.length)}
                className="absolute top-1/2 start-2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-colors backdrop-blur-sm">
                <ChevronDown className="w-5 h-5 rotate-90" />
              </button>
              <button onClick={() => setImgIdx(i => (i + 1) % allImages.length)}
                className="absolute top-1/2 end-2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-colors backdrop-blur-sm">
                <ChevronDown className="w-5 h-5 -rotate-90" />
              </button>
              {/* thumbnail strip */}
              <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5 px-4">
                {allImages.map((img, i) => (
                  <button key={i} onClick={() => setImgIdx(i)}
                    className={`w-8 h-8 rounded-lg overflow-hidden ring-2 transition-all shrink-0 ${i === safeIdx ? 'ring-white scale-110' : 'ring-white/30 opacity-60 hover:opacity-100'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* info side */}
        <div className="flex-1 min-w-0 flex flex-col justify-between p-6 md:p-8 overflow-y-auto">
          <div className="min-w-0">
            {/* close */}
            <button onClick={onClose}
              className="absolute top-3 end-3 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors backdrop-blur-sm">
              <X className="w-4 h-4" />
            </button>

            {/* name */}
            <h2 className="arabic text-2xl md:text-3xl font-bold text-foreground leading-tight mt-6 md:mt-0 break-words [overflow-wrap:anywhere]">
              {isAr ? photo.nameAr : (photo.nameEn || photo.nameAr)}
            </h2>
            {photo.nameAr && photo.nameEn && (
              <p className="text-muted-foreground text-sm latin mt-1 break-words [overflow-wrap:anywhere]">
                {isAr ? photo.nameEn : photo.nameAr}
              </p>
            )}

            {/* divider */}
            <div className="my-4 h-px bg-border" />

            {/* description */}
            {(photo.descriptionAr || photo.descriptionEn) ? (
              <p className="arabic text-foreground/80 text-sm leading-relaxed break-words [overflow-wrap:anywhere] whitespace-pre-wrap">
                {isAr
                  ? (photo.descriptionAr || photo.descriptionEn)
                  : (photo.descriptionEn || photo.descriptionAr)}
              </p>
            ) : (
              <p className="arabic text-muted-foreground text-sm italic">
                {isAr ? 'لا يوجد وصف لهذه النبتة' : 'No description available'}
              </p>
            )}

            {/* image count hint */}
            {allImages.length > 1 && (
              <p className="mt-3 text-xs text-muted-foreground arabic">
                {isAr ? `${allImages.length} صور — استخدم الأسهم للتنقل` : `${allImages.length} photos — use arrows to navigate`}
              </p>
            )}
          </div>

          {/* decorative badge */}
          <div className="mt-6 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold arabic">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12z" />
                <path d="M10 6a1 1 0 011 1v2.586l1.707 1.707a1 1 0 01-1.414 1.414l-2-2A1 1 0 019 10V7a1 1 0 011-1z" />
              </svg>
              {isAr ? 'مشاتل القادري' : 'Al-Qadri Nurseries'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Small icon button ───────────────────────────────── */
function AdminIconBtn({ onClick, title, variant = 'default', disabled = false, children }: {
  onClick: () => void; title: string; variant?: 'default' | 'primary' | 'danger'; disabled?: boolean; children: React.ReactNode;
}) {
  const cls = {
    default: 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted',
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    danger: 'bg-card border border-border text-destructive hover:bg-destructive/10',
  }[variant];
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${cls} disabled:opacity-30 disabled:cursor-not-allowed`}>
      {children}
    </button>
  );
}

/* ── Toolbar button ──────────────────────────────────── */
function ToolBtn({ icon, label, onClick, variant = 'default', badge = 0 }: {
  icon: React.ReactNode; label: string; onClick: () => void; variant?: 'default' | 'dark'; badge?: number;
}) {
  return (
    <button onClick={onClick}
      className={`relative flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors ${variant === 'dark' ? 'bg-foreground text-background hover:bg-foreground/90' : 'bg-accent border border-border text-foreground hover:bg-muted'}`}>
      {icon}<span className="hidden sm:inline">{label}</span>
      {badge > 0 && (
        <span className="absolute -top-1.5 -end-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

/* ── Sidebar helpers ─────────────────────────────────────── */
function SideSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1 mb-1.5 arabic">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SideBtn({ icon, label, onClick, highlight = false }: {
  icon: React.ReactNode; label: string; onClick: () => void; highlight?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.98] arabic text-start ${
        highlight
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'hover:bg-accent text-foreground'
      }`}>
      <span className={highlight ? 'text-primary-foreground' : 'text-primary'}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function SideBtnBadge({ icon, label, onClick, badge = 0 }: {
  icon: React.ReactNode; label: string; onClick: () => void; badge?: number;
}) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:bg-accent active:scale-[0.98] arabic text-start text-foreground">
      <span className="text-primary relative">
        {icon}
        {badge > 0 && (
          <span className="absolute -top-1.5 -end-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

function SideSubBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2 ps-6 pe-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:bg-accent active:scale-[0.98] arabic text-start text-muted-foreground hover:text-foreground">
      <span className="text-primary/60 shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

/* ── helpers ─────────────────────────────────────────────── */
function getVideoEmbed(url: string): { type: 'youtube' | 'vimeo' | 'direct'; embedUrl: string } | null {
  if (!url) return null;
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1` };
  // Vimeo
  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vmMatch[1]}?color=ffffff&title=0&byline=0&portrait=0` };
  // Direct video file
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) return { type: 'direct', embedUrl: url };
  return null;
}

/* ── Store Showcase Section ──────────────────────────────── */
function StoreShowcaseSection({ items, isAr, isAdmin, onUpdate }: {
  items: ShowcaseItem[];
  isAr: boolean;
  isAdmin: boolean;
  onUpdate: (items: ShowcaseItem[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAr, setEditAr] = useState('');
  const [editEn, setEditEn] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replacingIdRef = useRef<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const uid = () => `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const handleUpload = async (file: File) => {
    const url = await uploadImage(file);
    if (!url) return;
    onUpdate([...items, { id: uid(), imageUrl: url, captionAr: 'وصف الصورة', captionEn: 'Image caption', locationUrl: '' }]);
  };

  const handleReplace = async (file: File, id: string) => {
    const url = await uploadImage(file);
    if (!url) return;
    onUpdate(items.map(it => it.id === id ? { ...it, imageUrl: url } : it));
  };

  const openEdit = (item: ShowcaseItem) => {
    setEditingId(item.id);
    setEditAr(item.captionAr);
    setEditEn(item.captionEn);
    setEditLocation(item.locationUrl ?? '');
  };

  const saveEdit = (id: string) => {
    onUpdate(items.map(it => it.id === id ? { ...it, captionAr: editAr, captionEn: editEn, locationUrl: editLocation.trim() } : it));
    setEditingId(null);
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    const index = items.findIndex(item => item.id === id);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onUpdate(next);
  };

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const fromIndex = items.findIndex(item => item.id === draggedId);
    const toIndex = items.findIndex(item => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onUpdate(next);
  };

  return (
    <section className="border-b border-border bg-background px-4 md:px-12 py-14">
      {/* Title */}
      <div className="flex items-center justify-center gap-4 mb-10">
        <div className="flex-1 h-px bg-foreground/15" />
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold arabic text-foreground">{isAr ? 'محلاتنا وأعمالنا' : 'Our Stores & Work'}</h2>
          <p className="text-xs text-muted-foreground tracking-widest uppercase latin mt-0.5">{isAr ? 'Our Stores & Work' : 'محلاتنا وأعمالنا'}</p>
        </div>
        <div className="flex-1 h-px bg-foreground/15" />
      </div>

      {/* Cards row */}
      {isAdmin && items.length > 1 && (
        <p className="text-center text-xs text-muted-foreground arabic mb-5">
          اسحب بطاقة المحل لتغيير ترتيبها — أو استخدم الأسهم
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-8 md:gap-12">
        {items.map((item, index) => {
          return (
            <div
              key={item.id}
              className={`flex flex-col items-center gap-3 group relative rounded-2xl transition-all ${dragOverId === item.id ? 'ring-2 ring-primary ring-offset-4' : ''} ${draggedId === item.id ? 'opacity-50' : ''}`}
              style={{ width: 200 }}
              draggable={isAdmin}
              onDragStart={e => {
                if (!isAdmin) return;
                setDraggedId(item.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.id);
              }}
              onDragOver={e => {
                if (!isAdmin || !draggedId || draggedId === item.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverId(item.id);
              }}
              onDragLeave={() => setDragOverId(current => current === item.id ? null : current)}
              onDrop={e => {
                e.preventDefault();
                handleDrop(item.id);
                setDraggedId(null);
                setDragOverId(null);
              }}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
            >
              {isAdmin && (
                <div className="no-print flex items-center gap-1 text-[10px] text-muted-foreground arabic">
                  <GripVertical className="w-3.5 h-3.5" />
                  <span>المحل {index + 1}</span>
                </div>
              )}
              {/* Image card */}
              <div className="relative rounded-xl overflow-hidden shadow-md" style={{ width: 200, height: 200 }}>
                <div
                  className={`w-full h-full ${item.locationUrl && !isAdmin ? 'cursor-pointer' : ''}`}
                  onClick={() => { if (item.locationUrl && !isAdmin) window.open(item.locationUrl, '_blank', 'noopener'); }}
                >
                  <img
                    src={item.imageUrl}
                    alt={isAr ? item.captionAr : item.captionEn}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
                {/* Admin controls */}
                {isAdmin && (
                  <>
                    {/* Replace image — appears on hover */}
                    <button
                      onClick={() => { replacingIdRef.current = item.id; replaceInputRef.current?.click(); }}
                      className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                    >
                      <span className="text-white text-xs font-semibold arabic bg-black/50 px-3 py-1.5 rounded-lg">🖼 تغيير الصورة</span>
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => onUpdate(items.filter(it => it.id !== item.id))}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow"
                    >✕</button>
                  </>
                )}
              </div>

              {/* Caption + edit form */}
              {editingId === item.id ? (
                <div className="flex flex-col gap-1 w-full">
                  <input
                    value={editAr}
                    onChange={e => setEditAr(e.target.value)}
                    className="text-center text-xs border rounded px-1 py-0.5 w-full arabic bg-background"
                    placeholder="الوصف عربي"
                    dir="rtl"
                    autoFocus
                  />
                  <input
                    value={editEn}
                    onChange={e => setEditEn(e.target.value)}
                    className="text-center text-xs border rounded px-1 py-0.5 w-full latin bg-background"
                    placeholder="Caption EN"
                    dir="ltr"
                  />
                  <input
                    value={editLocation}
                    onChange={e => setEditLocation(e.target.value)}
                    className="text-center text-xs border rounded px-1 py-0.5 w-full latin bg-background"
                    placeholder="رابط الموقع (Google Maps)"
                    dir="ltr"
                  />
                  <div className="flex gap-1 justify-center mt-0.5">
                    <button onClick={() => saveEdit(item.id)} className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded">حفظ</button>
                    <button onClick={() => setEditingId(null)} className="text-[10px] bg-muted px-2 py-0.5 rounded">إلغاء</button>
                  </div>
                </div>
              ) : (
                <p
                  className={`text-sm font-semibold text-center arabic text-foreground leading-snug ${isAdmin ? 'cursor-pointer hover:text-primary' : ''}`}
                  onClick={isAdmin ? () => openEdit(item) : undefined}
                  title={isAdmin ? 'اضغط لتعديل' : undefined}
                >
                  {isAr ? item.captionAr : item.captionEn}
                  {isAdmin && <span className="text-[10px] text-muted-foreground ms-1">✎</span>}
                </p>
              )}
              {isAdmin && items.length > 1 && (
                <div className="no-print flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, 'up')}
                    disabled={index === 0}
                    className="rounded-md border border-border px-2 py-1 text-xs arabic hover:bg-muted disabled:opacity-30"
                    title="تحريك للأعلى"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(item.id, 'down')}
                    disabled={index === items.length - 1}
                    className="rounded-md border border-border px-2 py-1 text-xs arabic hover:bg-muted disabled:opacity-30"
                    title="تحريك للأسفل"
                  >
                    ↓
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Admin: add new */}
        {isAdmin && (
          <div className="flex flex-col items-center gap-3" style={{ width: 152 }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-36 h-36 rounded-full border-2 border-dashed border-primary/40 hover:border-primary flex flex-col items-center justify-center gap-2 transition-colors text-muted-foreground hover:text-primary"
            >
              <span className="text-3xl">+</span>
              <span className="text-xs arabic">إضافة صورة</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
            />
            <input
              ref={replaceInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f && replacingIdRef.current) handleReplace(f, replacingIdRef.current); e.target.value = ''; replacingIdRef.current = null; }}
            />
            <span className="text-xs text-muted-foreground arabic">صورة جديدة</span>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Featured Images / Video Section ────────────────────── */
function FeaturedImagesSection({ images, video, mode, isAr, isAdmin, onUpdate, onUpdateVideo, onUpdateMode }: {
  images: FeaturedImage[];
  video: { url: string; titleAr: string; titleEn: string } | null;
  mode: 'images' | 'video';
  isAr: boolean;
  isAdmin: boolean;
  onUpdate: (items: FeaturedImage[]) => void;
  onUpdateVideo: (v: { url: string; titleAr: string; titleEn: string } | null) => void;
  onUpdateMode: (m: 'images' | 'video') => void;
}) {
  /* images state */
  const [imgModalOpen, setImgModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<FeaturedImage | null>(null);
  const [draftImage, setDraftImage] = useState('');
  const [draftTitleAr, setDraftTitleAr] = useState('');
  const [draftTitleEn, setDraftTitleEn] = useState('');
  const [uploading, setUploading] = useState(false);

  /* video state */
  const [vidModalOpen, setVidModalOpen] = useState(false);
  const [draftVidUrl, setDraftVidUrl] = useState('');
  const [draftVidTitleAr, setDraftVidTitleAr] = useState('');
  const [draftVidTitleEn, setDraftVidTitleEn] = useState('');

  /* image handlers */
  const openAddImg = () => { setEditItem(null); setDraftImage(''); setDraftTitleAr(''); setDraftTitleEn(''); setImgModalOpen(true); };
  const openEditImg = (img: FeaturedImage) => { setEditItem(img); setDraftImage(img.image); setDraftTitleAr(img.titleAr); setDraftTitleEn(img.titleEn); setImgModalOpen(true); };
  const handleSaveImg = () => {
    if (!draftImage) return;
    if (editItem) onUpdate(images.map(i => i.id === editItem.id ? { ...i, image: draftImage, titleAr: draftTitleAr, titleEn: draftTitleEn } : i));
    else onUpdate([...images, { id: `fi-${Date.now()}`, image: draftImage, titleAr: draftTitleAr, titleEn: draftTitleEn }]);
    setImgModalOpen(false);
  };
  const handleDeleteImg = (id: string) => {
    if (!confirm(isAr ? 'حذف هذه الصورة؟' : 'Delete this image?')) return;
    onUpdate(images.filter(i => i.id !== id));
  };

  /* video handlers */
  const openVidModal = () => { setDraftVidUrl(video?.url ?? ''); setDraftVidTitleAr(video?.titleAr ?? ''); setDraftVidTitleEn(video?.titleEn ?? ''); setVidModalOpen(true); };
  const handleSaveVid = () => {
    if (!draftVidUrl.trim()) return;
    onUpdateVideo({ url: draftVidUrl.trim(), titleAr: draftVidTitleAr.trim(), titleEn: draftVidTitleEn.trim() });
    setVidModalOpen(false);
  };
  const handleDeleteVid = () => {
    if (!confirm(isAr ? 'حذف الفيديو؟' : 'Delete video?')) return;
    onUpdateVideo(null);
  };

  const displayed = images.slice(0, 3);
  const embed = video ? getVideoEmbed(video.url) : null;
  const showSection = mode === 'images' ? (displayed.length > 0 || isAdmin) : (video !== null || isAdmin);
  if (!showSection) return null;

  return (
    <>
      <section className="px-4 md:px-12 py-10 bg-background border-b border-border">

        {/* ── Admin controls bar ── */}
        {isAdmin && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {/* Mode toggle */}
            <div className="flex items-center gap-1 bg-muted border border-border rounded-xl p-1">
              <button onClick={() => onUpdateMode('images')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all arabic ${mode === 'images' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <ImagePlus className="w-3.5 h-3.5" />
                {isAr ? 'صور' : 'Images'}
              </button>
              <button onClick={() => onUpdateMode('video')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all arabic ${mode === 'video' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                {isAr ? 'فيديو' : 'Video'}
              </button>
            </div>

            {/* Action button per mode */}
            {mode === 'images' && displayed.length < 3 && (
              <button onClick={openAddImg}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors border border-primary/20 arabic">
                <Plus className="w-3.5 h-3.5" />
                {isAr ? 'إضافة صورة' : 'Add Image'}
              </button>
            )}
            {mode === 'video' && (
              <button onClick={openVidModal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors border border-primary/20 arabic">
                <Pencil className="w-3.5 h-3.5" />
                {video ? (isAr ? 'تعديل الفيديو' : 'Edit Video') : (isAr ? 'إضافة فيديو' : 'Add Video')}
              </button>
            )}
            {mode === 'video' && video && (
              <button onClick={handleDeleteVid}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs font-semibold transition-colors border border-destructive/20 arabic">
                <Trash2 className="w-3.5 h-3.5" />
                {isAr ? 'حذف' : 'Delete'}
              </button>
            )}
          </div>
        )}

        {/* ── IMAGES MODE ── */}
        {mode === 'images' && (
          <>
            {displayed.length === 0 && isAdmin && (
              <div className="border-2 border-dashed border-border rounded-2xl py-14 text-center text-muted-foreground text-sm arabic">
                {isAr ? 'أضف حتى ثلاث صور مميزة' : 'Add up to 3 featured images'}
              </div>
            )}
            {displayed.length > 0 && (
              <div className={`max-w-5xl mx-auto grid gap-4 ${displayed.length === 1 ? 'grid-cols-1' : displayed.length === 2 ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-5'}`}>
                {displayed.length === 3 ? (
                  <>
                    <div className="md:col-span-3 relative group rounded-2xl overflow-hidden shadow-lg aspect-[4/3]">
                      <img src={displayed[0].image} alt={isAr ? displayed[0].titleAr : displayed[0].titleEn} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
                      {(displayed[0].titleAr || displayed[0].titleEn) && (
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-5 pt-10 pb-4">
                          <p className="text-white font-bold arabic text-lg drop-shadow">{isAr ? displayed[0].titleAr : (displayed[0].titleEn || displayed[0].titleAr)}</p>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="no-print absolute top-2.5 end-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditImg(displayed[0])} className="w-8 h-8 bg-black/55 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteImg(displayed[0].id)} className="w-8 h-8 bg-black/55 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-4">
                      {[displayed[1], displayed[2]].map(img => (
                        <div key={img.id} className="relative group rounded-2xl overflow-hidden shadow-lg flex-1 aspect-[4/3] md:aspect-auto">
                          <img src={img.image} alt={isAr ? img.titleAr : img.titleEn} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
                          {(img.titleAr || img.titleEn) && (
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-4 pt-8 pb-3">
                              <p className="text-white font-bold arabic text-base drop-shadow">{isAr ? img.titleAr : (img.titleEn || img.titleAr)}</p>
                            </div>
                          )}
                          {isAdmin && (
                            <div className="no-print absolute top-2 end-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditImg(img)} className="w-7 h-7 bg-black/55 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-primary transition-colors"><Pencil className="w-3 h-3" /></button>
                              <button onClick={() => handleDeleteImg(img.id)} className="w-7 h-7 bg-black/55 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"><X className="w-3 h-3" /></button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  displayed.map(img => (
                    <div key={img.id} className="relative group rounded-2xl overflow-hidden shadow-lg aspect-[4/3]">
                      <img src={img.image} alt={isAr ? img.titleAr : img.titleEn} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
                      {(img.titleAr || img.titleEn) && (
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-4 pt-8 pb-3">
                          <p className="text-white font-bold arabic text-base drop-shadow">{isAr ? img.titleAr : (img.titleEn || img.titleAr)}</p>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="no-print absolute top-2.5 end-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditImg(img)} className="w-8 h-8 bg-black/55 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteImg(img.id)} className="w-8 h-8 bg-black/55 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* ── VIDEO MODE ── */}
        {mode === 'video' && (
          <>
            {!video && isAdmin && (
              <div className="border-2 border-dashed border-border rounded-2xl py-14 text-center text-muted-foreground text-sm arabic">
                {isAr ? 'أضف رابط فيديو (يوتيوب، فيميو، أو رابط مباشر)' : 'Add a video URL (YouTube, Vimeo, or direct link)'}
              </div>
            )}
            {video && (
              <div className="max-w-4xl mx-auto">
                {embed ? (
                  embed.type === 'direct' ? (
                    <video
                      src={embed.embedUrl}
                      controls
                      playsInline
                      className="w-full rounded-2xl shadow-xl aspect-video bg-black"
                      style={{ maxHeight: '520px' }}
                    />
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-video bg-black">
                      <iframe
                        src={embed.embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        title={isAr ? video.titleAr : video.titleEn}
                      />
                    </div>
                  )
                ) : (
                  <div className="border-2 border-dashed border-border rounded-2xl py-10 text-center text-muted-foreground text-sm arabic">
                    {isAr ? 'رابط الفيديو غير مدعوم — استخدم رابط يوتيوب أو فيميو أو mp4' : 'Unsupported URL — use YouTube, Vimeo, or .mp4 link'}
                  </div>
                )}
                {(video.titleAr || video.titleEn) && (
                  <p className="text-center text-base font-semibold arabic text-foreground/80 mt-4">
                    {isAr ? video.titleAr : (video.titleEn || video.titleAr)}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Image Add/Edit Modal ── */}
      <Dialog open={imgModalOpen} onOpenChange={o => { if (!o) setImgModalOpen(false); }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="arabic">
              {editItem ? (isAr ? 'تعديل الصورة' : 'Edit Image') : (isAr ? 'إضافة صورة مميزة' : 'Add Featured Image')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="arabic">{isAr ? 'الصورة' : 'Image'}</Label>
              <div className="flex gap-2">
                <Input value={draftImage} onChange={e => setDraftImage(e.target.value)} dir="ltr" placeholder="https://..." className="flex-1" />
                <FileUploadBtn onFile={url => setDraftImage(url)} onLoading={setUploading}>
                  <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" disabled={uploading}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    {isAr ? 'رفع' : 'Upload'}
                  </Button>
                </FileUploadBtn>
              </div>
              {draftImage && (
                <img src={draftImage} alt="preview" className="w-full h-40 object-cover rounded-xl mt-1"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="arabic text-sm">{isAr ? 'العنوان عربي' : 'Title (AR)'}</Label>
                <Input value={draftTitleAr} onChange={e => setDraftTitleAr(e.target.value)} dir="rtl" className="arabic" placeholder="عنوان الصورة" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{isAr ? 'العنوان إنجليزي' : 'Title (EN)'}</Label>
                <Input value={draftTitleEn} onChange={e => setDraftTitleEn(e.target.value)} dir="ltr" placeholder="Image title" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setImgModalOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleSaveImg} disabled={!draftImage} className="bg-primary text-primary-foreground">{isAr ? 'حفظ' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Video Modal ── */}
      <Dialog open={vidModalOpen} onOpenChange={o => { if (!o) setVidModalOpen(false); }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="arabic">{isAr ? 'إضافة / تعديل الفيديو' : 'Add / Edit Video'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="arabic">{isAr ? 'رابط الفيديو' : 'Video URL'}</Label>
              <Input
                value={draftVidUrl}
                onChange={e => setDraftVidUrl(e.target.value)}
                dir="ltr"
                placeholder="https://youtube.com/watch?v=... أو https://vimeo.com/..."
              />
              <p className="text-xs text-muted-foreground arabic">
                {isAr
                  ? 'يدعم: يوتيوب، فيميو، أو رابط مباشر (.mp4) — بدون قيد على المدة'
                  : 'Supports: YouTube, Vimeo, or direct .mp4 link — no time limit'}
              </p>
              {draftVidUrl && (() => {
                const e = getVideoEmbed(draftVidUrl);
                return e ? (
                  <div className="mt-2 rounded-xl overflow-hidden aspect-video bg-black">
                    {e.type === 'direct'
                      ? <video src={e.embedUrl} controls className="w-full h-full" />
                      : <iframe src={e.embedUrl} className="w-full h-full" allowFullScreen title="preview" />
                    }
                  </div>
                ) : (
                  <p className="text-xs text-destructive arabic mt-1">{isAr ? 'رابط غير معروف' : 'Unrecognized URL'}</p>
                );
              })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="arabic text-sm">{isAr ? 'عنوان عربي' : 'Title (AR)'}</Label>
                <Input value={draftVidTitleAr} onChange={e => setDraftVidTitleAr(e.target.value)} dir="rtl" className="arabic" placeholder="عنوان الفيديو" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{isAr ? 'عنوان إنجليزي' : 'Title (EN)'}</Label>
                <Input value={draftVidTitleEn} onChange={e => setDraftVidTitleEn(e.target.value)} dir="ltr" placeholder="Video title" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setVidModalOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleSaveVid} disabled={!draftVidUrl.trim()} className="bg-primary text-primary-foreground">{isAr ? 'حفظ' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Nursery SVG Logo ───────────────────────────────────── */
function TreeSVG() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer circle */}
      <circle cx="48" cy="48" r="46" fill="hsl(150 35% 28%)" />
      <circle cx="48" cy="48" r="42" fill="hsl(150 30% 22%)" />
      {/* Inner light ring */}
      <circle cx="48" cy="48" r="38" fill="none" stroke="hsl(80 50% 70%)" strokeWidth="1" strokeDasharray="4 3" />
      {/* Main stem */}
      <line x1="48" y1="72" x2="48" y2="44" stroke="hsl(27 55% 55%)" strokeWidth="3" strokeLinecap="round"/>
      {/* Left big leaf */}
      <path d="M48 60 C38 50 28 48 30 38 C35 38 46 44 48 56" fill="hsl(100 45% 42%)" />
      {/* Right big leaf */}
      <path d="M48 54 C58 44 68 42 66 32 C61 32 50 38 48 50" fill="hsl(130 50% 36%)" />
      {/* Top leaf */}
      <path d="M48 44 C44 34 44 24 48 20 C52 24 52 34 48 44" fill="hsl(110 55% 50%)" />
      {/* Small left leaf */}
      <path d="M48 50 C40 44 34 46 34 40 C38 38 46 42 48 50" fill="hsl(90 48% 48%)" />
      {/* Ground arc */}
      <path d="M36 74 Q48 69 60 74" stroke="hsl(27 40% 60%)" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Soil dots */}
      <circle cx="40" cy="76" r="1.5" fill="hsl(27 40% 60%)" opacity="0.7"/>
      <circle cx="48" cy="77" r="1.5" fill="hsl(27 40% 60%)" opacity="0.7"/>
      <circle cx="56" cy="76" r="1.5" fill="hsl(27 40% 60%)" opacity="0.7"/>
    </svg>
  );
}

/* ── QuoteCartItem type ──────────────────────────────────── */
interface QuoteCartItem {
  plantId: string;
  plantNameAr: string;
  plantNameEn: string;
  plantImage: string;
  sectionNameAr: string;
  sectionNameEn: string;
  quantity: number;
  size: string;
}

/* ── Quote Request Modal (customer) ─────────────────────── */

function QuoteRequestModal({ open, onClose, sections, lang, cart, setCart }: {
  open: boolean; onClose: () => void; sections: Section[];
  lang: string; cart: QuoteCartItem[]; setCart: React.Dispatch<React.SetStateAction<QuoteCartItem[]>>;
}) {
  const isAr = lang === 'ar';
  const [step, setStep] = useState<'pick' | 'info'>('pick');
  const [search, setSearch] = useState('');
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custNotes, setCustNotes] = useState('');
  const [shippingMode, setShippingMode] = useState<'pickup' | 'delivery' | 'plant_only' | 'delivery_plant' | ''>('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shippingError, setShippingError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ name: string; mode: 'pickup' | 'delivery' | 'plant_only' | 'delivery_plant'; address: string } | null>(null);

  // size modal
  const [sizeTarget, setSizeTarget] = useState<{ s: Section; p: Photo } | null>(null);
  const [tempQty, setTempQty] = useState(1);
  const [tempSize, setTempSize] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = q
    ? sections.map(s => ({ ...s, photos: s.photos.filter(p => p.nameAr.toLowerCase().includes(q) || p.nameEn.toLowerCase().includes(q)) })).filter(s => s.photos.length > 0)
    : sections;

  const inCart = (pid: string) => cart.find(c => c.plantId === pid);

  const openSize = (s: Section, p: Photo) => {
    const existing = inCart(p.id);
    setTempQty(existing?.quantity ?? 1);
    setTempSize(existing?.size ?? '');
    setSizeTarget({ s, p });
  };

  const confirmAdd = () => {
    if (!sizeTarget) return;
    const { s, p } = sizeTarget;
    setCart(prev => {
      const existing = prev.find(c => c.plantId === p.id);
      if (existing) return prev.map(c => c.plantId === p.id ? { ...c, quantity: tempQty, size: tempSize } : c);
      return [...prev, { plantId: p.id, plantNameAr: p.nameAr, plantNameEn: p.nameEn, plantImage: p.image, sectionNameAr: s.nameAr, sectionNameEn: s.nameEn, quantity: tempQty, size: tempSize }];
    });
    setSizeTarget(null);
  };

  const removeFromCart = (pid: string) => setCart(prev => prev.filter(c => c.plantId !== pid));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || cart.length === 0) return;
    if (!custPhone.trim()) { toast.error(isAr ? 'رقم الهاتف إلزامي' : 'Phone number is required'); return; }
    if (!shippingMode) { setShippingError(true); return; }
    if ((shippingMode === 'delivery' || shippingMode === 'delivery_plant' || shippingMode === 'plant_only') && !shippingAddress.trim()) { setShippingError(true); return; }
    // Snapshot ALL state values NOW before any async op — prevents stale closure issues
    const snapShipping = shippingMode as 'pickup' | 'delivery' | 'plant_only' | 'delivery_plant';
    const snapAddress  = (shippingMode === 'delivery' || shippingMode === 'delivery_plant' || shippingMode === 'plant_only') ? shippingAddress.trim() : '';
    const snapName     = custName.trim();
    const snapPhone    = custPhone.trim();
    const snapNotes    = custNotes.trim();
    setShippingError(false);
    setSubmitting(true);
    const items: QuoteItem[] = cart.map(c => ({ ...c, price: 0 }));
    const id = await submitQuote({ shippingMethod: snapShipping, shippingAddress: snapAddress, customerName: snapName, phone: snapPhone, items, notes: snapNotes, shippingFee: 0 });
    setSubmitting(false);
    if (id) {
      setSuccessData({ name: snapName, mode: snapShipping, address: snapAddress });
      setSuccess(true);
      setCart([]);
      setCustName(''); setCustPhone(''); setCustNotes(''); setShippingMode(''); setShippingAddress('');
      setTimeout(() => { setSuccess(false); setStep('pick'); onClose(); }, 2500);
    } else {
      toast.error(isAr ? 'حدث خطأ في الإرسال — تأكد من اختيار طريقة التوصيل وحاول مرة أخرى' : 'Submission error — ensure delivery method is selected and try again');
    }
  };

  const handleClose = () => { setStep('pick'); setSuccess(false); setShippingMode(''); setShippingAddress(''); onClose(); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <ReceiptIcon className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-bold arabic text-foreground">{isAr ? 'طلب عرض سعر' : 'Request a Quote'}</h2>
              {cart.length > 0 && <p className="text-xs text-muted-foreground arabic">{cart.length} {isAr ? 'نبات محدد' : 'plants selected'}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step === 'info' && (
              <button onClick={() => setStep('pick')} className="text-xs text-primary underline arabic">{isAr ? '← رجوع' : '← Back'}</button>
            )}
            {cart.length > 0 && step === 'pick' && (
              <button onClick={() => setStep('info')} className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold arabic">
                {isAr ? 'التالي' : 'Next'} →
              </button>
            )}
            <button onClick={handleClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-10 px-6">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <p className="text-xl font-bold arabic text-foreground text-center">{isAr ? 'تم إرسال طلبك بنجاح!' : 'Your request was sent!'}</p>
            <p className="text-sm text-muted-foreground arabic text-center">{isAr ? 'سنتواصل معك قريباً بعرض السعر' : 'We will contact you soon with the quote'}</p>
            {successData && (
              <div className="w-full max-w-xs bg-muted/50 rounded-xl border border-border p-4 space-y-2 text-sm arabic mt-2">
                {successData.name && <div className="flex justify-between gap-2"><span className="text-muted-foreground">{isAr ? 'الاسم' : 'Name'}</span><span className="font-medium text-end">{successData.name}</span></div>}
                {successData.mode === 'pickup' ? (
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">{isAr ? 'الطريقة' : 'Method'}</span><span className="font-medium text-green-600">🏪 {isAr ? 'استلام من المشتل' : 'In-store Pickup'}</span></div>
                ) : successData.mode === 'plant_only' ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">{isAr ? 'الطريقة' : 'Method'}</span><span className="font-medium text-orange-600">🌱 {isAr ? 'زراعة الأشجار' : 'Planting Only'}</span></div>
                    {successData.address && <div className="flex justify-between gap-2"><span className="text-muted-foreground">{isAr ? 'موقع الزراعة' : 'Plant Site'}</span><span className="font-medium text-orange-600 text-end">📍 {successData.address}</span></div>}
                  </div>
                ) : successData.mode === 'delivery_plant' ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between gap-2"><span className="text-muted-foreground">{isAr ? 'الطريقة' : 'Method'}</span><span className="font-medium text-orange-600">🚚🌱 {isAr ? 'توصيل وزراعة' : 'Delivery & Plant'}</span></div>
                    {successData.address && <div className="flex justify-between gap-2"><span className="text-muted-foreground">{isAr ? 'العنوان' : 'Address'}</span><span className="font-medium text-blue-600 text-end">📍 {successData.address}</span></div>}
                  </div>
                ) : (
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">{isAr ? 'العنوان' : 'Address'}</span><span className="font-medium text-blue-600 text-end">📍 {successData.address}</span></div>
                )}
              </div>
            )}
          </div>
        ) : step === 'pick' ? (
          /* Plant picker */
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-border shrink-0">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={isAr ? 'ابحث عن نبات...' : 'Search plants...'}
                  className="w-full ps-9 pe-3 h-9 rounded-lg border border-border bg-background text-sm arabic focus:outline-none focus:ring-2 focus:ring-primary/30"
                  dir={isAr ? 'rtl' : 'ltr'} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {filtered.length === 0 && (
                <p className="text-center text-muted-foreground arabic py-10">{isAr ? 'لا توجد نتائج' : 'No results'}</p>
              )}
              {filtered.map(section => (
                <div key={section.id}>
                  <h3 className="text-sm font-bold arabic text-foreground/70 mb-3 flex items-center gap-2">
                    <span className="w-4 h-px bg-foreground/20 inline-block" />
                    {isAr ? section.nameAr : section.nameEn}
                    <span className="w-4 h-px bg-foreground/20 inline-block" />
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {section.photos.map(photo => {
                      const selected = inCart(photo.id);
                      return (
                        <button key={photo.id} onClick={() => openSize(section, photo)}
                          className={`relative rounded-xl overflow-hidden border-2 transition-all text-start ${selected ? 'border-primary shadow-md' : 'border-border hover:border-primary/40'}`}
                        >
                          <div className="aspect-square bg-muted overflow-hidden">
                            {photo.image ? (
                              <img src={photo.image} alt={photo.nameAr} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <Flower2 className="w-6 h-6 opacity-30" />
                              </div>
                            )}
                          </div>
                          <div className="p-1.5">
                            <p className="text-[11px] font-semibold arabic text-foreground leading-tight truncate">{isAr ? photo.nameAr : photo.nameEn}</p>
                          </div>
                          {selected && (
                            <div className="absolute top-1 end-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <span className="text-[9px] font-bold text-white">{selected.quantity}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Cart summary bar */}
            {cart.length > 0 && (
              <div className="border-t border-border px-4 py-3 bg-muted/50 shrink-0">
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {cart.map(item => (
                    <div key={item.plantId} className="shrink-0 flex items-center gap-1.5 bg-card border border-primary/30 rounded-full px-2.5 py-1">
                      {item.plantImage && <img src={item.plantImage} alt="" className="w-5 h-5 rounded-full object-cover" />}
                      <span className="text-xs arabic font-medium">{isAr ? item.plantNameAr : item.plantNameEn}</span>
                      <span className="text-[10px] text-muted-foreground">×{item.quantity}</span>
                      <button onClick={() => removeFromCart(item.plantId)} className="w-3.5 h-3.5 rounded-full bg-muted-foreground/20 flex items-center justify-center hover:bg-destructive hover:text-white transition-colors">
                        <X className="w-2 h-2" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Customer info form */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Selected items summary */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2.5 border-b border-border">
                <p className="text-sm font-bold arabic text-foreground">{isAr ? 'النباتات المختارة' : 'Selected Plants'}</p>
              </div>
              <div className="divide-y divide-border">
                {cart.map(item => (
                  <div key={item.plantId} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0 border border-border">
                      {item.plantImage ? (
                        <img src={item.plantImage} alt={item.plantNameAr} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Flower2 className="w-5 h-5 opacity-30" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold arabic text-foreground truncate">{isAr ? item.plantNameAr : item.plantNameEn}</p>
                      <p className="text-xs text-muted-foreground arabic">{isAr ? item.sectionNameAr : item.sectionNameEn}</p>
                      <p className="text-xs text-primary arabic">{isAr ? 'الكمية:' : 'Qty:'} {item.quantity}{item.size ? ` · ${item.size}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => removeFromCart(item.plantId)} className="w-7 h-7 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* Customer info */}
            <div className="space-y-3">
              <div>
                <Label className="arabic text-sm mb-1.5 block">{isAr ? 'اسمك *' : 'Your Name *'}</Label>
                <Input value={custName} onChange={e => setCustName(e.target.value)} dir="rtl" className="arabic" placeholder={isAr ? 'اسمك الكريم' : 'Full name'} required />
              </div>
              <div>
                <Label className="arabic text-sm mb-1.5 block">{isAr ? 'رقم الهاتف *' : 'Phone Number *'}</Label>
                <Input value={custPhone} onChange={e => setCustPhone(e.target.value)} dir="ltr" placeholder="+962 7X XXX XXXX" type="tel" required />
              </div>
              <div>
                <Label className={`arabic text-sm mb-1.5 block ${shippingError ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {isAr ? 'طريقة التوصيل *' : 'Delivery Method *'}
                </Label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => { setShippingMode('pickup'); setShippingError(false); setShippingAddress(''); }}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${shippingMode === 'pickup' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted'}`}
                  >
                    <span className="text-lg">🏪</span>
                    <span className="text-sm font-bold arabic text-foreground">{isAr ? 'استلام من المشتل' : 'Pickup'}</span>
                    {shippingMode === 'pickup' && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShippingMode('delivery'); setShippingError(false); }}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${shippingMode === 'delivery' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted'}`}
                  >
                    <span className="text-lg">🚚</span>
                    <span className="text-sm font-bold arabic text-foreground">{isAr ? 'توصيل فقط' : 'Delivery Only'}</span>
                    {shippingMode === 'delivery' && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                </div>
                {shippingMode === 'delivery' && (
                  <Input
                    value={shippingAddress}
                    onChange={e => { setShippingAddress(e.target.value); setShippingError(false); }}
                    dir="rtl"
                    className="arabic"
                    placeholder={isAr ? 'اكتب عنوانك للتوصيل...' : 'Enter your delivery address...'}
                  />
                )}
                {shippingError && (
                  <p className="text-xs text-red-600 dark:text-red-400 arabic mt-1">
                    {isAr
                      ? (shippingMode === 'delivery' ? '⚠️ يرجى كتابة عنوان التوصيل' : '⚠️ يرجى اختيار طريقة التوصيل')
                      : (shippingMode === 'delivery' ? '⚠️ Please enter a delivery address' : '⚠️ Please select a delivery method')}
                  </p>
                )}
              </div>
              <div>
                <Label className="arabic text-sm mb-1.5 block">{isAr ? 'ملاحظات إضافية' : 'Additional Notes'}</Label>
                <textarea value={custNotes} onChange={e => setCustNotes(e.target.value)}
                  dir="rtl"
                  placeholder={isAr ? 'أي تفاصيل إضافية...' : 'Any additional details...'}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm arabic focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 text-base arabic font-bold" disabled={submitting || !custName.trim() || cart.length === 0 || !shippingMode}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ReceiptIcon className="w-4 h-4 me-2" />{isAr ? 'إرسال طلب العرض' : 'Send Quote Request'}</>}
            </Button>
          </form>
        )}
      </div>

      {/* Size/Qty popup */}
      {sizeTarget && (() => {
        const noSizeNeeded = sizeTarget.s.nameAr.includes('مستلزمات');
        return (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6" onClick={() => setSizeTarget(null)}>
            <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-xs shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                {sizeTarget.p.image && <img src={sizeTarget.p.image} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />}
                <div>
                  <p className="text-sm font-bold arabic text-foreground">{isAr ? sizeTarget.p.nameAr : sizeTarget.p.nameEn}</p>
                  <p className="text-xs text-muted-foreground arabic">{isAr ? sizeTarget.s.nameAr : sizeTarget.s.nameEn}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="arabic text-xs mb-1 block">{isAr ? 'الكمية' : 'Quantity'}</Label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setTempQty(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/70">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input type="number" min={1} value={tempQty} onChange={e => setTempQty(Math.max(1, Number(e.target.value)))}
                      className="flex-1 text-center h-8 rounded-lg border border-border bg-background text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    <button type="button" onClick={() => setTempQty(q => q + 1)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/70">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {!noSizeNeeded && (
                  <div>
                    <Label className="arabic text-xs mb-1 block">
                      {isAr ? 'الحجم' : 'Size'}
                      <span className="text-red-500 ms-1">*</span>
                      {!tempSize && <span className="text-red-400 ms-2 text-[10px]">({isAr ? 'إلزامي' : 'required'})</span>}
                    </Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {['صغير', 'وسط', 'كبير'].map(sz => (
                        <button key={sz} type="button" onClick={() => setTempSize(sz === tempSize ? '' : sz)}
                          className={`px-3 py-1 rounded-full text-xs arabic border transition-colors ${tempSize === sz ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-border bg-background hover:border-primary/40'}`}>
                          {sz}
                        </button>
                      ))}
                      <input value={['صغير','وسط','كبير'].includes(tempSize) ? '' : tempSize}
                        onChange={e => setTempSize(e.target.value)}
                        placeholder={isAr ? 'آخر...' : 'other...'}
                        className="px-3 py-1 rounded-full text-xs border border-dashed border-border bg-background focus:outline-none focus:border-primary w-20 text-center arabic" />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setSizeTarget(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
                <Button type="button" className="flex-1" onClick={confirmAdd} disabled={!noSizeNeeded && !tempSize.trim()}>
                  <ShoppingCart className="w-3.5 h-3.5 me-1.5" />{isAr ? 'إضافة' : 'Add'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ── Admin Quotes Modal ─────────────────────────────────── */
function AdminQuotesModal({ open, onClose, lang, siteData }: {
  open: boolean; onClose: () => void; lang: string;
  siteData: { titleAr: string; titleEn: string; logo: { customUrl: string }; footer: { phone?: string; email?: string; website?: string }; sections: import('@/lib/storage').Section[] };
}) {
  const isAr = lang === 'ar';

  const plantImageMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of siteData.sections) {
      for (const p of s.photos) {
        if (p.image) m.set(p.id, p.image);
      }
    }
    return m;
  }, [siteData.sections]);
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [trashQuotes, setTrashQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);
  const [editQuote, setEditQuote] = useState<QuoteRequest | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pdfingId, setPdfingId] = useState<string | null>(null);
  const [qadriOldPdfingId, setQadriOldPdfingId] = useState<string | null>(null);
  const [noHeaderPdfingId, setNoHeaderPdfingId] = useState<string | null>(null);
  const [convertingQuoteId, setConvertingQuoteId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [tab, setTab] = useState<'new' | 'priced' | 'trash'>('new');
  const todayMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayMonth);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setQuotes([]);
    const qs = await fetchQuotes();
    if (qs !== null) setQuotes(qs);
    setLoading(false);
  }, []);

  const loadTrash = useCallback(async () => {
    setTrashLoading(true);
    setTrashQuotes([]);
    const qs = await fetchQuotes({ trash: true });
    if (qs !== null) setTrashQuotes(qs);
    setTrashLoading(false);
  }, []);

  useEffect(() => { if (open) { load(); } }, [open, load]);
  useEffect(() => { if (open && tab === 'trash') loadTrash(); }, [open, tab, loadTrash]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => { if (tab !== 'trash') load(); }, 15000);
    return () => clearInterval(id);
  }, [open, load, tab]);

  const handleDelete = async (id: string) => {
    if (!confirm(isAr ? 'نقل للمحذوفات؟' : 'Move to trash?')) return;
    const ok = await deleteQuote(id);
    if (!ok) {
      toast.error(isAr ? 'فشل نقل الطلب للمحذوفات' : 'Failed to move to trash');
      return;
    }
    setQuotes(prev => prev.filter(q => q.id !== id));
    if (editQuote?.id === id) setEditQuote(null);
    toast.success(isAr ? 'تم النقل للمحذوفات' : 'Moved to trash');
    loadTrash();
  };

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    const ok = await restoreQuote(id);
    setRestoringId(null);
    if (!ok) {
      toast.error(isAr ? 'فشل استعادة الطلب' : 'Failed to restore request');
      return;
    }
    setTrashQuotes(prev => prev.filter(q => q.id !== id));
    await load();
    toast.success(isAr ? 'تمت الاستعادة' : 'Restored');
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm(isAr ? 'حذف نهائي؟ لا يمكن التراجع!' : 'Permanently delete? Cannot be undone!')) return;
    await permanentDeleteQuote(id);
    setTrashQuotes(prev => prev.filter(q => q.id !== id));
    toast.success(isAr ? 'تم الحذف النهائي' : 'Permanently deleted');
  };

  const handleEmptyTrash = async () => {
    if (!confirm(isAr ? 'حذف جميع المحذوفات نهائياً؟ لا يمكن التراجع!' : 'Delete all trash permanently? Cannot be undone!')) return;
    for (const q of trashQuotes) {
      await permanentDeleteQuote(q.id);
    }
    setTrashQuotes([]);
    toast.success(isAr ? 'تم تفريغ سلة المحذوفات' : 'Trash emptied');
  };

  const handleQuickStatus = async (q: QuoteRequest, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = q.status === 'priced' ? 'pending' : 'priced';
    setSavingId(q.id);
    await updateQuote(q.id, { items: q.items, discount: q.discount, tax: q.tax, status: newStatus, notes: q.notes, shippingFee: q.shipping_fee, plantingFee: q.planting_fee, shippingMethod: q.shipping_method, shippingAddress: q.shipping_address });
    setSavingId(null);
    setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, status: newStatus } : x));
    if (editQuote?.id === q.id) setEditQuote(prev => prev ? { ...prev, status: newStatus } : prev);
  };

  const handleSave = async (q: QuoteRequest) => {
    setSavingId(q.id);
    await updateQuote(q.id, { items: q.items, discount: q.discount, tax: q.tax, status: 'priced', notes: q.notes, shippingFee: q.shipping_fee, plantingFee: q.planting_fee, shippingMethod: q.shipping_method, shippingAddress: q.shipping_address });
    setSavingId(null);
    setQuotes(prev => prev.map(x => x.id === q.id ? { ...q, status: 'priced' } : x));
    setEditQuote(prev => prev?.id === q.id ? { ...q, status: 'priced' } : prev);
    toast.success(isAr ? 'تم الحفظ' : 'Saved');
  };

  const handleDownloadPDF = async (q: QuoteRequest) => {
    setPdfingId(q.id);
    await downloadQuotePDF(q, { ...siteData, sections: siteData.sections });
    setPdfingId(null);
  };

  const handleDownloadQadriOld = async (q: QuoteRequest) => {
    setQadriOldPdfingId(q.id);
    await downloadQuotePDFNoHeader(q, 'عرض سعر', siteData.sections, '#2e7d32');
    setQadriOldPdfingId(null);
  };

  const handleDownloadNoHeaderOnly = async (q: QuoteRequest) => {
    setNoHeaderPdfingId(q.id);
    await downloadQuotePDFNoHeader(q, 'عرض سعر', siteData.sections, '#334155');
    setNoHeaderPdfingId(null);
  };

  const handleConvertToInvoice = async (q: QuoteRequest) => {
    setConvertingQuoteId(q.id);
    try {
      const availableItems = (q.items as QuoteItem[]).filter(it => !it.unavailable);
      if (availableItems.length === 0) {
        toast.error('لا توجد عناصر متاحة لتحويلها إلى فاتورة');
        return;
      }
      const subtotal = availableItems.reduce((s, it) => s + (it.price || 0) * it.quantity, 0);
      const discountAmt = subtotal * (Number(q.discount) / 100);
      const invoiceItems: InvoiceItem[] = availableItems.map(it => ({
        description: it.plantNameAr + (it.availableSize ? ` (${it.availableSize})` : it.size ? ` (${it.size})` : ''),
        quantity: it.quantity,
        unitPrice: it.price || 0,
      }));
      if (Number(q.shipping_fee) > 0) {
        invoiceItems.push({ description: 'رسوم الشحن', quantity: 1, unitPrice: Number(q.shipping_fee) });
      }
      if (Number(q.planting_fee) > 0) {
        invoiceItems.push({ description: 'رسوم الزراعة', quantity: 1, unitPrice: Number(q.planting_fee) });
      }
      let notes = q.notes || '';
      if (Number(q.tax) > 0) {
        const afterDiscount = subtotal - discountAmt;
        const taxAmt = afterDiscount * (Number(q.tax) / 100);
        const fmt = (n: number) => n.toLocaleString('ar', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        notes = `${notes ? notes + '\n' : ''}ضريبة ${Number(q.tax).toFixed(0)}%: ${fmt(taxAmt)} د.أ`;
      }
      const result = await createInvoice({
        customerName: q.customer_name,
        date: new Date().toISOString().slice(0, 10),
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
      setConvertingQuoteId(null);
    }
  };

  const updateItemPrice = (itemIdx: number, price: number) => {
    if (!editQuote) return;
    const items = editQuote.items.map((it, i) => i === itemIdx ? { ...it, price } : it);
    setEditQuote({ ...editQuote, items });
  };

  const updateItemAvailableSize = (itemIdx: number, availableSize: string) => {
    if (!editQuote) return;
    const items = editQuote.items.map((it, i) => i === itemIdx ? { ...it, availableSize } : it);
    setEditQuote({ ...editQuote, items });
  };

  const toggleItemUnavailable = (itemIdx: number) => {
    if (!editQuote) return;
    const items = editQuote.items.map((it, i) =>
      i === itemIdx ? { ...it, unavailable: !it.unavailable, price: !it.unavailable ? 0 : it.price } : it
    );
    setEditQuote({ ...editQuote, items });
  };

  const dateStr = (s: string) => new Date(s).toLocaleDateString(isAr ? 'ar-JO' : 'en-GB');
  const isPickup = (method?: string) => method === 'pickup';
  const subtotal = (q: QuoteRequest) => q.items.reduce((s, it) => it.unavailable ? s : s + (it.price || 0) * it.quantity, 0);

  const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return isAr
      ? d.toLocaleDateString('ar-JO', { month: 'long', year: 'numeric' })
      : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(todayMonth);
    for (const q of quotes) {
      months.add(q.created_at.slice(0, 7));
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [quotes, todayMonth]);

  const monthQuotes = quotes.filter(q => q.created_at.slice(0, 7) === selectedMonth);
  const trimmedSearch = searchQuery.trim();
  const visibleQuotes = trimmedSearch
    ? quotes.filter(q => q.customer_name.toLowerCase().includes(trimmedSearch.toLowerCase()))
    : monthQuotes.filter(q => tab === 'new' ? q.status !== 'priced' : q.status === 'priced');

  const handleWhatsApp = async (q: QuoteRequest) => {
    setSharingId(q.id);
    try {
      await shareQuotePDFToWhatsApp(q, { ...siteData, sections: siteData.sections });
    } finally {
      setSharingId(null);
    }
  };
  const grand = (q: QuoteRequest) => {
    const sub = subtotal(q);
    const after = sub - sub * (Number(q.discount) / 100);
    return after + after * (Number(q.tax) / 100) + (Number(q.shipping_fee) || 0) + (Number(q.planting_fee) || 0);
  };

  if (!open) return null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <Inbox className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold arabic text-foreground">{isAr ? 'طلبات عروض الأسعار' : 'Price Quote Requests'}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-bold arabic bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
              title={isAr ? 'إنشاء عرض سعر جديد' : 'Create new quote'}
            >
              <FilePlus className="w-3.5 h-3.5" />
              {isAr ? 'إنشاء عرض' : 'New Quote'}
            </button>
            <button onClick={load} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors" title={isAr ? 'تحديث القائمة' : 'Refresh list'}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Month navigator */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0 bg-muted/10">
          <button
            onClick={() => { const i = availableMonths.indexOf(selectedMonth); if (i < availableMonths.length - 1) { setSelectedMonth(availableMonths[i + 1]); setEditQuote(null); } }}
            disabled={availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors shrink-0"
          >
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
          <div className="flex-1 min-w-0">
            <select
              value={selectedMonth}
              onChange={e => { setSelectedMonth(e.target.value); setEditQuote(null); }}
              className="w-full text-center text-sm font-bold arabic bg-transparent border-none outline-none cursor-pointer text-foreground"
            >
              {availableMonths.map(ym => (
                <option key={ym} value={ym}>{monthLabel(ym)}{ym === todayMonth ? (isAr ? ' (الحالي)' : ' (current)') : ''}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { const i = availableMonths.indexOf(selectedMonth); if (i > 0) { setSelectedMonth(availableMonths[i - 1]); setEditQuote(null); } }}
            disabled={availableMonths.indexOf(selectedMonth) <= 0}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted disabled:opacity-30 transition-colors shrink-0"
          >
            <ChevronDown className="w-4 h-4 -rotate-90" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 bg-muted/20">
          <button
            onClick={() => { setTab('new'); setEditQuote(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm arabic font-medium transition-colors ${tab === 'new' ? 'border-b-2 border-primary text-primary bg-background' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {isAr ? 'جديدة' : 'New'}
            {monthQuotes.filter(q => q.status !== 'priced').length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'new' ? 'bg-primary text-primary-foreground' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>{monthQuotes.filter(q => q.status !== 'priced').length}</span>
            )}
          </button>
          <button
            onClick={() => { setTab('priced'); setEditQuote(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm arabic font-medium transition-colors ${tab === 'priced' ? 'border-b-2 border-primary text-primary bg-background' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {isAr ? 'مسعّرة' : 'Priced'}
            {monthQuotes.filter(q => q.status === 'priced').length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'priced' ? 'bg-primary text-primary-foreground' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>{monthQuotes.filter(q => q.status === 'priced').length}</span>
            )}
          </button>
          <button
            onClick={() => { setTab('trash'); setEditQuote(null); setSearchQuery(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm arabic font-medium transition-colors ${tab === 'trash' ? 'border-b-2 border-destructive text-destructive bg-background' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Trash className="w-3.5 h-3.5" />
            {isAr ? 'المحذوفات' : 'Trash'}
            {trashQuotes.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${tab === 'trash' ? 'bg-destructive text-destructive-foreground' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{trashQuotes.length}</span>
            )}
          </button>
        </div>

        {/* Search bar — hidden in trash tab */}
        {tab !== 'trash' && (
          <div className="px-3 py-2 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setEditQuote(null); }}
                placeholder={isAr ? 'ابحث باسم الزبون...' : 'Search by name...'}
                className="w-full ps-8 pe-8 py-1.5 text-sm arabic rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setEditQuote(null); }} className="absolute end-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Trash tab content */}
        {tab === 'trash' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {trashQuotes.length > 0 && (
              <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between bg-red-50/50 dark:bg-red-950/20">
                <p className="text-xs arabic text-muted-foreground">{isAr ? `${trashQuotes.length} طلب محذوف` : `${trashQuotes.length} deleted requests`}</p>
                <button onClick={handleEmptyTrash} className="text-xs arabic text-destructive hover:underline font-medium">
                  {isAr ? 'تفريغ السلة' : 'Empty trash'}
                </button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {trashLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : trashQuotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                  <Trash className="w-10 h-10 opacity-30" />
                  <p className="text-sm arabic">{isAr ? 'سلة المحذوفات فارغة' : 'Trash is empty'}</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {trashQuotes.map(q => (
                    <div key={q.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold arabic text-foreground/70 truncate line-through">{q.customer_name}</p>
                        <p className="text-xs text-muted-foreground arabic mt-0.5">{q.items.length} {isAr ? 'نبات' : 'plants'} · {new Date(q.created_at).toLocaleDateString(isAr ? 'ar-JO' : 'en-GB')}</p>
                        {q.phone && <p className="text-xs text-muted-foreground font-mono" dir="ltr">{q.phone}</p>}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => handleRestore(q.id)}
                          disabled={restoringId === q.id}
                          title={isAr ? 'استعادة' : 'Restore'}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                        >
                          {restoringId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArchiveRestore className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(q.id)}
                          title={isAr ? 'حذف نهائي' : 'Delete permanently'}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab !== 'trash' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Quotes list */}
          <div className={`${editQuote ? 'hidden sm:flex' : 'flex'} flex-col w-full sm:w-72 border-e border-border overflow-y-auto shrink-0`}>
            {loading && quotes.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : visibleQuotes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Inbox className="w-10 h-10 opacity-30" />
                <p className="text-sm arabic">
                  {trimmedSearch
                    ? (isAr ? 'لا نتائج للبحث' : 'No results found')
                    : tab === 'new'
                    ? (isAr ? 'لا توجد طلبات جديدة' : 'No new requests')
                    : (isAr ? 'لا توجد طلبات مسعّرة بعد' : 'No priced quotes yet')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {visibleQuotes.map(q => (
                  <div key={q.id}
                    className={`relative flex items-stretch hover:bg-muted/50 transition-colors ${editQuote?.id === q.id ? 'bg-primary/5 border-e-2 border-e-primary' : ''}`}
                  >
                    <button onClick={() => setEditQuote(q)} className="flex-1 text-start px-4 py-3.5 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold arabic text-foreground truncate">{q.customer_name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground arabic mt-0.5">{q.items.length} {isAr ? 'نبات' : 'plants'} · {dateStr(q.created_at)}</p>
                      {q.phone && <p className="text-xs text-muted-foreground mt-0.5 font-mono" dir="ltr">{q.phone}</p>}
                      {isPickup(q.shipping_method)
                        ? <span className="inline-flex items-center gap-1 mt-1 text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 arabic font-medium">🏪 {isAr ? 'استلام من المشتل' : 'In-store Pickup'}</span>
                        : q.shipping_method === 'delivery'
                          ? <span className="inline-flex items-center gap-1 mt-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 arabic font-medium">📍 {q.shipping_address}</span>
                          : q.shipping_method === 'delivery_free'
                          ? <span className="inline-flex items-center gap-1 mt-1 text-[11px] px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 arabic font-medium">🚗 {isAr ? 'توصيل مجاني' : 'Free Delivery'}</span>
                          : null
                      }
                    </button>
                    <button
                      onClick={e => handleQuickStatus(q, e)}
                      disabled={savingId === q.id}
                      title={q.status === 'priced' ? (isAr ? 'إعادة لجديد' : 'Mark as new') : (isAr ? 'تحديد كمسعّر' : 'Mark as priced')}
                      className={`shrink-0 w-12 flex flex-col items-center justify-center gap-1 border-s border-border transition-colors ${q.status === 'priced' ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-muted-foreground hover:bg-muted hover:text-primary'}`}
                    >
                      {savingId === q.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : q.status === 'priced'
                          ? <CheckCircle2 className="w-4 h-4" />
                          : <Circle className="w-4 h-4" />
                      }
                      <span className="text-[9px] arabic leading-none">{q.status === 'priced' ? (isAr ? 'مسعّر' : 'Priced') : (isAr ? 'جديد' : 'New')}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit panel */}
          {editQuote ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-5 pt-3 pb-2 border-b border-border shrink-0 bg-muted/30 space-y-2">
                {/* Row 1: customer info + action buttons */}
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditQuote(null)} className="sm:hidden w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted">
                    <ChevronDown className="w-4 h-4 rotate-90" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold arabic text-foreground">{editQuote.customer_name}</p>
                    <p className="text-xs text-muted-foreground arabic">{editQuote.phone} · {dateStr(editQuote.created_at)}</p>
                    <p className="text-xs arabic mt-0.5">
                      {isPickup(editQuote.shipping_method)
                        ? <span className="text-green-600 dark:text-green-400 font-medium">🏪 {isAr ? 'استلام من المشتل' : 'In-store Pickup'}</span>
                        : editQuote.shipping_method === 'delivery'
                          ? <span className="text-blue-600 dark:text-blue-400 font-medium">📍 {editQuote.shipping_address ? editQuote.shipping_address : (isAr ? 'توصيل — لم يُحدَّد العنوان' : 'Delivery — no address')}</span>
                          : editQuote.shipping_method === 'delivery_free'
                          ? <span className="text-teal-600 dark:text-teal-400 font-medium">🚗 {isAr ? 'توصيل مجاني' : 'Free Delivery'}</span>
                          : editQuote.shipping_method === 'delivery_plant'
                          ? <span className="text-orange-600 dark:text-orange-400 font-medium">🚚🌱 {isAr ? 'توصيل وزراعة' : 'Delivery & Planting'}{editQuote.shipping_address ? ` — 📍 ${editQuote.shipping_address}` : ''}</span>
                          : editQuote.shipping_method === 'plant_only'
                          ? <span className="text-orange-600 dark:text-orange-400 font-medium">🌱 {isAr ? 'زراعة الأشجار' : 'Planting Only'}{editQuote.shipping_address ? ` — 📍 ${editQuote.shipping_address}` : ''}</span>
                          : <span className="text-orange-500 font-medium">⚠️ {isAr ? 'لم يُحدَّد — اختر من الأسفل واحفظ' : 'Not set — choose below & save'}</span>
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" onClick={() => handleSave(editQuote)} disabled={savingId === editQuote.id} className="arabic text-xs">
                      {savingId === editQuote.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (isAr ? 'حفظ' : 'Save')}
                    </Button>
                    <button onClick={() => handleDelete(editQuote.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* Row 2: PDF download controls + convert to invoice */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(editQuote)} disabled={pdfingId === editQuote.id} className="arabic text-xs h-7">
                    {pdfingId === editQuote.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><FileDown className="w-3.5 h-3.5 me-1" />القادري</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleConvertToInvoice(editQuote)} disabled={convertingQuoteId === editQuote.id} className="arabic text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-50">
                    {convertingQuoteId === editQuote.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><FilePlus className="w-3.5 h-3.5 me-1" />تحويل إلى فاتورة</>}
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Items table */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b border-border">
                    <p className="text-xs font-bold arabic text-foreground/70">{isAr ? 'النباتات المطلوبة' : 'Requested Plants'}</p>
                  </div>
                  <div className="divide-y divide-border">
                    {editQuote.items.map((item, idx) => (
                      <div key={idx} className={`flex items-center gap-3 px-4 py-3 transition-colors ${item.unavailable ? 'bg-red-50/60 dark:bg-red-950/20' : ''}`}>
                        <div className={`w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0 border border-border transition-opacity ${item.unavailable ? 'opacity-40' : ''}`}>
                          {(item.plantImage || plantImageMap.get(item.plantId)) ? (
                            <img src={item.plantImage || plantImageMap.get(item.plantId)} alt={item.plantNameAr} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Flower2 className="w-5 h-5 opacity-30" /></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold arabic text-foreground ${item.unavailable ? 'line-through opacity-50' : ''}`}>{isAr ? item.plantNameAr : item.plantNameEn}</p>
                          <p className="text-xs text-muted-foreground arabic">{isAr ? item.sectionNameAr : item.sectionNameEn}</p>
                          <p className="text-xs text-primary arabic">{isAr ? 'الكمية:' : 'Qty:'} {item.quantity}</p>
                          {/* Size section */}
                          {item.size && (
                            <div className="mt-1 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground arabic shrink-0">{isAr ? 'طلب:' : 'Req:'}</span>
                                {item.availableSize ? (
                                  <span className="inline-flex items-center gap-0.5">
                                    <span className="text-[10px] font-bold text-red-400">✕</span>
                                    <span className="text-xs arabic font-medium text-muted-foreground">{item.size}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs arabic font-medium text-primary">{item.size}</span>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            <Label className="text-[10px] text-muted-foreground arabic shrink-0">{isAr ? 'المتوفر:' : 'Avail:'}</Label>
                            <input
                              value={item.availableSize ?? ''}
                              onChange={e => updateItemAvailableSize(idx, e.target.value)}
                              placeholder={isAr ? 'الحجم المتوفر...' : 'Available size...'}
                              dir="rtl"
                              className="flex-1 min-w-0 rounded border border-border bg-background px-1.5 py-0.5 text-xs arabic text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
                            />
                          </div>
                          {item.unavailable && (
                            <span className="inline-block mt-0.5 text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-bold arabic">
                              {isAr ? 'غير متوفر حاليًا' : 'Currently Unavailable'}
                            </span>
                          )}
                        </div>
                        <div className="shrink-0 flex flex-col items-center gap-1.5">
                          <button
                            onClick={() => toggleItemUnavailable(idx)}
                            title={isAr ? 'غير متوفر حاليًا' : 'Mark unavailable'}
                            className={`text-[10px] px-2 py-1 rounded-lg border font-bold arabic transition-colors ${
                              item.unavailable
                                ? 'bg-red-100 border-red-300 text-red-600 dark:bg-red-900/30 dark:border-red-700 dark:text-red-400'
                                : 'border-border text-muted-foreground hover:border-red-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
                            }`}
                          >
                            {item.unavailable ? (isAr ? '✕ غير متوفر' : '✕ N/A') : (isAr ? 'غير متوفر؟' : 'Unavail?')}
                          </button>
                          {!item.unavailable && (
                            <div className="w-28">
                              <Label className="text-[10px] text-muted-foreground arabic block mb-1">{isAr ? 'السعر/قطعة (د.أ)' : 'Price/unit (JD)'}</Label>
                              <Input type="number" min={0} step={0.01} value={item.price || ''} placeholder="0.00"
                                onChange={e => updateItemPrice(idx, Number(e.target.value))}
                                className="h-8 text-center text-sm font-bold" dir="ltr" />
                              {item.price > 0 && (
                                <p className="text-[10px] text-green-600 text-center mt-0.5 font-bold arabic">= {(item.price * item.quantity).toFixed(2)} د.أ</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery method */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
                    <p className="text-xs font-bold arabic text-foreground/70">{isAr ? 'طريقة التوصيل' : 'Delivery Method'}</p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditQuote({ ...editQuote, shipping_method: 'pickup', shipping_address: '' })}
                        className={`text-[10px] px-2.5 py-1 rounded-full border font-bold arabic transition-colors ${editQuote.shipping_method === 'pickup' ? 'bg-green-100 border-green-400 text-green-700 dark:bg-green-900/40 dark:border-green-600 dark:text-green-300' : 'border-border text-muted-foreground hover:border-green-400 hover:text-green-600'}`}
                      >
                        🏪 {isAr ? 'استلام' : 'Pickup'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditQuote({ ...editQuote, shipping_method: 'delivery' })}
                        className={`text-[10px] px-2.5 py-1 rounded-full border font-bold arabic transition-colors ${editQuote.shipping_method === 'delivery' ? 'bg-blue-100 border-blue-400 text-blue-700 dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-300' : 'border-border text-muted-foreground hover:border-blue-400 hover:text-blue-600'}`}
                      >
                        📍 {isAr ? 'توصيل' : 'Delivery'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditQuote({ ...editQuote, shipping_method: 'delivery_free', shipping_fee: 0 })}
                        className={`text-[10px] px-2.5 py-1 rounded-full border font-bold arabic transition-colors ${editQuote.shipping_method === 'delivery_free' ? 'bg-teal-100 border-teal-400 text-teal-700 dark:bg-teal-900/40 dark:border-teal-600 dark:text-teal-300' : 'border-border text-muted-foreground hover:border-teal-400 hover:text-teal-600'}`}
                      >
                        🚗 {isAr ? 'مجاني' : 'Free'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditQuote({ ...editQuote, shipping_method: 'delivery_plant' })}
                        className={`text-[10px] px-2.5 py-1 rounded-full border font-bold arabic transition-colors ${editQuote.shipping_method === 'delivery_plant' ? 'bg-orange-100 border-orange-400 text-orange-700 dark:bg-orange-900/40 dark:border-orange-600 dark:text-orange-300' : 'border-border text-muted-foreground hover:border-orange-400 hover:text-orange-600'}`}
                      >
                        🚚🌱 {isAr ? 'توصيل وزراعة' : 'Delivery & Plant'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditQuote({ ...editQuote, shipping_method: 'plant_only', shipping_address: '' })}
                        className={`text-[10px] px-2.5 py-1 rounded-full border font-bold arabic transition-colors ${editQuote.shipping_method === 'plant_only' ? 'bg-orange-100 border-orange-400 text-orange-700 dark:bg-orange-900/40 dark:border-orange-600 dark:text-orange-300' : 'border-border text-muted-foreground hover:border-orange-400 hover:text-orange-600'}`}
                      >
                        🌱 {isAr ? 'زراعة فقط' : 'Plant Only'}
                      </button>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    {editQuote.shipping_method === 'pickup'
                      ? (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                          <span className="text-2xl">🏪</span>
                          <div>
                            <p className="text-sm font-bold text-green-700 dark:text-green-400 arabic">{isAr ? 'استلام من المشتل' : 'In-store Pickup'}</p>
                            <p className="text-xs text-green-600/70 dark:text-green-500/70 arabic">{isAr ? 'الزبون سيستلم الطلب من المشتل مباشرةً — بدون رسوم شحن' : 'Customer will pick up from store — no shipping charge'}</p>
                          </div>
                        </div>
                      ) : editQuote.shipping_method === 'delivery_free'
                        ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800">
                              <span className="text-2xl">🚗</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-teal-700 dark:text-teal-400 arabic">{isAr ? 'توصيل مجاني' : 'Free Delivery'}</p>
                                <p className="text-xs text-teal-600/70 dark:text-teal-500/70 arabic">{isAr ? 'بدون رسوم توصيل' : 'No delivery fee'}</p>
                              </div>
                            </div>
                            <input
                              value={editQuote.shipping_address ?? ''}
                              onChange={e => setEditQuote({ ...editQuote, shipping_address: e.target.value })}
                              dir="rtl"
                              placeholder={isAr ? 'عنوان التوصيل (اختياري)...' : 'Delivery address (optional)...'}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm arabic focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                        ) : editQuote.shipping_method === 'delivery'
                        ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                              <span className="text-2xl">📍</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-blue-600/70 dark:text-blue-500/70 arabic mb-0.5">{isAr ? 'عنوان التوصيل' : 'Delivery Address'}</p>
                                {editQuote.shipping_address
                                  ? <p className="text-sm font-bold text-blue-700 dark:text-blue-400 arabic break-words">{editQuote.shipping_address}</p>
                                  : <p className="text-xs text-orange-600 arabic">{isAr ? 'لم يُدخَل عنوان — يرجى تحديثه أدناه' : 'No address entered — update below'}</p>
                                }
                              </div>
                            </div>
                            <input
                              value={editQuote.shipping_address ?? ''}
                              onChange={e => setEditQuote({ ...editQuote, shipping_address: e.target.value })}
                              dir="rtl"
                              placeholder={isAr ? 'اكتب عنوان التوصيل...' : 'Enter delivery address...'}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm arabic focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                        ) : editQuote.shipping_method === 'delivery_plant'
                        ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                              <span className="text-2xl">🚚🌱</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-orange-700 dark:text-orange-400 arabic">{isAr ? 'توصيل وزراعة الأشجار' : 'Delivery & Planting'}</p>
                                <p className="text-xs text-orange-600/70 dark:text-orange-500/70 arabic">{isAr ? 'يشمل التوصيل وخدمة الزراعة' : 'Includes delivery and planting service'}</p>
                              </div>
                            </div>
                            <input
                              value={editQuote.shipping_address ?? ''}
                              onChange={e => setEditQuote({ ...editQuote, shipping_address: e.target.value })}
                              dir="rtl"
                              placeholder={isAr ? 'عنوان التوصيل والزراعة (اختياري)...' : 'Delivery & planting address (optional)...'}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm arabic focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                        ) : editQuote.shipping_method === 'plant_only'
                        ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                              <span className="text-2xl">🌱</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-orange-700 dark:text-orange-400 arabic">{isAr ? 'زراعة الأشجار فقط' : 'Planting Only'}</p>
                                <p className="text-xs text-orange-600/70 dark:text-orange-500/70 arabic">{isAr ? 'خدمة الزراعة فقط — بدون توصيل' : 'Planting service only — no delivery'}</p>
                              </div>
                            </div>
                            <input
                              value={editQuote.shipping_address ?? ''}
                              onChange={e => setEditQuote({ ...editQuote, shipping_address: e.target.value })}
                              dir="rtl"
                              placeholder={isAr ? 'موقع الزراعة (اختياري)...' : 'Planting site address (optional)...'}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm arabic focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                            <span className="text-xl">⚠️</span>
                            <p className="text-sm text-orange-700 dark:text-orange-400 arabic">{isAr ? 'لم يُحدِّد الزبون طريقة التوصيل — اختر من الأزرار أعلاه' : 'No delivery method — choose from buttons above'}</p>
                          </div>
                        )
                    }
                  </div>
                </div>

                {/* Discount / Tax / Shipping */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="arabic text-xs mb-1 block">{isAr ? 'نسبة الخصم (%)' : 'Discount (%)'}</Label>
                    <Input type="number" min={0} max={100} step={0.1} value={editQuote.discount || ''}
                      onChange={e => setEditQuote({ ...editQuote, discount: Number(e.target.value) })}
                      placeholder="0" className="h-9" dir="ltr" />
                  </div>
                  <div>
                    <Label className="arabic text-xs mb-1 block">{isAr ? 'نسبة الضريبة (%)' : 'Tax (%)'}</Label>
                    <Input type="number" min={0} max={100} step={0.1} value={editQuote.tax || ''}
                      onChange={e => setEditQuote({ ...editQuote, tax: Number(e.target.value) })}
                      placeholder="0" className="h-9" dir="ltr" />
                  </div>
                  <div>
                    <Label className="arabic text-xs mb-1 block">{isAr ? 'رسوم الشحن (د.أ)' : 'Shipping (JD)'}</Label>
                    <Input type="number" min={0} step={0.01} value={editQuote.shipping_fee || ''}
                      onChange={e => setEditQuote({ ...editQuote, shipping_fee: Number(e.target.value) })}
                      placeholder="0.00" className="h-9" dir="ltr" />
                  </div>
                  <div>
                    <Label className="arabic text-xs mb-1 block">{isAr ? 'رسوم الزراعة (د.أ)' : 'Planting Fee (JD)'}</Label>
                    <Input type="number" min={0} step={0.01} value={editQuote.planting_fee || ''}
                      onChange={e => setEditQuote({ ...editQuote, planting_fee: Number(e.target.value) })}
                      placeholder="0.00" className="h-9" dir="ltr" />
                  </div>
                </div>
                {/* Totals summary */}
                <div className="rounded-xl border border-border p-4 bg-muted/30 space-y-2 text-sm">
                  <div className="flex justify-between arabic">
                    <span className="text-muted-foreground">{isAr ? 'المجموع' : 'Subtotal'}</span>
                    <span className="font-bold">{subtotal(editQuote).toFixed(2)} د.أ</span>
                  </div>
                  {Number(editQuote.discount) > 0 && (
                    <div className="flex justify-between arabic text-red-500">
                      <span>{isAr ? `خصم ${editQuote.discount}%` : `Discount ${editQuote.discount}%`}</span>
                      <span>− {(subtotal(editQuote) * Number(editQuote.discount) / 100).toFixed(2)} د.أ</span>
                    </div>
                  )}
                  {Number(editQuote.tax) > 0 && (
                    <div className="flex justify-between arabic text-amber-600">
                      <span>{isAr ? `ضريبة ${editQuote.tax}%` : `Tax ${editQuote.tax}%`}</span>
                      <span>+ {((subtotal(editQuote) - subtotal(editQuote) * Number(editQuote.discount) / 100) * Number(editQuote.tax) / 100).toFixed(2)} د.أ</span>
                    </div>
                  )}
                  {editQuote.shipping_method && (
                    <div className={`flex justify-between arabic ${isPickup(editQuote.shipping_method) ? 'text-green-600' : 'text-blue-600'}`}>
                      <span>
                        {isPickup(editQuote.shipping_method)
                          ? (isAr ? '🏪 استلام من المشتل' : '🏪 In-store Pickup')
                          : `📍 ${editQuote.shipping_address}`
                        }
                      </span>
                      <span>{Number(editQuote.shipping_fee) > 0 ? `+ ${Number(editQuote.shipping_fee).toFixed(2)} د.أ` : (isAr ? 'بدون رسوم' : 'No charge')}</span>
                    </div>
                  )}
                  {!editQuote.shipping_method && Number(editQuote.shipping_fee) > 0 && (
                    <div className="flex justify-between arabic text-blue-600">
                      <span>{isAr ? 'رسوم الشحن' : 'Shipping'}</span>
                      <span>+ {Number(editQuote.shipping_fee).toFixed(2)} د.أ</span>
                    </div>
                  )}
                  {Number(editQuote.planting_fee) > 0 && (
                    <div className="flex justify-between arabic text-orange-600">
                      <span>🌱 {isAr ? 'رسوم الزراعة' : 'Planting Fee'}</span>
                      <span>+ {Number(editQuote.planting_fee).toFixed(2)} د.أ</span>
                    </div>
                  )}
                  <div className="flex justify-between arabic border-t border-border pt-2 font-extrabold text-base text-green-600">
                    <span>{isAr ? 'الإجمالي' : 'Grand Total'}</span>
                    <span>{grand(editQuote).toFixed(2)} د.أ</span>
                  </div>
                </div>

                {/* Notes — editable */}
                <div className="rounded-xl border border-border p-4 space-y-2">
                  <p className="text-xs font-bold arabic text-muted-foreground">{isAr ? 'الملاحظات' : 'Notes'}</p>
                  <textarea
                    value={editQuote.notes ?? ''}
                    onChange={e => setEditQuote({ ...editQuote, notes: e.target.value })}
                    rows={3}
                    dir="rtl"
                    placeholder={isAr ? 'أضف ملاحظات هنا...' : 'Add notes here...'}
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm arabic text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex flex-1 items-center justify-center text-muted-foreground flex-col gap-3">
              <ReceiptIcon className="w-10 h-10 opacity-20" />
              <p className="text-sm arabic">{isAr ? 'اختر طلباً لعرض التفاصيل' : 'Select a request to view details'}</p>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
    <AdminCreateQuoteModal
      open={createOpen}
      onClose={() => setCreateOpen(false)}
      siteData={siteData}
      lang={lang}
      onCreated={() => { load(); setTab('priced'); }}
    />
    </>
  );
}

/* ── Admin Create Quote Modal ───────────────────────────── */
function ItemImgCell({ image, alt, onUpload }: { image: string; alt: string; onUpload: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  return (
    <div className="relative w-9 h-9 mx-auto group cursor-pointer" onClick={() => fileRef.current?.click()}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return;
          setUploading(true);
          try { const url = await uploadImage(f); onUpload(url); }
          catch { toast.error('فشل رفع الصورة'); }
          finally { setUploading(false); e.target.value = ''; }
        }} />
      {uploading ? (
        <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center border border-border">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        </div>
      ) : image ? (
        <div className="relative w-9 h-9">
          <img src={image} alt={alt} className="w-9 h-9 rounded-md object-cover border border-border" />
          <div className="absolute inset-0 rounded-md bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      ) : (
        <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center border border-dashed border-border group-hover:border-primary group-hover:bg-primary/5 transition-colors">
          <ImagePlus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      )}
    </div>
  );
}

function AdminCreateQuoteModal({ open, onClose, siteData, lang, onCreated }: {
  open: boolean;
  onClose: () => void;
  siteData: { titleAr: string; titleEn: string; logo: { customUrl: string }; footer: { phone?: string; email?: string; website?: string }; sections: Section[] };
  lang: string;
  onCreated: () => void;
}) {
  const isAr = lang === 'ar';
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [shippingMethod, setShippingMethod] = useState('pickup');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingFee, setShippingFee] = useState(0);
  const [plantingFee, setPlantingFee] = useState(0);
  const [plantSearch, setPlantSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setCustomerName(''); setPhone(''); setItems([]); setNotes('');
      setDiscount(0); setTax(0); setShippingMethod('pickup');
      setShippingAddress(''); setShippingFee(0); setPlantingFee(0);
      setPlantSearch(''); setShowSearch(false);
    }
  }, [open]);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSearch(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const allPlants = useMemo(() => {
    const list: { photo: Photo; section: Section }[] = [];
    for (const sec of siteData.sections) {
      for (const p of sec.photos) list.push({ photo: p, section: sec });
    }
    return list;
  }, [siteData.sections]);

  const filteredPlants = useMemo(() => {
    if (!plantSearch.trim()) return allPlants.slice(0, 12);
    const q = plantSearch.trim().toLowerCase();
    return allPlants.filter(({ photo }) =>
      photo.nameAr.includes(plantSearch.trim()) ||
      (photo.nameEn || '').toLowerCase().includes(q)
    ).slice(0, 12);
  }, [allPlants, plantSearch]);

  const addPlantFromSearch = (photo: Photo, section: Section) => {
    setItems(prev => [...prev, {
      plantId: photo.id,
      plantNameAr: photo.nameAr,
      plantNameEn: photo.nameEn || '',
      plantImage: photo.image || '',
      sectionNameAr: section.nameAr,
      sectionNameEn: section.nameEn,
      quantity: 1,
      size: '',
      price: 0,
    }]);
    setPlantSearch('');
    setShowSearch(false);
  };

  const addCustomItem = () => {
    setItems(prev => [...prev, {
      plantId: `custom-${Date.now()}`,
      plantNameAr: '',
      plantNameEn: '',
      plantImage: '',
      sectionNameAr: '',
      sectionNameEn: '',
      quantity: 1,
      size: '',
      price: 0,
    }]);
  };

  const updateItem = (idx: number, patch: Partial<QuoteItem>) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));

  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, it) => s + (it.price || 0) * it.quantity, 0);
  const discountAmt = subtotal * (discount / 100);
  const afterDiscount = subtotal - discountAmt;
  const taxAmt = afterDiscount * (tax / 100);
  const grand = afterDiscount + taxAmt + shippingFee + plantingFee;
  const fmt = (n: number) => n.toLocaleString('ar', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleSubmit = async () => {
    if (!customerName.trim()) { toast.error(isAr ? 'اسم الزبون مطلوب' : 'Customer name required'); return; }
    if (items.length === 0) { toast.error(isAr ? 'أضف بنداً على الأقل' : 'Add at least one item'); return; }
    setSaving(true);
    const id = await adminCreateQuote({
      shippingMethod, shippingAddress, customerName, phone,
      items, notes, shippingFee, plantingFee, discount, tax,
    });
    setSaving(false);
    if (id) {
      toast.success(isAr ? 'تم إنشاء عرض السعر بنجاح ✓' : 'Quote created successfully ✓');
      onCreated();
      onClose();
    } else {
      toast.error(isAr ? 'فشل إنشاء العرض، تحقق من الاتصال' : 'Failed to create quote');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-5xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <FilePlus className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold arabic text-foreground">{isAr ? 'إنشاء عرض سعر جديد' : 'Create New Quote'}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Customer Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-bold arabic text-muted-foreground mb-1">{isAr ? 'اسم الزبون *' : 'Customer Name *'}</p>
              <input
                type="text" value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                dir="rtl"
                placeholder={isAr ? 'اسم الزبون...' : 'Customer name...'}
                className="w-full px-3 py-2 text-sm arabic rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <p className="text-xs font-bold arabic text-muted-foreground mb-1">{isAr ? 'رقم الهاتف' : 'Phone'}</p>
              <input
                type="tel" value={phone}
                onChange={e => setPhone(e.target.value)}
                dir="ltr"
                placeholder="+962..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Items section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold arabic text-foreground">{isAr ? 'بنود عرض السعر' : 'Quote Items'}</p>
              <button
                onClick={addCustomItem}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs arabic font-medium border border-border hover:bg-muted transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {isAr ? 'إضافة بند مخصص' : 'Add Custom Item'}
              </button>
            </div>

            {/* Plant search */}
            <div className="relative" ref={searchBoxRef}>
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text" value={plantSearch}
                  onChange={e => { setPlantSearch(e.target.value); setShowSearch(true); }}
                  onFocus={() => setShowSearch(true)}
                  dir="rtl"
                  placeholder={isAr ? 'ابحث عن نبات لإضافته...' : 'Search plant to add...'}
                  className="w-full ps-8 pe-3 py-2 text-sm arabic rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {showSearch && filteredPlants.length > 0 && (
                <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-52 overflow-y-auto">
                  {filteredPlants.map(({ photo, section }) => (
                    <button
                      key={photo.id}
                      onMouseDown={e => { e.preventDefault(); addPlantFromSearch(photo, section); }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted transition-colors text-start"
                    >
                      {photo.image && (
                        <img src={photo.image} alt={photo.nameAr} className="w-8 h-8 rounded-md object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium arabic text-foreground truncate">{photo.nameAr}</p>
                        <p className="text-xs text-muted-foreground arabic truncate">{section.nameAr}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Items table */}
            {items.length > 0 ? (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-primary text-primary-foreground">
                        <th className="px-2 py-2 text-center w-6">#</th>
                        <th className="px-2 py-2 text-center w-12">{isAr ? 'الصورة' : 'Img'}</th>
                        <th className="px-2 py-2 text-right min-w-[100px]">{isAr ? 'الاسم' : 'Name'}</th>
                        <th className="px-2 py-2 text-right min-w-[100px]">{isAr ? 'الوصف' : 'Description'}</th>
                        <th className="px-2 py-2 text-right min-w-[80px]">{isAr ? 'القسم' : 'Section'}</th>
                        <th className="px-2 py-2 text-center w-14">{isAr ? 'الكمية' : 'Qty'}</th>
                        <th className="px-2 py-2 text-center w-16">{isAr ? 'الحجم' : 'Size'}</th>
                        <th className="px-2 py-2 text-center w-20">{isAr ? 'السعر' : 'Price'}</th>
                        <th className="px-2 py-2 text-center w-20">{isAr ? 'الإجمالي' : 'Total'}</th>
                        <th className="px-1 py-2 w-6"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-2 py-1.5 text-center text-muted-foreground font-medium">{idx + 1}</td>
                          <td className="px-1 py-1 text-center">
                            <ItemImgCell
                              image={it.plantImage}
                              alt={it.plantNameAr}
                              onUpload={url => updateItem(idx, { plantImage: url })}
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="text" value={it.plantNameAr}
                              onChange={e => updateItem(idx, { plantNameAr: e.target.value })}
                              dir="rtl" placeholder={isAr ? 'الاسم...' : 'Name...'}
                              className="w-full px-2 py-1 text-xs arabic rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="text" value={it.plantNameEn}
                              onChange={e => updateItem(idx, { plantNameEn: e.target.value })}
                              placeholder="Description..."
                              className="w-full px-2 py-1 text-xs rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="text" value={it.sectionNameAr}
                              onChange={e => updateItem(idx, { sectionNameAr: e.target.value })}
                              dir="rtl" placeholder={isAr ? 'القسم...' : 'Section...'}
                              className="w-full px-2 py-1 text-xs arabic rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="number" min="1" value={it.quantity}
                              onChange={e => updateItem(idx, { quantity: Math.max(1, Number(e.target.value)) })}
                              className="w-full px-1 py-1 text-xs text-center rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="text" value={it.size || ''}
                              onChange={e => updateItem(idx, { size: e.target.value })}
                              dir="rtl" placeholder="-"
                              className="w-full px-1 py-1 text-xs text-center arabic rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          </td>
                          <td className="px-1 py-1">
                            <input
                              type="number" min="0" step="0.01"
                              value={it.price || ''}
                              onChange={e => updateItem(idx, { price: Number(e.target.value) })}
                              placeholder="0"
                              className="w-full px-1 py-1 text-xs text-center rounded border border-border bg-background outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          </td>
                          <td className="px-1 py-1 text-center font-bold text-primary text-xs">
                            {fmt((it.price || 0) * it.quantity)}
                          </td>
                          <td className="px-1 py-1">
                            <button
                              onClick={() => removeItem(idx)}
                              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors mx-auto"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <FilePlus className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm arabic text-muted-foreground">{isAr ? 'ابحث عن نبات أو أضف بنداً مخصصاً' : 'Search a plant or add a custom item'}</p>
              </div>
            )}
          </div>

          {/* Fees & pricing */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs font-bold arabic text-muted-foreground mb-1">{isAr ? 'الخصم %' : 'Discount %'}</p>
              <input
                type="number" min="0" max="100" step="0.1"
                value={discount || ''}
                onChange={e => setDiscount(Number(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2 text-sm text-center rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <p className="text-xs font-bold arabic text-muted-foreground mb-1">{isAr ? 'الضريبة %' : 'Tax %'}</p>
              <input
                type="number" min="0" max="100" step="0.1"
                value={tax || ''}
                onChange={e => setTax(Number(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2 text-sm text-center rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <p className="text-xs font-bold arabic text-muted-foreground mb-1">{isAr ? 'رسوم الشحن' : 'Shipping Fee'}</p>
              <input
                type="number" min="0" step="0.01"
                value={shippingFee || ''}
                onChange={e => setShippingFee(Number(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2 text-sm text-center rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <p className="text-xs font-bold arabic text-muted-foreground mb-1">{isAr ? 'رسوم الزراعة' : 'Planting Fee'}</p>
              <input
                type="number" min="0" step="0.01"
                value={plantingFee || ''}
                onChange={e => setPlantingFee(Number(e.target.value))}
                placeholder="0"
                className="w-full px-3 py-2 text-sm text-center rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Shipping method */}
          <div className="space-y-2">
            <p className="text-xs font-bold arabic text-muted-foreground">{isAr ? 'طريقة التوصيل' : 'Delivery Method'}</p>
            <div className="flex flex-wrap gap-2">
              {([
                { value: 'pickup', label: isAr ? '🏪 استلام من المشتل' : '🏪 Pickup' },
                { value: 'delivery', label: isAr ? '🚗 توصيل' : '🚗 Delivery' },
                { value: 'delivery_free', label: isAr ? '🚗 توصيل مجاني' : '🚗 Free Delivery' },
                { value: 'delivery_plant', label: isAr ? '🌱 شحن وزراعة' : '🌱 Ship & Plant' },
              ] as { value: string; label: string }[]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setShippingMethod(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs arabic font-medium border transition-colors ${shippingMethod === opt.value ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {shippingMethod !== 'pickup' && (
              <input
                type="text" value={shippingAddress}
                onChange={e => setShippingAddress(e.target.value)}
                dir="rtl"
                placeholder={isAr ? 'عنوان التوصيل...' : 'Delivery address...'}
                className="w-full px-3 py-2 text-sm arabic rounded-lg border border-border bg-background outline-none focus:ring-2 focus:ring-primary/30"
              />
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-bold arabic text-muted-foreground mb-1">{isAr ? 'ملاحظات' : 'Notes'}</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3} dir="rtl"
              placeholder={isAr ? 'ملاحظات للعرض...' : 'Notes for the quote...'}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm arabic text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Grand total preview */}
          {items.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground arabic">
                <span>{isAr ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
                <span dir="ltr">{fmt(subtotal)} د.أ</span>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between text-xs text-red-600 arabic">
                  <span>{isAr ? `خصم ${discount}%:` : `Discount ${discount}%:`}</span>
                  <span dir="ltr">— {fmt(discountAmt)} د.أ</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-600 arabic">
                  <span>{isAr ? `ضريبة ${tax}%:` : `Tax ${tax}%:`}</span>
                  <span dir="ltr">+ {fmt(taxAmt)} د.أ</span>
                </div>
              )}
              {shippingFee > 0 && (
                <div className="flex items-center justify-between text-xs text-blue-600 arabic">
                  <span>{isAr ? 'رسوم شحن:' : 'Shipping:'}</span>
                  <span dir="ltr">+ {fmt(shippingFee)} د.أ</span>
                </div>
              )}
              {plantingFee > 0 && (
                <div className="flex items-center justify-between text-xs text-orange-600 arabic">
                  <span>{isAr ? 'رسوم زراعة:' : 'Planting:'}</span>
                  <span dir="ltr">+ {fmt(plantingFee)} د.أ</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm font-bold arabic text-primary pt-1 border-t border-primary/20">
                <span>{isAr ? 'الإجمالي الكلي:' : 'Grand Total:'}</span>
                <span dir="ltr">{fmt(grand)} د.أ</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm arabic font-medium border border-border hover:bg-muted transition-colors"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !customerName.trim() || items.length === 0}
            className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm arabic font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {isAr ? 'حفظ عرض السعر' : 'Save Quote'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Experience Certificate Modal ──────────────────────── */
function CertificateModal({ open, onClose, lang, logoUrl }: { open: boolean; onClose: () => void; lang: string; logoUrl: string }) {
  const isAr = lang === 'ar';
  const today = new Date().toLocaleDateString('ar-JO');
  const [form, setForm] = useState({ employeeName: '', nationalId: '', jobTitle: '', startDate: '', endDate: '', issueDate: today, phone: '+962 777 772 211' });
  const [generating, setGenerating] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleGenerate = async () => {
    if (!form.employeeName.trim() || !form.jobTitle.trim() || !form.startDate.trim() || !form.endDate.trim()) {
      toast.error(isAr ? 'يرجى تعبئة جميع الحقول' : 'Please fill in all fields');
      return;
    }
    setGenerating(true);
    await downloadCertificatePDF({ ...form, logoUrl });
    setGenerating(false);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold arabic text-foreground">{isAr ? 'شهادة خبرة' : 'Experience Certificate'}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* decorative preview hint */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 px-4 py-3 text-xs arabic text-amber-800 dark:text-amber-300 leading-relaxed text-right" dir="rtl">
            ستصدر الشهادة بترويسة المؤسسة مع اللوجو والختم تلقائياً · أدخل بيانات الموظف ثم اضغط <strong>توليد PDF</strong>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className="arabic text-xs mb-1.5 block text-right" dir="rtl">اسم الموظف *</Label>
              <Input value={form.employeeName} onChange={set('employeeName')} dir="rtl" className="arabic text-right" placeholder="الاسم الرباعي..." />
            </div>
            <div>
              <Label className="arabic text-xs mb-1.5 block text-right" dir="rtl">الرقم الوطني</Label>
              <Input value={form.nationalId} onChange={set('nationalId')} dir="ltr" className="text-left" placeholder="xxxxxxxxxx (اختياري)" />
            </div>
            <div>
              <Label className="arabic text-xs mb-1.5 block text-right" dir="rtl">المسمى الوظيفي *</Label>
              <Input value={form.jobTitle} onChange={set('jobTitle')} dir="rtl" className="arabic text-right" placeholder="عامل / مشرف / محاسب..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="arabic text-xs mb-1.5 block text-right" dir="rtl">تاريخ البداية *</Label>
                <Input value={form.startDate} onChange={set('startDate')} dir="rtl" className="arabic text-right" placeholder="1/1/2022" />
              </div>
              <div>
                <Label className="arabic text-xs mb-1.5 block text-right" dir="rtl">تاريخ النهاية *</Label>
                <Input value={form.endDate} onChange={set('endDate')} dir="rtl" className="arabic text-right" placeholder="31/12/2024" />
              </div>
            </div>
            <div>
              <Label className="arabic text-xs mb-1.5 block text-right" dir="rtl">تاريخ إصدار الشهادة</Label>
              <Input value={form.issueDate} onChange={set('issueDate')} dir="rtl" className="arabic text-right" />
            </div>
            <div>
              <Label className="arabic text-xs mb-1.5 block text-right" dir="rtl">رقم الهاتف في الشهادة</Label>
              <Input value={form.phone} onChange={set('phone')} dir="ltr" className="text-left" placeholder="+962 777 772 211" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0">
          <Button onClick={handleGenerate} disabled={generating} className="w-full arabic gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {isAr ? 'توليد PDF' : 'Generate PDF'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Admin Invoices Modal ───────────────────────────────── */
function AdminInvoicesModal({ open, onClose, lang, siteData, onSessionExpired }: {
  open: boolean; onClose: () => void; lang: string;
  siteData: { titleAr: string; titleEn: string; logo: { customUrl: string }; footer: { phone?: string; email?: string; website?: string } };
  onSessionExpired?: () => void;
}) {
  const isAr = lang === 'ar';
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pdfingId, setPdfingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [tab, setTab] = useState<'receivable' | 'paid' | 'online'>('receivable');
  const [editingInv, setEditingInv] = useState<Invoice | null>(null);
  const [editDraft, setEditDraft] = useState<{ customerName: string; date: string; items: InvoiceItem[]; notes: string; status: 'paid' | 'receivable' | 'online'; discount: number; invoiceNumber: string }>({ customerName: '', date: '', items: [], notes: '', status: 'receivable', discount: 0, invoiceNumber: '' });
  const [saving, setSaving] = useState(false);

  const emptyItem = (): InvoiceItem => ({ description: '', quantity: 1, unitPrice: 0 });
  const [draft, setDraft] = useState<{ customerName: string; date: string; items: InvoiceItem[]; notes: string; status: 'paid' | 'receivable' | 'online'; discount: number; invoiceNumber: string }>({
    customerName: '', date: new Date().toISOString().slice(0, 10), items: [emptyItem()], notes: '', status: 'receivable', discount: 0, invoiceNumber: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const inv = await fetchInvoices();
    if (inv !== null) setInvoices(inv);
    setLoading(false);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const resetDraft = () => setDraft({ customerName: '', date: new Date().toISOString().slice(0, 10), items: [emptyItem()], notes: '', status: 'receivable', discount: 0, invoiceNumber: '' });

  const subtotalDraft = draft.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const total = Math.max(0, subtotalDraft - (draft.discount || 0));

  const handleCreate = async () => {
    if (!draft.customerName.trim()) { toast.error(isAr ? 'أدخل اسم المطلوب منه' : 'Enter customer name'); return; }
    if (draft.items.some(it => !it.description.trim())) { toast.error(isAr ? 'أدخل وصف جميع الأصناف' : 'Enter description for all items'); return; }
    setCreating(true);
    const result = await createInvoice({ customerName: draft.customerName, date: draft.date, items: draft.items, notes: draft.notes, status: draft.status, discount: draft.discount || 0, invoiceNumber: draft.invoiceNumber.trim() || undefined });
    const successResult = (result !== null && result !== undefined && typeof result === 'object' && 'id' in result) ? result as {id:string;number:string} : null;
    const errorResult  = (result !== null && result !== undefined && typeof result === 'object' && 'error' in result) ? result as {error:string} : null;
    if (successResult) {
      toast.success(isAr ? `تم إنشاء الفاتورة رقم ${successResult.number}` : `Invoice No. ${successResult.number} created`);
      resetDraft();
      setView('list');
      await load();
    } else if (errorResult) {
      toast.error(`فشل: ${errorResult.error}`, { duration: 8000 });
    } else {
      const stillValid = await validateToken();
      if (!stillValid) {
        setSessionToken(null);
        onSessionExpired?.();
        toast.error(isAr ? 'انتهت جلسة الدخول — سجّل الدخول مجدداً' : 'Session expired — please log in again', { duration: 5000 });
      } else {
        toast.error(isAr ? 'فشل إنشاء الفاتورة — حاول مرة أخرى' : 'Failed to create invoice — please try again');
      }
    }
    setCreating(false);
  };

  const handleDownloadPDF = async (inv: Invoice) => {
    setPdfingId(inv.id);
    // Re-fetch the latest invoices before generating the PDF so a status
    // change made moments earlier (toggle/edit) can never be missed due to
    // stale local state.
    const latest = await fetchInvoices();
    const fresh = latest?.find(i => i.id === inv.id) ?? inv;
    if (latest !== null) setInvoices(latest);
    await downloadInvoicePDF(fresh, siteData);
    setPdfingId(null);
  };

  const handleSetStatus = async (inv: Invoice, nextStatus: 'receivable' | 'paid' | 'online') => {
    if (inv.status === nextStatus) return;
    setTogglingId(inv.id);
    const ok = await updateInvoiceStatus(inv.id, nextStatus);
    if (ok) {
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: nextStatus } : i));
      const labels: Record<string, string> = { paid: 'مدفوع', receivable: 'ذمم', online: 'أونلاين' };
      toast.success(isAr ? `تم تحديد الفاتورة كـ${labels[nextStatus]}` : `Marked as ${nextStatus}`);
    } else {
      toast.error(isAr ? 'فشل تغيير الحالة — حاول مجدداً' : 'Failed to change status — please try again');
    }
    setTogglingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(isAr ? 'حذف الفاتورة؟' : 'Delete this invoice?')) return;
    setDeletingId(id);
    await deleteInvoice(id);
    setInvoices(prev => prev.filter(i => i.id !== id));
    setDeletingId(null);
    toast.success(isAr ? 'تم الحذف' : 'Deleted');
  };

  const handleOpenEdit = (inv: Invoice) => {
    setEditingInv(inv);
    setEditDraft({
      customerName: inv.customer_name,
      date: inv.date ?? new Date().toISOString().slice(0, 10),
      items: (inv.items as InvoiceItem[]).map(it => ({ ...it })),
      notes: inv.notes ?? '',
      status: (inv.status ?? 'receivable') as 'paid' | 'receivable' | 'online',
      discount: Number(inv.discount) || 0,
      invoiceNumber: inv.number ?? '',
    });
    setView('edit');
  };

  const handleSaveEdit = async () => {
    if (!editingInv) return;
    if (!editDraft.customerName.trim()) { toast.error(isAr ? 'أدخل اسم المطلوب منه' : 'Enter customer name'); return; }
    if (editDraft.items.some(it => !it.description.trim())) { toast.error(isAr ? 'أدخل وصف جميع الأصناف' : 'Enter description for all items'); return; }
    setSaving(true);
    const ok = await updateInvoice(editingInv.id, {
      number: editDraft.invoiceNumber.trim() || editingInv.number,
      discount: editDraft.discount || 0,
      customerName: editDraft.customerName,
      date: editDraft.date,
      items: editDraft.items,
      notes: editDraft.notes,
      status: editDraft.status,
    });
    if (ok) {
      toast.success(isAr ? 'تم حفظ التعديلات' : 'Changes saved');
      setView('list');
      setEditingInv(null);
      await load();
    } else {
      toast.error(isAr ? 'فشل الحفظ — حاول مجدداً' : 'Save failed — please try again');
    }
    setSaving(false);
  };

  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    const items = draft.items.map((it, i) => i === idx ? { ...it, [field]: value } : it);
    setDraft({ ...draft, items });
  };

  const updateEditItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    const items = editDraft.items.map((it, i) => i === idx ? { ...it, [field]: value } : it);
    setEditDraft({ ...editDraft, items });
  };

  const addItem = () => setDraft({ ...draft, items: [...draft.items, emptyItem()] });
  const removeItem = (idx: number) => {
    if (draft.items.length === 1) return;
    setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) });
  };

  const addEditItem = () => setEditDraft({ ...editDraft, items: [...editDraft.items, emptyItem()] });
  const removeEditItem = (idx: number) => {
    if (editDraft.items.length === 1) return;
    setEditDraft({ ...editDraft, items: editDraft.items.filter((_, i) => i !== idx) });
  };

  const filteredInvoices = invoices.filter(inv => (inv.status ?? 'receivable') === tab);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold arabic text-foreground">{isAr ? 'الفواتير' : 'Invoices'}</h2>
          </div>
          <div className="flex items-center gap-2">
            {view === 'list' && (
              <Button size="sm" onClick={() => { resetDraft(); setView('create'); }} className="arabic text-xs">
                <Plus className="w-3.5 h-3.5 me-1" />{isAr ? 'فاتورة جديدة' : 'New Invoice'}
              </Button>
            )}
            {(view === 'create' || view === 'edit') && (
              <button onClick={() => { setView('list'); setEditingInv(null); }} className="text-xs arabic text-muted-foreground hover:text-foreground transition-colors">
                {isAr ? '← العودة' : '← Back'}
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Create form */}
        {view === 'create' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <Label className="arabic text-xs mb-1.5 block">{isAr ? 'المطلوب منه' : 'Customer Name'} *</Label>
                <Input
                  value={draft.customerName}
                  onChange={e => setDraft({ ...draft, customerName: e.target.value })}
                  placeholder={isAr ? 'اسم المطلوب منه...' : 'Customer name...'}
                  dir="rtl" className="arabic"
                />
              </div>
              <div>
                <Label className="arabic text-xs mb-1.5 block">{isAr ? 'التاريخ' : 'Date'}</Label>
                <Input
                  type="date"
                  value={draft.date}
                  onChange={e => setDraft({ ...draft, date: e.target.value })}
                  dir="ltr"
                />
              </div>
              <div>
                <Label className="arabic text-xs mb-1.5 block">{isAr ? 'رقم الفاتورة (اختياري)' : 'Invoice No. (optional)'}</Label>
                <Input
                  value={draft.invoiceNumber}
                  onChange={e => setDraft({ ...draft, invoiceNumber: e.target.value })}
                  placeholder={isAr ? 'تلقائي إذا تُرك فارغاً...' : 'Auto if left empty...'}
                  dir="ltr"
                />
              </div>
              <div>
                <Label className="arabic text-xs mb-1.5 block">{isAr ? 'الخصم (د.أ)' : 'Discount (JD)'}</Label>
                <Input
                  type="number" min={0} step={0.001}
                  value={draft.discount || ''}
                  onChange={e => setDraft({ ...draft, discount: Number(e.target.value) })}
                  placeholder="0.000" dir="ltr"
                />
              </div>
            </div>

            {/* Status selector */}
            <div>
              <Label className="arabic text-xs mb-2 block">{isAr ? 'نوع الفاتورة' : 'Invoice Type'}</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, status: 'receivable' })}
                  className={`py-2.5 rounded-xl border-2 text-sm font-bold arabic transition-all ${draft.status === 'receivable' ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' : 'border-border text-muted-foreground hover:border-amber-300'}`}
                >
                  {isAr ? '⏳ ذمم' : '⏳ Receivable'}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, status: 'paid' })}
                  className={`py-2.5 rounded-xl border-2 text-sm font-bold arabic transition-all ${draft.status === 'paid' ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'border-border text-muted-foreground hover:border-green-300'}`}
                >
                  {isAr ? '✅ مدفوع' : '✅ Paid'}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, status: 'online' })}
                  className={`py-2.5 rounded-xl border-2 text-sm font-bold arabic transition-all ${draft.status === 'online' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' : 'border-border text-muted-foreground hover:border-blue-300'}`}
                >
                  {isAr ? '🌐 أونلاين' : '🌐 Online'}
                </button>
              </div>
            </div>

            {/* Items table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
                <p className="text-xs font-bold arabic text-foreground/70">{isAr ? 'الأصناف' : 'Items'}</p>
                <button onClick={addItem} className="flex items-center gap-1 text-xs text-primary hover:underline arabic font-medium">
                  <Plus className="w-3 h-3" />{isAr ? 'إضافة صنف' : 'Add item'}
                </button>
              </div>
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-muted/30 border-b border-border text-[10px] font-bold text-muted-foreground arabic">
                <div className="col-span-5 text-right">{isAr ? 'البيان' : 'Description'}</div>
                <div className="col-span-2 text-center">{isAr ? 'الوحدة' : 'Qty'}</div>
                <div className="col-span-3 text-center">{isAr ? 'السعر الافرادي (د.أ)' : 'Unit Price (JD)'}</div>
                <div className="col-span-2 text-center">{isAr ? 'الإجمالي' : 'Total'}</div>
              </div>
              <div className="divide-y divide-border">
                {draft.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                    <div className="col-span-5">
                      <Input value={it.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder={isAr ? 'اسم الصنف...' : 'Item description...'} dir="rtl" className="arabic h-8 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" min={1} step={1} value={it.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="h-8 text-center text-sm" dir="ltr" />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" min={0} step={0.001} value={it.unitPrice || ''} placeholder="0.000" onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} className="h-8 text-center text-sm" dir="ltr" />
                    </div>
                    <div className="col-span-2 flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-green-600 arabic">{(it.quantity * it.unitPrice).toFixed(3)}</span>
                      <button onClick={() => removeItem(idx)} disabled={draft.items.length === 1} className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 transition-colors shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 bg-muted/50 border-t border-border space-y-1">
                {draft.discount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground arabic">{isAr ? 'المجموع قبل الخصم' : 'Subtotal'}</span>
                    <span className="text-sm arabic text-foreground">{subtotalDraft.toFixed(3)} {isAr ? 'د.أ' : 'JD'}</span>
                  </div>
                )}
                {draft.discount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-red-600 arabic">— {isAr ? 'خصم' : 'Discount'}</span>
                    <span className="text-sm text-red-600 arabic">−{(draft.discount).toFixed(3)} {isAr ? 'د.أ' : 'JD'}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold arabic text-foreground">{isAr ? 'الإجمالي الكلي' : 'Grand Total'}</span>
                  <span className="text-base font-extrabold text-primary arabic">{total.toFixed(3)} {isAr ? 'د.أ' : 'JD'}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="arabic text-xs mb-1.5 block">{isAr ? 'ملاحظات' : 'Notes'}</Label>
              <textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} rows={2} dir="rtl" placeholder={isAr ? 'ملاحظات اختيارية...' : 'Optional notes...'} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm arabic text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>

            <Button onClick={handleCreate} disabled={creating} className="w-full arabic">
              {creating ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <FileText className="w-4 h-4 me-2" />}
              {isAr ? 'حفظ الفاتورة' : 'Save Invoice'}
            </Button>
          </div>
        )}

        {/* Edit form */}
        {view === 'edit' && editingInv && (() => {
          const editSubtotal = editDraft.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
          const editTotal = Math.max(0, editSubtotal - (editDraft.discount || 0));
          return (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="flex items-center gap-2 pb-1 border-b border-border">
                <span className="text-xs font-mono font-bold text-primary">#{editingInv.number}</span>
                <span className="text-xs text-muted-foreground arabic">{isAr ? 'تعديل الفاتورة' : 'Edit Invoice'}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <Label className="arabic text-xs mb-1.5 block">{isAr ? 'المطلوب منه' : 'Customer Name'} *</Label>
                  <Input value={editDraft.customerName} onChange={e => setEditDraft({ ...editDraft, customerName: e.target.value })} dir="rtl" className="arabic" />
                </div>
                <div>
                  <Label className="arabic text-xs mb-1.5 block">{isAr ? 'التاريخ' : 'Date'}</Label>
                  <Input type="date" value={editDraft.date} onChange={e => setEditDraft({ ...editDraft, date: e.target.value })} dir="ltr" />
                </div>
                <div>
                  <Label className="arabic text-xs mb-1.5 block">{isAr ? 'رقم الفاتورة' : 'Invoice No.'}</Label>
                  <Input value={editDraft.invoiceNumber} onChange={e => setEditDraft({ ...editDraft, invoiceNumber: e.target.value })} dir="ltr" />
                </div>
                <div>
                  <Label className="arabic text-xs mb-1.5 block">{isAr ? 'الخصم (د.أ)' : 'Discount (JD)'}</Label>
                  <Input type="number" min={0} step={0.001} value={editDraft.discount || ''} onChange={e => setEditDraft({ ...editDraft, discount: Number(e.target.value) })} placeholder="0.000" dir="ltr" />
                </div>
              </div>
              <div>
                <Label className="arabic text-xs mb-2 block">{isAr ? 'نوع الفاتورة' : 'Invoice Type'}</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setEditDraft({ ...editDraft, status: 'receivable' })} className={`py-2.5 rounded-xl border-2 text-sm font-bold arabic transition-all ${editDraft.status === 'receivable' ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' : 'border-border text-muted-foreground hover:border-amber-300'}`}>
                    {isAr ? '⏳ ذمم' : '⏳ Receivable'}
                  </button>
                  <button type="button" onClick={() => setEditDraft({ ...editDraft, status: 'paid' })} className={`py-2.5 rounded-xl border-2 text-sm font-bold arabic transition-all ${editDraft.status === 'paid' ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'border-border text-muted-foreground hover:border-green-300'}`}>
                    {isAr ? '✅ مدفوع' : '✅ Paid'}
                  </button>
                  <button type="button" onClick={() => setEditDraft({ ...editDraft, status: 'online' })} className={`py-2.5 rounded-xl border-2 text-sm font-bold arabic transition-all ${editDraft.status === 'online' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' : 'border-border text-muted-foreground hover:border-blue-300'}`}>
                    {isAr ? '🌐 أونلاين' : '🌐 Online'}
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
                  <p className="text-xs font-bold arabic text-foreground/70">{isAr ? 'الأصناف' : 'Items'}</p>
                  <button onClick={addEditItem} className="flex items-center gap-1 text-xs text-primary hover:underline arabic font-medium">
                    <Plus className="w-3 h-3" />{isAr ? 'إضافة صنف' : 'Add item'}
                  </button>
                </div>
                <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-muted/30 border-b border-border text-[10px] font-bold text-muted-foreground arabic">
                  <div className="col-span-5 text-right">{isAr ? 'البيان' : 'Description'}</div>
                  <div className="col-span-2 text-center">{isAr ? 'الوحدة' : 'Qty'}</div>
                  <div className="col-span-3 text-center">{isAr ? 'السعر (د.أ)' : 'Price (JD)'}</div>
                  <div className="col-span-2 text-center">{isAr ? 'الإجمالي' : 'Total'}</div>
                </div>
                <div className="divide-y divide-border">
                  {editDraft.items.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                      <div className="col-span-5">
                        <Input value={it.description} onChange={e => updateEditItem(idx, 'description', e.target.value)} dir="rtl" className="arabic text-xs h-8" placeholder={isAr ? 'البيان...' : 'Item...'} />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" min={1} value={it.quantity} onChange={e => updateEditItem(idx, 'quantity', Number(e.target.value))} className="text-center text-xs h-8" />
                      </div>
                      <div className="col-span-3">
                        <Input type="number" min={0} step={0.001} value={it.unitPrice || ''} onChange={e => updateEditItem(idx, 'unitPrice', Number(e.target.value))} className="text-center text-xs h-8" placeholder="0.000" />
                      </div>
                      <div className="col-span-2 flex items-center justify-between gap-1">
                        <span className="text-xs text-center flex-1 font-mono">{(it.quantity * it.unitPrice).toFixed(3)}</span>
                        <button onClick={() => removeEditItem(idx)} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 bg-muted/50 border-t border-border space-y-1">
                  {editDraft.discount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground arabic">{isAr ? 'المجموع قبل الخصم' : 'Subtotal'}</span>
                      <span className="text-sm arabic">{editSubtotal.toFixed(3)} {isAr ? 'د.أ' : 'JD'}</span>
                    </div>
                  )}
                  {editDraft.discount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-red-600 arabic">— {isAr ? 'خصم' : 'Discount'}</span>
                      <span className="text-sm text-red-600 arabic">−{editDraft.discount.toFixed(3)} {isAr ? 'د.أ' : 'JD'}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold arabic text-foreground">{isAr ? 'الإجمالي الكلي' : 'Grand Total'}</span>
                    <span className="text-base font-extrabold text-primary arabic">{editTotal.toFixed(3)} {isAr ? 'د.أ' : 'JD'}</span>
                  </div>
                </div>
              </div>
              <div>
                <Label className="arabic text-xs mb-1.5 block">{isAr ? 'ملاحظات' : 'Notes'}</Label>
                <textarea value={editDraft.notes} onChange={e => setEditDraft({ ...editDraft, notes: e.target.value })} rows={2} dir="rtl" placeholder={isAr ? 'ملاحظات اختيارية...' : 'Optional notes...'} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm arabic text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <Button onClick={handleSaveEdit} disabled={saving} className="w-full arabic">
                {saving ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : <FileText className="w-4 h-4 me-2" />}
                {isAr ? 'حفظ التعديلات' : 'Save Changes'}
              </Button>
            </div>
          );
        })()}

        {/* Invoices list */}
        {view === 'list' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-border shrink-0">
              <button
                onClick={() => setTab('receivable')}
                className={`flex-1 py-3 text-sm font-bold arabic transition-colors ${tab === 'receivable' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-muted-foreground hover:text-foreground'}`}
              >
                ⏳ {isAr ? 'الذمم' : 'Receivable'}
                {invoices.filter(i => (i.status ?? 'receivable') === 'receivable').length > 0 && (
                  <span className="ms-1.5 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 rounded-full px-1.5 py-0.5">
                    {invoices.filter(i => (i.status ?? 'receivable') === 'receivable').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab('paid')}
                className={`flex-1 py-3 text-sm font-bold arabic transition-colors ${tab === 'paid' ? 'text-green-600 border-b-2 border-green-500' : 'text-muted-foreground hover:text-foreground'}`}
              >
                ✅ {isAr ? 'المدفوعة' : 'Paid'}
                {invoices.filter(i => i.status === 'paid').length > 0 && (
                  <span className="ms-1.5 text-[10px] bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400 rounded-full px-1.5 py-0.5">
                    {invoices.filter(i => i.status === 'paid').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab('online')}
                className={`flex-1 py-3 text-sm font-bold arabic transition-colors ${tab === 'online' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-muted-foreground hover:text-foreground'}`}
              >
                🌐 {isAr ? 'أونلاين' : 'Online'}
                {invoices.filter(i => i.status === 'online').length > 0 && (
                  <span className="ms-1.5 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 rounded-full px-1.5 py-0.5">
                    {invoices.filter(i => i.status === 'online').length}
                  </span>
                )}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                  <FileText className="w-10 h-10 opacity-30" />
                  <p className="text-sm arabic">{isAr ? (tab === 'receivable' ? 'لا توجد ذمم' : tab === 'paid' ? 'لا توجد فواتير مدفوعة' : 'لا توجد فواتير أونلاين') : (tab === 'receivable' ? 'No receivables' : tab === 'paid' ? 'No paid invoices' : 'No online invoices')}</p>
                  {tab === 'receivable' && (
                    <Button size="sm" variant="outline" onClick={() => { resetDraft(); setView('create'); }} className="arabic text-xs">
                      <Plus className="w-3.5 h-3.5 me-1" />{isAr ? 'إنشاء فاتورة' : 'Create invoice'}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredInvoices.map(inv => {
                    const invSubtotal = (inv.items as InvoiceItem[]).reduce((s, it) => s + it.quantity * it.unitPrice, 0);
                    const invDiscount = Number(inv.discount) || 0;
                    const invTotal = Math.max(0, invSubtotal - invDiscount);
                    const isPaid = inv.status === 'paid';
                    const isOnline = inv.status === 'online';
                    const statusColor = isPaid ? 'bg-green-100 dark:bg-green-950/30' : isOnline ? 'bg-blue-100 dark:bg-blue-950/30' : 'bg-amber-100 dark:bg-amber-950/30';
                    const iconColor = isPaid ? 'text-green-600' : isOnline ? 'text-blue-600' : 'text-amber-600';
                    return (
                      <div key={inv.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${statusColor}`}>
                          <FileText className={`w-4.5 h-4.5 ${iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-primary">#{inv.number}</span>
                            <span className="text-sm font-bold arabic text-foreground truncate">{inv.customer_name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground arabic mt-0.5">
                            {inv.date ? new Date(inv.date).toLocaleDateString(isAr ? 'ar-JO' : 'en-GB') : ''}
                            {' · '}{inv.items.length} {isAr ? 'صنف' : 'items'}
                            {invDiscount > 0 && <span className="text-red-500"> · خصم {invDiscount.toFixed(3)}</span>}
                            {' · '}<span className="font-bold text-green-600">{invTotal.toFixed(3)} {isAr ? 'د.أ' : 'JD'}</span>
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0 items-center">
                          <div className="relative">
                            <select
                              value={(inv.status ?? 'receivable') as 'paid' | 'receivable' | 'online'}
                              onChange={e => handleSetStatus(inv, e.target.value as 'paid' | 'receivable' | 'online')}
                              disabled={togglingId === inv.id}
                              title={isAr ? 'تغيير الحالة' : 'Change status'}
                              className={`appearance-none px-2.5 py-1 pe-5 rounded-lg text-[11px] font-bold arabic transition-all border cursor-pointer ${isPaid ? 'border-green-300 text-green-700 bg-green-50 dark:bg-green-950/20 dark:text-green-400' : isOnline ? 'border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400' : 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400'}`}
                            >
                              <option value="receivable">{isAr ? 'ذمم' : 'Due'}</option>
                              <option value="paid">{isAr ? 'مدفوع' : 'Paid'}</option>
                              <option value="online">{isAr ? 'أونلاين' : 'Online'}</option>
                            </select>
                            {togglingId === inv.id && (
                              <Loader2 className="w-3 h-3 animate-spin absolute inset-y-0 my-auto end-1.5 pointer-events-none" />
                            )}
                          </div>
                          <button onClick={() => handleOpenEdit(inv)} title={isAr ? 'تعديل' : 'Edit'} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(inv)} disabled={pdfingId === inv.id} className="arabic text-xs h-7 px-2">
                            {pdfingId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><FileDown className="w-3.5 h-3.5 me-1" />PDF</>}
                          </Button>
                          <button onClick={() => handleDelete(inv.id)} disabled={deletingId === inv.id} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            {deletingId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          {/* ── Online invoices summary bar ────────────────────── */}
          {tab === 'online' && filteredInvoices.length > 0 && (() => {
            const onlineTotal = filteredInvoices.reduce((sum, inv) => {
              const sub = (inv.items as InvoiceItem[]).reduce((s, it) => s + it.quantity * it.unitPrice, 0);
              return sum + Math.max(0, sub - (Number(inv.discount) || 0));
            }, 0);
            const onlineTotalNoDelivery = filteredInvoices.reduce((sum, inv) => {
              const sub = (inv.items as InvoiceItem[])
                .filter(it => !/توصيل|delivery/i.test(it.description))
                .reduce((s, it) => s + it.quantity * it.unitPrice, 0);
              return sum + Math.max(0, sub - (Number(inv.discount) || 0));
            }, 0);
            return (
              <div className="shrink-0 border-t border-blue-100 dark:border-blue-900/40 bg-blue-50/80 dark:bg-blue-950/20 px-4 py-3 flex flex-wrap gap-3 justify-between items-center">
                <div className="flex flex-col items-center flex-1 min-w-[120px]">
                  <span className="text-[10px] text-blue-500 dark:text-blue-400 arabic font-medium mb-0.5">مجموع المبيعات</span>
                  <span className="text-base font-bold text-blue-700 dark:text-blue-300 arabic tabular-nums">{onlineTotal.toFixed(3)} <span className="text-xs font-semibold">د.أ</span></span>
                </div>
                <div className="w-px h-8 bg-blue-200 dark:bg-blue-800 shrink-0" />
                <div className="flex flex-col items-center flex-1 min-w-[120px]">
                  <span className="text-[10px] text-blue-500 dark:text-blue-400 arabic font-medium mb-0.5 text-center">مجموع المبيعات دون رسوم توصيل</span>
                  <span className="text-base font-bold text-blue-700 dark:text-blue-300 arabic tabular-nums">{onlineTotalNoDelivery.toFixed(3)} <span className="text-xs font-semibold">د.أ</span></span>
                </div>
              </div>
            );
          })()}

          </div>
        )}
      </div>
    </div>
  );
}

/* ── Receipt Form (standalone — must NOT be defined inside modal) ─── */
type ReceiptDraft = {
  receivedFrom: string; namePrefix: string; amount: number; amountText: string;
  description: string; paymentMethod: 'cash' | 'check' | 'transfer' | 'online';
  date: string; notes: string; receiptNumber: string;
};

function ReceiptForm({ d, setD, onSubmit, submitting, submitLabel, isAr }: {
  d: ReceiptDraft;
  setD: React.Dispatch<React.SetStateAction<ReceiptDraft>>;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  isAr: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs arabic">{isAr ? 'رقم السند' : 'Receipt No.'}</Label>
          <Input className="arabic text-sm" placeholder={isAr ? 'تلقائي' : 'Auto'} value={d.receiptNumber} onChange={e => setD(p => ({ ...p, receiptNumber: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs arabic">{isAr ? 'التاريخ' : 'Date'}</Label>
          <Input type="date" className="text-sm" value={d.date} onChange={e => setD(p => ({ ...p, date: e.target.value }))} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs arabic">{isAr ? 'اللقب' : 'Title'}</Label>
        <select className="arabic text-sm border border-input rounded-md px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" value={['السيد','السيدة','السادة','أخرى'].includes(d.namePrefix) ? d.namePrefix : 'أخرى'} onChange={e => setD(p => ({ ...p, namePrefix: e.target.value === 'أخرى' ? '' : e.target.value }))}>
          <option value="السيد">السيد</option>
          <option value="السيدة">السيدة</option>
          <option value="السادة">السادة</option>
          <option value="أخرى">أخرى (أكتب بنفسك)</option>
        </select>
        {!['السيد','السيدة','السادة'].includes(d.namePrefix) && (
          <Input className="arabic text-sm mt-1" placeholder="اكتب اللقب..." value={d.namePrefix} onChange={e => setD(p => ({ ...p, namePrefix: e.target.value }))} />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs arabic">{isAr ? 'الاسم *' : 'Name *'}</Label>
        <Input className="arabic text-sm" placeholder={isAr ? 'اسم الدافع' : 'Payer name'} value={d.receivedFrom} onChange={e => setD(p => ({ ...p, receivedFrom: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs arabic">{isAr ? 'المبلغ (دينار)' : 'Amount (JD)'}</Label>
          <Input type="number" step="0.001" min="0" className="text-sm" value={d.amount || ''} onChange={e => setD(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs arabic">{isAr ? 'المبلغ كتابةً' : 'Amount in Words'}</Label>
          <Input className="arabic text-sm" placeholder={isAr ? 'مثال: مئة دينار' : 'e.g. One Hundred Dinars'} value={d.amountText} onChange={e => setD(p => ({ ...p, amountText: e.target.value }))} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs arabic">{isAr ? 'وذلك عن (سبب الدفع) *' : 'Description *'}</Label>
        <Input className="arabic text-sm" placeholder={isAr ? 'سبب الدفع' : 'Reason for payment'} value={d.description} onChange={e => setD(p => ({ ...p, description: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs arabic">{isAr ? 'طريقة الدفع' : 'Payment Method'}</Label>
        <div className="flex gap-4">
          {(['cash', 'check', 'transfer', 'online'] as const).map(m => (
            <label key={m} className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="payMethod" checked={d.paymentMethod === m} onChange={() => setD(p => ({ ...p, paymentMethod: m }))} className="accent-primary" />
              <span className="text-sm arabic">{m === 'cash' ? 'نقداً' : m === 'check' ? 'شيك' : m === 'transfer' ? 'تحويل' : 'أونلاين'}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs arabic">{isAr ? 'ملاحظات' : 'Notes'}</Label>
        <Input className="arabic text-sm" placeholder={isAr ? 'ملاحظات إضافية (اختياري)' : 'Optional notes'} value={d.notes} onChange={e => setD(p => ({ ...p, notes: e.target.value }))} />
      </div>
      <Button onClick={onSubmit} disabled={submitting} className="arabic mt-1">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : <Plus className="w-4 h-4 me-1" />}
        {submitLabel}
      </Button>
    </div>
  );
}

/* ── Admin Receipts Modal (سندات القبض) ─────────────────── */
function AdminReceiptsModal({ open, onClose, lang, logoUrl, onSessionExpired }: {
  open: boolean; onClose: () => void; lang: string; logoUrl: string; onSessionExpired: () => void;
}) {
  const isAr = lang === 'ar';
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfingId, setPdfingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editingRec, setEditingRec] = useState<Receipt | null>(null);

  const emptyDraft = (): ReceiptDraft => ({
    receivedFrom: '', namePrefix: 'السيد', amount: 0, amountText: '', description: '',
    paymentMethod: 'cash',
    date: new Date().toISOString().slice(0, 10), notes: '', receiptNumber: '',
  });
  const [draft, setDraft] = useState<ReceiptDraft>(emptyDraft());
  const [editDraft, setEditDraft] = useState<ReceiptDraft>(emptyDraft());

  const handleUnauthorized = useCallback(() => {
    setSessionToken(null);
    onClose();
    onSessionExpired();
  }, [onClose, onSessionExpired]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchReceipts();
    if (data === 'unauthorized') { handleUnauthorized(); return; }
    if (data !== null) setReceipts(data);
    setLoading(false);
  }, [handleUnauthorized]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleCreate = async () => {
    if (!draft.receivedFrom.trim()) { toast.error(isAr ? 'أدخل اسم الدافع' : 'Enter payer name'); return; }
    if (!draft.description.trim()) { toast.error(isAr ? 'أدخل سبب الدفع' : 'Enter description'); return; }
    setCreating(true);
    const result = await createReceipt({ ...draft });
    if (result === 'unauthorized') { handleUnauthorized(); setCreating(false); return; }
    if (result && 'number' in result) {
      toast.success(isAr ? `تم إنشاء سند قبض رقم ${result.number}` : `Receipt No. ${result.number} created`);
      setDraft(emptyDraft());
      setView('list');
      await load();
    } else if (result && 'error' in result) {
      toast.error(`${isAr ? 'خطأ' : 'Error'}: ${result.error}`);
    } else {
      toast.error(isAr ? 'فشل في الحفظ — تحقق من الاتصال' : 'Save failed — check connection');
    }
    setCreating(false);
  };

  const handleOpenEdit = (rec: Receipt) => {
    setEditingRec(rec);
    setEditDraft({
      receivedFrom: rec.received_from, namePrefix: rec.name_prefix || 'السيد', amount: Number(rec.amount),
      amountText: rec.amount_text, description: rec.description,
      paymentMethod: rec.payment_method, date: rec.date,
      notes: rec.notes, receiptNumber: rec.number,
    });
    setView('edit');
  };

  const handleSaveEdit = async () => {
    if (!editingRec) return;
    setSaving(true);
    const ok = await updateReceipt(editingRec.id, {
      receivedFrom: editDraft.receivedFrom, namePrefix: editDraft.namePrefix, amount: editDraft.amount,
      amountText: editDraft.amountText, description: editDraft.description,
      paymentMethod: editDraft.paymentMethod, date: editDraft.date,
      notes: editDraft.notes, number: editDraft.receiptNumber,
    });
    if (ok === 'unauthorized') { handleUnauthorized(); setSaving(false); return; }
    if (ok) {
      toast.success(isAr ? 'تم الحفظ' : 'Saved');
      setView('list');
      await load();
    } else {
      toast.error(isAr ? 'فشل الحفظ' : 'Save failed');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const ok = await deleteReceipt(id);
    if (ok === 'unauthorized') { handleUnauthorized(); setDeletingId(null); return; }
    setReceipts(prev => prev.filter(r => r.id !== id));
    setDeletingId(null);
  };

  const handleDownloadPDF = async (rec: Receipt) => {
    setPdfingId(rec.id);
    await downloadReceiptPDF({
      number: rec.number, receivedFrom: rec.received_from, namePrefix: rec.name_prefix || 'السيد',
      amount: Number(rec.amount), amountText: rec.amount_text,
      description: rec.description, paymentMethod: rec.payment_method,
      date: rec.date, notes: rec.notes, logoUrl,
    });
    setPdfingId(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl shadow-2xl border border-border w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          {view !== 'list' ? (
            <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors arabic">
              <ChevronDown className="w-4 h-4 rotate-90" />
              {isAr ? 'رجوع' : 'Back'}
            </button>
          ) : <div />}
          <h2 className="text-base font-bold arabic text-center flex-1">
            {view === 'create' ? (isAr ? 'سند قبض جديد' : 'New Receipt')
              : view === 'edit' ? (isAr ? 'تعديل السند' : 'Edit Receipt')
              : (isAr ? 'سندات القبض' : 'Receipts')}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {view === 'create' && (
            <ReceiptForm d={draft} setD={setDraft} onSubmit={handleCreate} submitting={creating} submitLabel={isAr ? 'حفظ السند' : 'Save Receipt'} isAr={isAr} />
          )}

          {view === 'edit' && (
            <ReceiptForm d={editDraft} setD={setEditDraft} onSubmit={handleSaveEdit} submitting={saving} submitLabel={isAr ? 'حفظ التعديلات' : 'Save Changes'} isAr={isAr} />
          )}

          {view === 'list' && (
            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b border-border shrink-0">
                <Button size="sm" onClick={() => { setDraft(emptyDraft()); setView('create'); }} className="arabic text-xs w-full">
                  <Plus className="w-3.5 h-3.5 me-1" />{isAr ? 'سند قبض جديد' : 'New Receipt'}
                </Button>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : receipts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                  <ReceiptIcon className="w-10 h-10 opacity-30" />
                  <p className="text-sm arabic">{isAr ? 'لا توجد سندات قبض' : 'No receipts yet'}</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {receipts.map(rec => (
                    <div key={rec.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 dark:bg-blue-950/30">
                        <ReceiptIcon className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-primary">#{rec.number}</span>
                          <span className="text-sm font-bold arabic text-foreground truncate">{rec.received_from}</span>
                        </div>
                        <p className="text-xs text-muted-foreground arabic mt-0.5">
                          {rec.date ? new Date(rec.date).toLocaleDateString(isAr ? 'ar-JO' : 'en-GB') : ''}
                          {' · '}{rec.description}
                          {' · '}<span className="font-bold text-blue-600">{Number(rec.amount).toFixed(3)} {isAr ? 'د.أ' : 'JD'}</span>
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0 items-center">
                        <button onClick={() => handleOpenEdit(rec)} title={isAr ? 'تعديل' : 'Edit'} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(rec)} disabled={pdfingId === rec.id} className="arabic text-xs h-7 px-2">
                          {pdfingId === rec.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><FileDown className="w-3.5 h-3.5 me-1" />PDF</>}
                        </Button>
                        <button onClick={() => handleDelete(rec.id)} disabled={deletingId === rec.id} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          {deletingId === rec.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Disbursement Form (must NOT be defined inside modal) ── */
type DisbursementDraft = {
  paidTo: string; namePrefix: string; amount: number; amountText: string;
  description: string; paymentMethod: 'cash' | 'check' | 'transfer' | 'online';
  date: string; notes: string; disbursementNumber: string;
};

function DisbursementForm({ d, setD, onSubmit, submitting, submitLabel, isAr }: {
  d: DisbursementDraft;
  setD: React.Dispatch<React.SetStateAction<DisbursementDraft>>;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  isAr: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs arabic">{isAr ? 'رقم السند' : 'Voucher No.'}</Label>
          <Input className="arabic text-sm" placeholder={isAr ? 'تلقائي' : 'Auto'} value={d.disbursementNumber} onChange={e => setD(p => ({ ...p, disbursementNumber: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs arabic">{isAr ? 'التاريخ' : 'Date'}</Label>
          <Input type="date" className="text-sm" value={d.date} onChange={e => setD(p => ({ ...p, date: e.target.value }))} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs arabic">{isAr ? 'اللقب' : 'Title'}</Label>
        <select className="arabic text-sm border border-input rounded-md px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" value={['السيد','السيدة','السادة','أخرى'].includes(d.namePrefix) ? d.namePrefix : 'أخرى'} onChange={e => setD(p => ({ ...p, namePrefix: e.target.value === 'أخرى' ? '' : e.target.value }))}>
          <option value="السيد">السيد</option>
          <option value="السيدة">السيدة</option>
          <option value="السادة">السادة</option>
          <option value="أخرى">أخرى (أكتب بنفسك)</option>
        </select>
        {!['السيد','السيدة','السادة'].includes(d.namePrefix) && (
          <Input className="arabic text-sm mt-1" placeholder="اكتب اللقب..." value={d.namePrefix} onChange={e => setD(p => ({ ...p, namePrefix: e.target.value }))} />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs arabic">{isAr ? 'الاسم *' : 'Name *'}</Label>
        <Input className="arabic text-sm" placeholder={isAr ? 'اسم المستلم' : 'Payee name'} value={d.paidTo} onChange={e => setD(p => ({ ...p, paidTo: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs arabic">{isAr ? 'المبلغ (دينار)' : 'Amount (JD)'}</Label>
          <Input type="number" step="0.001" min="0" className="text-sm" value={d.amount || ''} onChange={e => setD(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs arabic">{isAr ? 'المبلغ كتابةً' : 'Amount in Words'}</Label>
          <Input className="arabic text-sm" placeholder={isAr ? 'مثال: مئة دينار' : 'e.g. One Hundred Dinars'} value={d.amountText} onChange={e => setD(p => ({ ...p, amountText: e.target.value }))} />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs arabic">{isAr ? 'وذلك عن (سبب الصرف) *' : 'Description *'}</Label>
        <Input className="arabic text-sm" placeholder={isAr ? 'سبب الصرف' : 'Reason for payment'} value={d.description} onChange={e => setD(p => ({ ...p, description: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs arabic">{isAr ? 'طريقة الدفع' : 'Payment Method'}</Label>
        <div className="flex gap-4">
          {(['cash', 'check', 'transfer', 'online'] as const).map(m => (
            <label key={m} className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="disPayMethod" checked={d.paymentMethod === m} onChange={() => setD(p => ({ ...p, paymentMethod: m }))} className="accent-primary" />
              <span className="text-sm arabic">{m === 'cash' ? 'نقداً' : m === 'check' ? 'شيك' : m === 'transfer' ? 'تحويل' : 'أونلاين'}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs arabic">{isAr ? 'ملاحظات' : 'Notes'}</Label>
        <Input className="arabic text-sm" placeholder={isAr ? 'ملاحظات إضافية (اختياري)' : 'Optional notes'} value={d.notes} onChange={e => setD(p => ({ ...p, notes: e.target.value }))} />
      </div>
      <Button onClick={onSubmit} disabled={submitting} className="arabic mt-1">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin me-1" /> : <Plus className="w-4 h-4 me-1" />}
        {submitLabel}
      </Button>
    </div>
  );
}

/* ── Admin Disbursements Modal (سندات الصرف) ─────────────── */
function AdminDisbursementsModal({ open, onClose, lang, logoUrl, onSessionExpired }: {
  open: boolean; onClose: () => void; lang: string; logoUrl: string; onSessionExpired: () => void;
}) {
  const isAr = lang === 'ar';
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfingId, setPdfingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [editingDis, setEditingDis] = useState<Disbursement | null>(null);

  const emptyDraft = (): DisbursementDraft => ({
    paidTo: '', namePrefix: 'السيد', amount: 0, amountText: '', description: '',
    paymentMethod: 'cash',
    date: new Date().toISOString().slice(0, 10), notes: '', disbursementNumber: '',
  });
  const [draft, setDraft] = useState<DisbursementDraft>(emptyDraft());
  const [editDraft, setEditDraft] = useState<DisbursementDraft>(emptyDraft());

  const handleUnauthorized = useCallback(() => {
    setSessionToken(null);
    onClose();
    onSessionExpired();
  }, [onClose, onSessionExpired]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchDisbursements();
    if (data === 'unauthorized') { handleUnauthorized(); return; }
    if (data !== null) setDisbursements(data);
    setLoading(false);
  }, [handleUnauthorized]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleCreate = async () => {
    if (!draft.paidTo.trim()) { toast.error(isAr ? 'أدخل اسم المستلم' : 'Enter payee name'); return; }
    if (!draft.description.trim()) { toast.error(isAr ? 'أدخل سبب الصرف' : 'Enter description'); return; }
    setCreating(true);
    const result = await createDisbursement({ ...draft });
    if (result === 'unauthorized') { handleUnauthorized(); setCreating(false); return; }
    if (result && 'number' in result) {
      toast.success(isAr ? `تم إنشاء سند صرف رقم ${result.number}` : `Disbursement No. ${result.number} created`);
      setDraft(emptyDraft());
      setView('list');
      await load();
    } else if (result && 'error' in result) {
      toast.error(`${isAr ? 'خطأ' : 'Error'}: ${result.error}`);
    } else {
      toast.error(isAr ? 'فشل في الحفظ — تحقق من الاتصال' : 'Save failed — check connection');
    }
    setCreating(false);
  };

  const handleOpenEdit = (dis: Disbursement) => {
    setEditingDis(dis);
    setEditDraft({
      paidTo: dis.paid_to, namePrefix: dis.name_prefix || 'السيد', amount: Number(dis.amount),
      amountText: dis.amount_text, description: dis.description,
      paymentMethod: dis.payment_method, date: dis.date,
      notes: dis.notes, disbursementNumber: dis.number,
    });
    setView('edit');
  };

  const handleSaveEdit = async () => {
    if (!editingDis) return;
    setSaving(true);
    const ok = await updateDisbursement(editingDis.id, {
      paidTo: editDraft.paidTo, namePrefix: editDraft.namePrefix, amount: editDraft.amount,
      amountText: editDraft.amountText, description: editDraft.description,
      paymentMethod: editDraft.paymentMethod, date: editDraft.date,
      notes: editDraft.notes, number: editDraft.disbursementNumber,
    });
    if (ok === 'unauthorized') { handleUnauthorized(); setSaving(false); return; }
    if (ok) {
      toast.success(isAr ? 'تم الحفظ' : 'Saved');
      setView('list');
      await load();
    } else {
      toast.error(isAr ? 'فشل الحفظ' : 'Save failed');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const ok = await deleteDisbursement(id);
    if (ok === 'unauthorized') { handleUnauthorized(); setDeletingId(null); return; }
    setDisbursements(prev => prev.filter(d => d.id !== id));
    setDeletingId(null);
  };

  const handleDownloadPDF = async (dis: Disbursement) => {
    setPdfingId(dis.id);
    await downloadDisbursementPDF({
      number: dis.number, paidTo: dis.paid_to, namePrefix: dis.name_prefix || 'السيد',
      amount: Number(dis.amount), amountText: dis.amount_text,
      description: dis.description, paymentMethod: dis.payment_method,
      date: dis.date, notes: dis.notes, logoUrl,
    });
    setPdfingId(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl shadow-2xl border border-border w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          {view !== 'list' ? (
            <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors arabic">
              <ChevronDown className="w-4 h-4 rotate-90" />
              {isAr ? 'رجوع' : 'Back'}
            </button>
          ) : <div />}
          <h2 className="text-base font-bold arabic text-center flex-1">
            {view === 'create' ? (isAr ? 'سند صرف جديد' : 'New Disbursement')
              : view === 'edit' ? (isAr ? 'تعديل السند' : 'Edit Disbursement')
              : (isAr ? 'سندات الصرف' : 'Disbursements')}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {view === 'create' && (
            <DisbursementForm d={draft} setD={setDraft} onSubmit={handleCreate} submitting={creating} submitLabel={isAr ? 'حفظ السند' : 'Save Disbursement'} isAr={isAr} />
          )}

          {view === 'edit' && (
            <DisbursementForm d={editDraft} setD={setEditDraft} onSubmit={handleSaveEdit} submitting={saving} submitLabel={isAr ? 'حفظ التعديلات' : 'Save Changes'} isAr={isAr} />
          )}

          {view === 'list' && (

            <div className="flex flex-col h-full">
              <div className="px-4 py-3 border-b border-border shrink-0">
                <Button size="sm" onClick={() => { setDraft(emptyDraft()); setView('create'); }} className="arabic text-xs w-full">
                  <Plus className="w-3.5 h-3.5 me-1" />{isAr ? 'سند صرف جديد' : 'New Disbursement'}
                </Button>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : disbursements.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                  <ArrowUpFromLine className="w-10 h-10 opacity-30" />
                  <p className="text-sm arabic">{isAr ? 'لا توجد سندات صرف' : 'No disbursements yet'}</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {disbursements.map(dis => (
                    <div key={dis.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-orange-100 dark:bg-orange-950/30">
                        <ArrowUpFromLine className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-primary">#{dis.number}</span>
                          <span className="text-sm font-bold arabic text-foreground truncate">{dis.paid_to}</span>
                        </div>
                        <p className="text-xs text-muted-foreground arabic mt-0.5">
                          {dis.date ? new Date(dis.date).toLocaleDateString(isAr ? 'ar-JO' : 'en-GB') : ''}
                          {' · '}{dis.description}
                          {' · '}<span className="font-bold text-orange-600">{Number(dis.amount).toFixed(3)} {isAr ? 'د.أ' : 'JD'}</span>
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0 items-center">
                        <button onClick={() => handleOpenEdit(dis)} title={isAr ? 'تعديل' : 'Edit'} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(dis)} disabled={pdfingId === dis.id} className="arabic text-xs h-7 px-2">
                          {pdfingId === dis.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><FileDown className="w-3.5 h-3.5 me-1" />PDF</>}
                        </Button>
                        <button onClick={() => handleDelete(dis.id)} disabled={deletingId === dis.id} className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          {deletingId === dis.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Arabic month grouping helpers ───────────────────────── */
const ARABIC_MONTH_NAMES = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];

function monthGroupKey(iso: string | undefined): string {
  const key = (iso || '').slice(0, 7);
  return /^\d{4}-\d{2}$/.test(key) ? key : 'unknown';
}

function monthGroupLabel(key: string): string {
  if (key === 'unknown') return 'غير محدد';
  const [y, m] = key.split('-');
  const idx = parseInt(m, 10) - 1;
  return `${ARABIC_MONTH_NAMES[idx] ?? m} ${y}`;
}

function groupRecordsByMonth<T extends { createdAt?: string; updatedAt?: string }>(records: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const r of records) {
    const key = monthGroupKey(r.createdAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, recs]) => [
      key,
      [...recs].sort((a, b) => {
        const ta = a.updatedAt ?? a.createdAt ?? '';
        const tb = b.updatedAt ?? b.createdAt ?? '';
        return tb.localeCompare(ta);
      }),
    ]);
}

/* ── QadriOld Records Modal ──────────────────────────────── */
type QadriOldRec = {
  id: string;
  details: { customerName: string; date: string; quotationNumber: string; [k: string]: string };
  items: { id: string; name: string; [k: string]: unknown }[];
  logoUrl: string; stampUrl: string;
  discountPct?: number; taxPct?: number;
  createdAt: string; updatedAt: string;
};

function QadriOldRecordsModal({ open, onClose }: { open: boolean; onClose: () => void; isAr: boolean }) {
  const RECS_KEY  = 'aq_qadri_old_records';
  const EDIT_KEY  = 'aq_qadri_old_edit_id';
  const DRAFT_KEY = 'aq_qadri_old_inline_draft';
  const { isAdmin } = useApp();
  const [records, setRecords] = React.useState<QadriOldRec[]>([]);
  const [loading, setLoading] = React.useState(false);
  const groupedRecords = React.useMemo(() => groupRecordsByMonth(records), [records]);

  React.useEffect(() => {
    if (!open) return;

    // Always show local records immediately (fast)
    let localRecs: QadriOldRec[] = [];
    try { const r = localStorage.getItem(RECS_KEY); localRecs = r ? JSON.parse(r) : []; } catch {}
    setRecords(localRecs);

    if (!isAdmin) return;

    // Admin: sync with server in the background
    setLoading(true);
    import('@/lib/storage').then(async ({ fetchQadriOldQuotations, upsertQadriOldQuotation }) => {
      const serverRecs = await fetchQadriOldQuotations();
      if (serverRecs === null) {
        // Server unreachable or not logged in — local records already shown, nothing to do
        return;
      }

      // Migrate local-only records to server silently
      const serverIds = new Set(serverRecs.map((r: QadriOldRec) => r.id));
      const toMigrate = localRecs.filter(r => !serverIds.has(r.id));
      if (toMigrate.length > 0) {
        for (const rec of toMigrate) {
          const { id, ...rest } = rec;
          await upsertQadriOldQuotation(rest as unknown as Record<string, unknown>, id);
        }
        // Reload after migration
        const refreshed = await fetchQadriOldQuotations();
        if (refreshed) setRecords(refreshed as QadriOldRec[]);
      } else {
        // No migration needed — show server records (may have records from other devices)
        setRecords(serverRecs as QadriOldRec[]);
      }
    }).finally(() => setLoading(false));
  }, [open, isAdmin]);

  const openRec = (rec: QadriOldRec) => {
    try {
      sessionStorage.setItem(EDIT_KEY, rec.id);
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ details: rec.details, items: rec.items, logoUrl: rec.logoUrl, stampUrl: rec.stampUrl, discountPct: rec.discountPct ?? 0, taxPct: rec.taxPct ?? 0, hiddenParts: rec.hiddenParts ?? {} }));
    } catch {}
    navigate('/qadri-old-quotation');
    onClose();
  };

  const deleteRec = async (id: string) => {
    if (isAdmin) {
      const { deleteQadriOldQuotation } = await import('@/lib/storage');
      await deleteQadriOldQuotation(id);
    } else {
      const updated = records.filter(r => r.id !== id);
      localStorage.setItem(RECS_KEY, JSON.stringify(updated));
    }
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const createNew = () => {
    try { sessionStorage.removeItem(EDIT_KEY); sessionStorage.removeItem(DRAFT_KEY); } catch {}
    navigate('/qadri-old-quotation');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg bg-card border-border p-0 overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="arabic flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            سجل عروض قادري قديم
          </DialogTitle>
        </DialogHeader>
        <div className="shrink-0 px-4 py-3 border-b border-border">
          <Button size="sm" onClick={createNew} className="arabic w-full text-xs">
            <Plus className="w-3.5 h-3.5 me-1" /> عرض سعر جديد
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <FileText className="w-10 h-10 opacity-20" />
              <p className="text-sm arabic">لا توجد عروض محفوظة بعد</p>
              <p className="text-xs arabic opacity-60">أنشئ عرضاً وانقر "حفظ" لتظهر هنا</p>
            </div>
          ) : (
            <div>
              {groupedRecords.map(([monthKey, recs]) => (
                <div key={monthKey}>
                  <div className="sticky top-0 z-10 bg-muted/70 backdrop-blur-sm px-4 py-1.5 text-xs font-bold text-muted-foreground arabic border-y border-border">
                    {monthGroupLabel(monthKey)} <span className="opacity-60">({recs.length})</span>
                  </div>
                  <div className="divide-y divide-border">
                    {recs.map(rec => (
                      <div key={rec.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 dark:bg-blue-950/30">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openRec(rec)}>
                          <p className="text-sm font-bold arabic text-foreground truncate">{rec.details.customerName || '—'}</p>
                          <p className="text-xs text-muted-foreground arabic">
                            {rec.details.date} · {rec.items.filter(i => String(i.name ?? '').trim()).length} بنود
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => openRec(rec)} className="arabic text-xs h-7 px-2">فتح</Button>
                          <button onClick={() => deleteRec(rec.id)} title="حذف" className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── NoHeader Records Modal ──────────────────────────────── */
type NoHeaderRec = {
  id: string;
  details: { customerName: string; date: string; quotationNumber: string };
  items: { id: string; name: string; [k: string]: unknown }[];
  logoUrl: string; logoText: string; stampUrl: string; colorKey: string;
  createdAt: string; updatedAt: string;
};

function NoHeaderRecordsModal({ open, onClose }: { open: boolean; onClose: () => void; isAr: boolean }) {
  const RECS_KEY  = 'aq_no_header_records';
  const EDIT_KEY  = 'aq_no_header_edit_id';
  const DRAFT_KEY = 'aq_no_header_draft';
  const [records, setRecords] = React.useState<NoHeaderRec[]>([]);
  const groupedRecords = React.useMemo(() => groupRecordsByMonth(records), [records]);

  React.useEffect(() => {
    if (!open) return;
    try { const r = localStorage.getItem(RECS_KEY); setRecords(r ? JSON.parse(r) : []); } catch { setRecords([]); }
  }, [open]);

  const openRec = (rec: NoHeaderRec) => {
    try {
      sessionStorage.setItem(EDIT_KEY, rec.id);
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ details: rec.details, items: rec.items, logoUrl: rec.logoUrl, logoText: rec.logoText, stampUrl: rec.stampUrl, colorKey: rec.colorKey }));
    } catch {}
    navigate('/no-header-quotation');
    onClose();
  };

  const deleteRec = (id: string) => {
    const updated = records.filter(r => r.id !== id);
    localStorage.setItem(RECS_KEY, JSON.stringify(updated));
    setRecords(updated);
  };

  const createNew = () => {
    try { sessionStorage.removeItem(EDIT_KEY); sessionStorage.removeItem(DRAFT_KEY); } catch {}
    navigate('/no-header-quotation');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg bg-card border-border p-0 overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>
        <DialogHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="arabic flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            سجل عروض دون ترويسة
          </DialogTitle>
        </DialogHeader>
        <div className="shrink-0 px-4 py-3 border-b border-border">
          <Button size="sm" onClick={createNew} className="arabic w-full text-xs">
            <Plus className="w-3.5 h-3.5 me-1" /> عرض سعر جديد
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {records.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <FileText className="w-10 h-10 opacity-20" />
              <p className="text-sm arabic">لا توجد عروض محفوظة بعد</p>
              <p className="text-xs arabic opacity-60">أنشئ عرضاً وانقر "حفظ" لتظهر هنا</p>
            </div>
          ) : (
            <div>
              {groupedRecords.map(([monthKey, recs]) => (
                <div key={monthKey}>
                  <div className="sticky top-0 z-10 bg-muted/70 backdrop-blur-sm px-4 py-1.5 text-xs font-bold text-muted-foreground arabic border-y border-border">
                    {monthGroupLabel(monthKey)} <span className="opacity-60">({recs.length})</span>
                  </div>
                  <div className="divide-y divide-border">
                    {recs.map(rec => (
                      <div key={rec.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-green-100 dark:bg-green-950/30">
                          <FileText className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openRec(rec)}>
                          <p className="text-sm font-bold arabic text-foreground truncate">{rec.details.customerName || '—'}</p>
                          <p className="text-xs text-muted-foreground arabic">
                            {rec.details.date} · {rec.items.filter(i => String(i.name ?? '').trim()).length} بنود
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => openRec(rec)} className="arabic text-xs h-7 px-2">فتح</Button>
                          <button onClick={() => deleteRec(rec.id)} title="حذف" className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
