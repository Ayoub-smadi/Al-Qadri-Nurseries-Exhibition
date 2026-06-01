import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useApp } from '@/lib/context';
import { Photo, Section, Branch, SocialLink, SocialPlatform, Highlight, FeaturedImage, uploadImage, uploadImageFromUrl, adminLogin, adminSetup, checkNeedsSetup, setSessionToken, loadSavedToken, validateToken, QuoteItem, QuoteRequest, Invoice, InvoiceItem, submitQuote, fetchQuotes, updateQuote, deleteQuote, restoreQuote, permanentDeleteQuote, fetchInvoices, createInvoice, deleteInvoice, updateInvoiceStatus } from '@/lib/storage';
import { downloadCatalogPDF, downloadQuotePDF, shareQuotePDFToWhatsApp, downloadInvoicePDF, PDFSectionInput } from '@/lib/pdfGen';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  X, Plus, LogOut, Settings, ImagePlus, Moon, Sun,
  Pencil, Trash2, FolderPlus, FileDown, Loader2, ChevronDown, ChevronUp, MapPin,
  TreePine, Package, Building2, Globe, Flower2, Share2,
  Search, Receipt, ShoppingCart, CheckCircle2, Circle, Minus, Inbox,
  ArrowUp, ArrowDown, Download, Upload, FileSpreadsheet, RotateCcw,
  FileText, Trash, ArchiveRestore,
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
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    [880, 1100, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.connect(gain);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.28);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.3);
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

                {/* Photos grid */}
                {isExpanded && sec.photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2.5 p-3 bg-background/50">
                    {sec.photos.map(photo => {
                      const checked = secSel.has(photo.id);
                      return (
                        <label key={photo.id}
                          className={`relative cursor-pointer rounded-lg overflow-hidden aspect-square border-2 transition-all ${checked ? 'border-primary shadow-sm' : 'border-transparent opacity-50'}`}
                          onClick={() => togglePhoto(sec.id, photo.id)}>
                          <img src={photo.image} alt={isAr ? photo.nameAr : (photo.nameEn || photo.nameAr)}
                            className="w-full h-full object-cover" loading="lazy" decoding="async" />
                          <div className={`absolute inset-0 bg-primary/20 transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`} />
                          <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1.5 py-1">
                            <p className="text-white text-[10px] font-semibold truncate arabic text-center leading-tight">
                              {isAr ? photo.nameAr : (photo.nameEn || photo.nameAr)}
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

  /* backup / restore */
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);

  /* excel import */
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const [xlsxOpen, setXlsxOpen] = useState(false);
  const [xlsxResult, setXlsxResult] = useState<{ added: number; sections: string[] } | null>(null);
  const [xlsxError, setXlsxError] = useState<string | null>(null);
  const [xlsxLoading, setXlsxLoading] = useState(false);

  /* ── poll pending quotes count when admin is logged in ── */
  const prevPendingRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isAdmin) { setPendingQuoteCount(0); prevPendingRef.current = null; return; }
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const poll = async () => {
      const qs = await fetchQuotes();
      if (qs) {
        const newPending = qs.filter(q => q.status !== 'priced').length;
        const prev = prevPendingRef.current;
        if (prev !== null && newPending > prev) {
          playNotificationSound();
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('مشاتل القادري — طلب جديد 🌿', {
              body: `وصلك ${newPending - prev} طلب عرض سعر جديد`,
            });
          }
        }
        prevPendingRef.current = newPending;
        setPendingQuoteCount(newPending);
      }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
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

  const handleAddPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl || !addPhotoSectionId) return;
    const photo: Photo = { id: uid(), image: photoUrl, nameAr: photoNameAr, nameEn: photoNameEn, descriptionAr: photoDescAr, descriptionEn: photoDescEn };
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

  const handleEditPhotoOpen = (sectionId: string, photo: Photo) => {
    setEditPhotoTarget({ sectionId, photo });
    setEditPhotoUrl(photo.image);
    setEditPhotoNameAr(photo.nameAr);
    setEditPhotoNameEn(photo.nameEn);
    setEditPhotoDescAr(photo.descriptionAr || '');
    setEditPhotoDescEn(photo.descriptionEn || '');
    setEditPhotoExtraImages(photo.extraImages ?? []);
  };

  const handleSaveEditPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPhotoTarget) return;
    const updated: Photo = {
      ...editPhotoTarget.photo,
      image: editPhotoUrl,
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

      {/* ── SERVICES ── */}
      <section className="border-b border-border bg-muted/20 px-4 md:px-12 py-12">
        {/* Section title */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="flex-1 h-px bg-foreground/15" />
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold arabic text-foreground">{isAr ? 'خدماتنا' : 'Our Services'}</h2>
            <p className="text-xs text-muted-foreground tracking-widest uppercase latin mt-0.5">{isAr ? 'Our Services' : 'خدماتنا'}</p>
          </div>
          <div className="flex-1 h-px bg-foreground/15" />
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
          {[
            {
              icon: <TreePine className="w-8 h-8" />,
              nameAr: 'قسم الأشجار',
              nameEn: 'Trees Division',
            },
            {
              icon: <Package className="w-8 h-8" />,
              nameAr: 'توريد المنتجات الزراعية',
              nameEn: 'Agricultural Supply',
            },
            {
              icon: <Building2 className="w-8 h-8" />,
              nameAr: 'تأسيس المشاريع الزراعية',
              nameEn: 'Agricultural Projects',
            },
            {
              icon: <Globe className="w-8 h-8" />,
              nameAr: 'الاستيراد والتصدير',
              nameEn: 'Import & Export',
            },
            {
              icon: <Flower2 className="w-8 h-8" />,
              nameAr: 'تنسيق وصيانة الحدائق',
              nameEn: 'Garden Landscaping',
            },
          ].map((service, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow text-center"
            >
              <div className="w-14 h-14 rounded-full bg-foreground/8 flex items-center justify-center text-foreground/70">
                {service.icon}
              </div>
              <p className="text-sm font-bold arabic text-foreground leading-snug">{isAr ? service.nameAr : service.nameEn}</p>
              <p className="text-[10px] text-muted-foreground latin tracking-wide uppercase">{isAr ? service.nameEn : service.nameAr}</p>
            </div>
          ))}
        </div>
      </section>

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
          <Receipt className="w-4 h-4 shrink-0" />
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
          />
          );
        })}
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
              <h2 className="text-2xl md:text-3xl font-bold arabic text-foreground">{isAr ? 'فروعنا' : 'Our Branches'}</h2>
              <p className="text-xs text-muted-foreground tracking-widest uppercase latin mt-0.5">{isAr ? 'Our Branches' : 'فروعنا'}</p>
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
                        alt={isAr ? branch.nameAr : (branch.nameEn || branch.nameAr)}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy" decoding="async"
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
                        {isAr ? branch.nameAr : (branch.nameEn || branch.nameAr)}
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
                      href={link.url || '#'}
                      target={link.url ? '_blank' : undefined}
                      rel="noreferrer"
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
        <div className="no-print fixed bottom-4 left-0 right-0 z-50 flex justify-center px-3 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-card/95 backdrop-blur-xl border border-primary/30 shadow-2xl overflow-x-auto max-w-[96vw] scrollbar-none">
            <span className="text-xs font-bold text-primary pe-2 border-e border-border arabic shrink-0">{isAr ? 'تحرير' : 'Edit'}</span>
            <ToolBtn icon={<FolderPlus className="w-3.5 h-3.5" />} label={isAr ? 'قسم جديد' : 'New Section'} onClick={() => setAddSecOpen(true)} />
            <ToolBtn icon={<MapPin className="w-3.5 h-3.5" />} label={isAr ? 'فرع جديد' : 'New Branch'} onClick={() => setAddBranchOpen(true)} />
            <ToolBtn icon={<Share2 className="w-3.5 h-3.5" />} label={isAr ? 'روابطنا' : 'Links'} onClick={openAddSocial} />
            <ToolBtn icon={<Settings className="w-3.5 h-3.5" />} label={isAr ? 'التواصل' : 'Contact'} onClick={() => { setFooterDraft({ ...siteData.footer }); setFooterOpen(true); }} />
            <ToolBtn icon={<Inbox className="w-3.5 h-3.5" />} label={isAr ? 'طلبات العروض' : 'Quotes'} badge={pendingQuoteCount} onClick={() => { setAdminQuotesOpen(true); setPendingQuoteCount(0); }} />
            <ToolBtn icon={<FileText className="w-3.5 h-3.5" />} label={isAr ? 'الفواتير' : 'Invoices'} onClick={() => setAdminInvoicesOpen(true)} />
            <ToolBtn icon={<FileDown className="w-3.5 h-3.5" />} label={isAr ? 'كتالوج PDF' : 'PDF Catalog'} variant="dark" onClick={() => setPdfModalTarget('all')} />
            <div className="w-px h-5 bg-border shrink-0" />
            <ToolBtn icon={<FileSpreadsheet className="w-3.5 h-3.5" />} label={isAr ? 'Excel' : 'Excel'} onClick={() => { setXlsxOpen(true); setXlsxResult(null); setXlsxError(null); }} />
            <ToolBtn icon={<Download className="w-3.5 h-3.5" />} label={isAr ? 'نسخ احتياطي' : 'Backup'} onClick={handleBackup} />
            <ToolBtn icon={restoring ? undefined : <Upload className="w-3.5 h-3.5" />} label={isAr ? 'استرجاع' : 'Restore'} onClick={() => restoreInputRef.current?.click()} />
            <input ref={restoreInputRef} type="file" accept=".json" className="hidden" onChange={handleRestoreFile} />
            <button onClick={() => { setSessionToken(null); setIsAdmin(false); }}
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
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

      {/* Plant Lightbox */}
      {lightboxPhoto && (
        <PlantLightbox photo={lightboxPhoto} lang={lang} onClose={() => setLightboxPhoto(null)} />
      )}
    </div>
  );
}

