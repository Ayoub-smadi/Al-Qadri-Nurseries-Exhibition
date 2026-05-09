import React, { useRef, useState, useCallback } from 'react';
import { useApp } from '@/lib/context';
import { Photo, Section, Branch, SocialLink, SocialPlatform, uploadImage, adminLogin, setSessionToken } from '@/lib/storage';
import { downloadCatalogPDF, PDFSectionInput } from '@/lib/pdfGen';
import { toast } from 'sonner';
import {
  X, Plus, LogOut, Settings, ImagePlus, Moon, Sun,
  Pencil, Trash2, FolderPlus, FileDown, Loader2, ChevronDown, ChevronUp, MapPin,
  TreePine, Package, Building2, Globe, Flower2, Share2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

/* ── utils ─────────────────────────────────────────────── */
function uid() { return `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

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
          } catch {
            alert('فشل رفع الصورة — Upload failed');
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
  const [photoUploading, setPhotoUploading] = useState(false);

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

  /* ── handlers ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await adminLogin(pass);
    if (token) {
      setSessionToken(token);
      setIsAdmin(true); setLoginOpen(false); setUser(''); setPass(''); setLoginErr('');
    } else {
      setLoginErr(isAr ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials');
    }
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
          <div className="relative shrink-0 group/owner">
            <div className="w-44 h-44 md:w-52 md:h-52 rounded-full overflow-hidden ring-[3px] ring-foreground/70 ring-offset-4 ring-offset-background shadow-2xl">
              <img
                src={siteData.owner?.photo || '/owner.png'}
                alt="مهندس ثامر القادري"
                className="w-full h-full object-cover object-top scale-105"
              />
            </div>
            {/* decorative dot */}
            <div className="absolute -bottom-1 -end-1 w-6 h-6 rounded-full bg-foreground/70 shadow-md" />
            {/* Admin upload overlay */}
            {isAdmin && (
              <FileUploadBtn
                onFile={url => updateSiteData({ owner: { photo: url } })}
                className="no-print absolute inset-0 rounded-full flex flex-col items-center justify-center gap-1 bg-black/50 text-white opacity-0 group-hover/owner:opacity-100 transition-opacity cursor-pointer"
              >
                <ImagePlus className="w-7 h-7" />
                <span className="text-xs arabic font-semibold">{isAr ? 'تغيير الصورة' : 'Change Photo'}</span>
              </FileUploadBtn>
            )}
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

      {/* ── SERVICES ── */}
      <section className="border-b border-border bg-muted/20 px-4 md:px-12 py-12">
        {/* Section title */}
        <div className="flex items-center justify-center gap-4 mb-10">
          <div className="flex-1 h-px bg-foreground/15" />
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold arabic text-foreground">خدماتنا</h2>
            <p className="text-xs text-muted-foreground tracking-widest uppercase latin mt-0.5">Our Services</p>
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
              <p className="text-sm font-bold arabic text-foreground leading-snug">{service.nameAr}</p>
              <p className="text-[10px] text-muted-foreground latin tracking-wide uppercase">{service.nameEn}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── GALLERY TITLE ── */}
      <div className="text-center pt-12 pb-2 px-4">
        <h2 className="text-2xl md:text-3xl font-bold arabic text-foreground mb-2">معرض مشاتل القادري الزراعية</h2>
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-px bg-foreground/20" />
          <div className="w-2 h-2 rounded-full bg-foreground/30" />
          <div className="w-12 h-px bg-foreground/20" />
        </div>
      </div>

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

      {/* ── SOCIAL LINKS ── */}
      {((siteData.socialLinks ?? []).length > 0 || isAdmin) && (
        <section className="px-4 md:px-12 py-12 border-t border-border bg-background">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="flex-1 h-px bg-foreground/15" />
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold arabic text-foreground">روابطنا</h2>
              <p className="text-xs text-muted-foreground tracking-widest uppercase latin mt-0.5">Our Links</p>
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
            <ToolBtn icon={<FileDown className="w-3.5 h-3.5" />} label={isAr ? 'كتالوج PDF' : 'PDF Catalog'} variant="dark" onClick={() => setPdfModalTarget('all')} />
            <button onClick={() => { setSessionToken(null); setIsAdmin(false); }}
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-destructive hover:bg-destructive/10 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
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
      <Dialog open={loginOpen} onOpenChange={o => { setLoginOpen(o); if (!o) { setPass(''); setLoginErr(''); } }}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl text-center arabic">{isAr ? 'دخول المدير' : 'Admin Login'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{isAr ? 'كلمة المرور' : 'Password'}</Label>
              <Input type="password" value={pass} onChange={e => setPass(e.target.value)} dir="ltr" autoComplete="current-password" />
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