/* ── Section block ───────────────────────────────────── */
const SECTION_PAGE_SIZE = 24;

function SectionBlock({ section, lang, isAdmin, onUpdateName, onAddPhoto, onDeletePhoto, onEditPhoto, onDeleteSection, onDownloadPDF, onMoveUp, onMoveDown, isFirst, isLast, onOpenLightbox, onReorderPhotos }: {
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
                  />
                </div>
              ) : (
                <PlantCard key={photo.id} photo={photo} lang={lang} isAdmin={isAdmin}
                  onEdit={() => onEditPhoto(photo)}
                  onDelete={() => onDeletePhoto(photo.id)}
                  onOpenLightbox={onOpenLightbox}
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
function PlantCard({ photo, lang, isAdmin, onEdit, onDelete, onOpenLightbox }: {
  photo: Photo; lang: string; isAdmin: boolean;
  onEdit: () => void; onDelete: () => void;
  onOpenLightbox: (photo: Photo) => void;
}) {
  const isAr = lang === 'ar';
  const allImages = [photo.image, ...(photo.extraImages ?? [])].filter(Boolean);
  const [imgIdx, setImgIdx] = useState(0);
  const safeIdx = Math.min(imgIdx, allImages.length - 1);

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setImgIdx(i => (i - 1 + allImages.length) % allImages.length); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setImgIdx(i => (i + 1) % allImages.length); };

  return (
    <div className="group relative rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 bg-card aspect-[4/5] cursor-pointer"
      onClick={() => !isAdmin && onOpenLightbox({ ...photo, image: allImages[safeIdx] ?? photo.image })}>

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
      <div className="relative z-10 w-full max-w-2xl bg-card rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
        onClick={e => e.stopPropagation()}>

        {/* image side */}
        <div className="md:w-[55%] aspect-[4/5] md:aspect-auto bg-muted shrink-0 relative">
          <img src={allImages[safeIdx] || photo.image}
            alt={isAr ? photo.nameAr : (photo.nameEn || photo.nameAr)}
            className="w-full h-full object-cover transition-opacity duration-300" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

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
        <div className="flex-1 flex flex-col justify-between p-6 md:p-8">
          <div>
            {/* close */}
            <button onClick={onClose}
              className="absolute top-3 end-3 w-9 h-9 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-colors backdrop-blur-sm">
              <X className="w-4 h-4" />
            </button>

            {/* name */}
            <h2 className="arabic text-2xl md:text-3xl font-bold text-foreground leading-tight mt-6 md:mt-0">
              {isAr ? photo.nameAr : (photo.nameEn || photo.nameAr)}
            </h2>
            {photo.nameAr && photo.nameEn && (
              <p className="text-muted-foreground text-sm latin mt-1">
                {isAr ? photo.nameEn : photo.nameAr}
              </p>
            )}

            {/* divider */}
            <div className="my-4 h-px bg-border" />

            {/* description */}
            {(photo.descriptionAr || photo.descriptionEn) ? (
              <p className="arabic text-foreground/80 text-sm leading-relaxed">
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
  const [shippingMode, setShippingMode] = useState<'pickup' | 'delivery' | ''>('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shippingError, setShippingError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ name: string; mode: 'pickup' | 'delivery'; address: string } | null>(null);

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
    if (!shippingMode) { setShippingError(true); return; }
    if (shippingMode === 'delivery' && !shippingAddress.trim()) { setShippingError(true); return; }
    // Snapshot ALL state values NOW before any async op — prevents stale closure issues
    const snapShipping = shippingMode as 'pickup' | 'delivery';
    const snapAddress  = shippingMode === 'delivery' ? shippingAddress.trim() : '';
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
            <Receipt className="w-5 h-5 text-primary" />
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
                  <div className="flex justify-between gap-2"><span className="text-muted-foreground">{isAr ? 'التوصيل' : 'Delivery'}</span><span className="font-medium text-green-600">🏪 {isAr ? 'استلام من المشتل' : 'In-store Pickup'}</span></div>
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
                <Label className="arabic text-sm mb-1.5 block">{isAr ? 'رقم الهاتف' : 'Phone Number'}</Label>
                <Input value={custPhone} onChange={e => setCustPhone(e.target.value)} dir="ltr" placeholder="+962 7X XXX XXXX" type="tel" />
              </div>
              <div>
                <Label className={`arabic text-sm mb-1.5 block ${shippingError ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {isAr ? 'طريقة التوصيل *' : 'Delivery Method *'}
                </Label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => { setShippingMode('pickup'); setShippingError(false); }}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${shippingMode === 'pickup' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted'}`}
                  >
                    <span className="text-lg">🏪</span>
                    <span className="text-sm font-bold arabic text-foreground">{isAr ? 'استلام من المشتل' : 'Pickup'}</span>
                    {shippingMode === 'pickup' && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShippingMode('delivery'); setShippingError(false); }}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${shippingMode === 'delivery' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted'}`}
                  >
                    <span className="text-lg">🚚</span>
                    <span className="text-sm font-bold arabic text-foreground">{isAr ? 'توصيل' : 'Delivery'}</span>
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
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Receipt className="w-4 h-4 me-2" />{isAr ? 'إرسال طلب العرض' : 'Send Quote Request'}</>}
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
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pdfingId, setPdfingId] = useState<string | null>(null);
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
    await updateQuote(q.id, { items: q.items, discount: q.discount, tax: q.tax, status: newStatus, notes: q.notes, shippingFee: q.shipping_fee, shippingMethod: q.shipping_method, shippingAddress: q.shipping_address });
    setSavingId(null);
    setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, status: newStatus } : x));
    if (editQuote?.id === q.id) setEditQuote(prev => prev ? { ...prev, status: newStatus } : prev);
  };

  const handleSave = async (q: QuoteRequest) => {
    setSavingId(q.id);
    await updateQuote(q.id, { items: q.items, discount: q.discount, tax: q.tax, status: 'priced', notes: q.notes, shippingFee: q.shipping_fee, shippingMethod: q.shipping_method, shippingAddress: q.shipping_address });
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
    return after + after * (Number(q.tax) / 100) + (Number(q.shipping_fee) || 0);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <Inbox className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold arabic text-foreground">{isAr ? 'طلبات عروض الأسعار' : 'Price Quote Requests'}</h2>
          </div>
          <div className="flex items-center gap-2">
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
              <div className="px-5 py-3 border-b border-border flex items-center gap-2 shrink-0 bg-muted/30">
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
                        : <span className="text-orange-500 font-medium">⚠️ {isAr ? 'لم يُحدَّد — اختر من الأسفل واحفظ' : 'Not set — choose below & save'}</span>
                    }
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(editQuote)} disabled={pdfingId === editQuote.id} className="arabic text-xs">
                    {pdfingId === editQuote.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><FileDown className="w-3.5 h-3.5 me-1" />{isAr ? 'PDF' : 'PDF'}</>}
                  </Button>
                  {editQuote.phone && (
                    <Button size="sm" variant="outline" onClick={() => handleWhatsApp(editQuote)} disabled={sharingId === editQuote.id} className="text-xs bg-[#25D366]/10 border-[#25D366]/40 text-[#128C7E] hover:bg-[#25D366]/20 dark:text-[#25D366]">
                      {sharingId === editQuote.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <><svg className="w-3.5 h-3.5 me-1" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>{isAr ? 'واتساب' : 'WhatsApp'}</>
                      }
                    </Button>
                  )}
                  <Button size="sm" onClick={() => handleSave(editQuote)} disabled={savingId === editQuote.id} className="arabic text-xs">
                    {savingId === editQuote.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (isAr ? 'حفظ' : 'Save')}
                  </Button>
                  <button onClick={() => handleDelete(editQuote.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
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
                <div className="grid grid-cols-3 gap-3">
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
              <Receipt className="w-10 h-10 opacity-20" />
              <p className="text-sm arabic">{isAr ? 'اختر طلباً لعرض التفاصيل' : 'Select a request to view details'}</p>
            </div>
          )}
        </div>
        )}
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
  const [view, setView] = useState<'list' | 'create'>('list');
  const [tab, setTab] = useState<'receivable' | 'paid'>('receivable');

  const emptyItem = (): InvoiceItem => ({ description: '', quantity: 1, unitPrice: 0 });
  const [draft, setDraft] = useState<{ customerName: string; date: string; items: InvoiceItem[]; notes: string; status: 'paid' | 'receivable' }>({
    customerName: '', date: new Date().toISOString().slice(0, 10), items: [emptyItem()], notes: '', status: 'receivable',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const inv = await fetchInvoices();
    if (inv !== null) setInvoices(inv);
    setLoading(false);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const resetDraft = () => setDraft({ customerName: '', date: new Date().toISOString().slice(0, 10), items: [emptyItem()], notes: '', status: 'receivable' });

  const total = draft.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);

  const handleCreate = async () => {
    if (!draft.customerName.trim()) { toast.error(isAr ? 'أدخل اسم المطلوب منه' : 'Enter customer name'); return; }
    if (draft.items.some(it => !it.description.trim())) { toast.error(isAr ? 'أدخل وصف جميع الأصناف' : 'Enter description for all items'); return; }
    setCreating(true);
    const result = await createInvoice({ customerName: draft.customerName, date: draft.date, items: draft.items, notes: draft.notes, status: draft.status });
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
    await downloadInvoicePDF(inv, siteData);
    setPdfingId(null);
  };

  const handleToggleStatus = async (inv: Invoice) => {
    setTogglingId(inv.id);
    const newStatus: 'paid' | 'receivable' = inv.status === 'paid' ? 'receivable' : 'paid';
    const ok = await updateInvoiceStatus(inv.id, newStatus);
    if (ok) {
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status: newStatus } : i));
      toast.success(isAr ? (newStatus === 'paid' ? 'تم تحديد الفاتورة كمدفوعة' : 'تم تحديد الفاتورة كذمم') : (newStatus === 'paid' ? 'Marked as paid' : 'Marked as receivable'));
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

  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    const items = draft.items.map((it, i) => i === idx ? { ...it, [field]: value } : it);
    setDraft({ ...draft, items });
  };

  const addItem = () => setDraft({ ...draft, items: [...draft.items, emptyItem()] });
  const removeItem = (idx: number) => {
    if (draft.items.length === 1) return;
    setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) });
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
            {view === 'create' && (
              <button onClick={() => setView('list')} className="text-xs arabic text-muted-foreground hover:text-foreground transition-colors">
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
            </div>

            {/* Status selector */}
            <div>
              <Label className="arabic text-xs mb-2 block">{isAr ? 'نوع الفاتورة' : 'Invoice Type'}</Label>
              <div className="grid grid-cols-2 gap-2">
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
              <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-t border-border">
                <span className="text-sm font-bold arabic text-foreground">{isAr ? 'الاجمالي' : 'Total'}</span>
                <span className="text-base font-extrabold text-primary arabic">{total.toFixed(3)} {isAr ? 'د.أ' : 'JD'}</span>
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
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                  <FileText className="w-10 h-10 opacity-30" />
                  <p className="text-sm arabic">{isAr ? (tab === 'receivable' ? 'لا توجد ذمم' : 'لا توجد فواتير مدفوعة') : (tab === 'receivable' ? 'No receivables' : 'No paid invoices')}</p>
                  {tab === 'receivable' && (
                    <Button size="sm" variant="outline" onClick={() => { resetDraft(); setView('create'); }} className="arabic text-xs">
                      <Plus className="w-3.5 h-3.5 me-1" />{isAr ? 'إنشاء فاتورة' : 'Create invoice'}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredInvoices.map(inv => {
                    const invTotal = (inv.items as InvoiceItem[]).reduce((s, it) => s + it.quantity * it.unitPrice, 0);
                    const isPaid = inv.status === 'paid';
                    return (
                      <div key={inv.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isPaid ? 'bg-green-100 dark:bg-green-950/30' : 'bg-amber-100 dark:bg-amber-950/30'}`}>
                          <FileText className={`w-4.5 h-4.5 ${isPaid ? 'text-green-600' : 'text-amber-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-primary">#{inv.number}</span>
                            <span className="text-sm font-bold arabic text-foreground truncate">{inv.customer_name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground arabic mt-0.5">
                            {inv.date ? new Date(inv.date).toLocaleDateString(isAr ? 'ar-JO' : 'en-GB') : ''}
                            {' · '}{inv.items.length} {isAr ? 'صنف' : 'items'}
                            {' · '}<span className="font-bold text-green-600">{invTotal.toFixed(3)} {isAr ? 'د.أ' : 'JD'}</span>
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0 items-center">
                          <button
                            onClick={() => handleToggleStatus(inv)}
                            disabled={togglingId === inv.id}
                            title={isAr ? (isPaid ? 'تحويل إلى ذمم' : 'تحديد كمدفوع') : (isPaid ? 'Mark as receivable' : 'Mark as paid')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold arabic transition-all border ${isPaid ? 'border-green-300 text-green-700 bg-green-50 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 dark:bg-green-950/20 dark:text-green-400' : 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-green-50 hover:text-green-700 hover:border-green-300 dark:bg-amber-950/20 dark:text-amber-400'}`}
                          >
                            {togglingId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (isPaid ? (isAr ? 'مدفوع' : 'Paid') : (isAr ? 'ذمم' : 'Due'))}
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
          </div>
        )}
      </div>
    </div>
  );
}
