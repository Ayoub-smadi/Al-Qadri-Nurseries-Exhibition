import React, { useRef, useState } from 'react';
import { useApp } from '@/lib/context';
import { Photo, Section } from '@/lib/storage';
import { toast } from 'sonner';
import {
  X, Plus, Download, LogOut, Settings, ImagePlus, Moon, Sun,
  Pencil, Trash2, FolderPlus, FileDown, Check,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/* ── helpers ──────────────────────────────────────────── */
function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function uid() { return `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function printSectionPDF(section: Section, lang: string) {
  const isAr = lang === 'ar';
  const name = isAr ? section.nameAr : section.nameEn;
  const html = `<!DOCTYPE html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${lang}">
<head>
<meta charset="utf-8">
<title>${name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Cormorant+Garamond:wght@400;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:${isAr ? "'Cairo'" : "'Cormorant Garamond'"}, serif;background:#fff;padding:20px;color:#111}
  h1{text-align:center;font-size:22px;font-weight:700;margin-bottom:18px;padding-bottom:10px;border-bottom:2px solid #e5c580}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .card{break-inside:avoid;page-break-inside:avoid}
  .card img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;display:block}
  .card p{text-align:center;margin-top:6px;font-size:13px;font-weight:600;color:#333}
  @page{size:A4;margin:15mm}
</style>
</head>
<body>
<h1>${name}</h1>
<div class="grid">
${section.photos.map(p => `<div class="card"><img src="${p.image}" alt="${isAr ? p.nameAr : p.nameEn}"><p>${isAr ? p.nameAr : p.nameEn}</p></div>`).join('\n')}
</div>
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) { toast.error('فتح النافذة مُحظور — يرجى السماح بالنوافذ المنبثقة'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}

function printFullPDF(sections: Section[], titleAr: string, titleEn: string, lang: string, logo: string) {
  const isAr = lang === 'ar';
  const title = isAr ? titleAr : titleEn;
  const sectionsHtml = sections.map(s => {
    const sName = isAr ? s.nameAr : s.nameEn;
    return `<div class="section">
<h2>${sName}</h2>
<div class="grid">
${s.photos.map(p => `<div class="card"><img src="${p.image}" alt="${isAr ? p.nameAr : p.nameEn}"><p>${isAr ? p.nameAr : p.nameEn}</p></div>`).join('\n')}
</div></div>`;
  }).join('\n');
  const html = `<!DOCTYPE html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${lang}">
<head>
<meta charset="utf-8">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Cormorant+Garamond:wght@400;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:${isAr ? "'Cairo'" : "'Cormorant Garamond'"}, serif;background:#fff;padding:20px;color:#111}
  .header{text-align:center;margin-bottom:28px;padding-bottom:14px;border-bottom:2px solid #e5c580}
  .header img{width:64px;height:64px;object-fit:contain;border-radius:50%;margin-bottom:8px}
  .header h1{font-size:24px;font-weight:700}
  .header p{font-size:13px;letter-spacing:.1em;color:#666;font-family:'Cormorant Garamond',serif}
  .section{margin-bottom:32px;page-break-inside:avoid}
  .section h2{font-size:18px;font-weight:700;margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid #e5c580}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .card{break-inside:avoid;page-break-inside:avoid}
  .card img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;display:block}
  .card p{text-align:center;margin-top:5px;font-size:12px;font-weight:600;color:#333}
  @page{size:A4;margin:15mm}
</style>
</head>
<body>
<div class="header">
${logo ? `<img src="${logo}" alt="logo">` : ''}
<h1>${title}</h1>
${isAr ? `<p>Al-Qadri Agricultural Nurseries</p>` : `<p>مشاتل القادري الزراعية</p>`}
</div>
${sectionsHtml}
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) { toast.error('فتح النافذة مُحظور — يرجى السماح بالنوافذ المنبثقة'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}

/* ── inline editable text ─────────────────────────────── */
function InlineEdit({ value, onSave, className, style, multiline }: {
  value: string; onSave: (v: string) => void; className?: string; style?: React.CSSProperties; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const save = () => { onSave(draft.trim() || value); setEditing(false); };
  if (!editing) return (
    <span className={`cursor-pointer group/ie relative ${className ?? ''}`} style={style} onDoubleClick={() => { setDraft(value); setEditing(true); }}>
      {value}
      <Pencil className="inline-block w-3 h-3 ms-1.5 opacity-0 group-hover/ie:opacity-40 transition-opacity" />
    </span>
  );
  return multiline ? (
    <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={save} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') setEditing(false); }}
      className={`bg-transparent border-b border-primary outline-none resize-none w-full ${className ?? ''}`} style={style} rows={2} />
  ) : (
    <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      className={`bg-transparent border-b border-primary outline-none w-full ${className ?? ''}`} style={style} />
  );
}

/* ── file upload input ────────────────────────────────── */
function FileUploadInput({ onFile, children }: { onFile: (base64: string) => void; children: React.ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={async e => {
        const f = e.target.files?.[0]; if (!f) return;
        const b64 = await fileToBase64(f);
        onFile(b64); e.target.value = '';
      }} />
      <span onClick={() => ref.current?.click()} className="cursor-pointer">{children}</span>
    </>
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

  /* add photo modal */
  const [addPhotoSectionId, setAddPhotoSectionId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoNameAr, setPhotoNameAr] = useState('');
  const [photoNameEn, setPhotoNameEn] = useState('');

  /* add section modal */
  const [addSecOpen, setAddSecOpen] = useState(false);
  const [secNameAr, setSecNameAr] = useState('');
  const [secNameEn, setSecNameEn] = useState('');

  /* footer edit */
  const [footerOpen, setFooterOpen] = useState(false);
  const [footerDraft, setFooterDraft] = useState({ ...siteData.footer });

  /* ── handlers ── */
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (user === 'Ayoub' && pass === 'Ayoub@123') {
      setIsAdmin(true); setLoginOpen(false); setUser(''); setPass(''); setLoginErr('');
    } else {
      setLoginErr(isAr ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials');
    }
  };

  const handleAddPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoUrl || !addPhotoSectionId) return;
    const photo: Photo = { id: uid(), image: photoUrl, nameAr: photoNameAr, nameEn: photoNameEn };
    const sections = siteData.sections.map(s =>
      s.id === addPhotoSectionId ? { ...s, photos: [...s.photos, photo] } : s
    );
    updateSiteData({ sections });
    setPhotoUrl(''); setPhotoNameAr(''); setPhotoNameEn(''); setAddPhotoSectionId(null);
    toast.success(isAr ? 'تمت إضافة الصورة' : 'Photo added');
  };

  const handleDeletePhoto = (sectionId: string, photoId: string) => {
    if (!confirm(isAr ? 'حذف الصورة؟' : 'Delete this photo?')) return;
    const sections = siteData.sections.map(s =>
      s.id === sectionId ? { ...s, photos: s.photos.filter(p => p.id !== photoId) } : s
    );
    updateSiteData({ sections });
    toast.success(isAr ? 'تم الحذف' : 'Deleted');
  };

  const handleDeleteSection = (id: string) => {
    if (!confirm(isAr ? 'حذف القسم وجميع صوره؟' : 'Delete this section and all its photos?')) return;
    updateSiteData({ sections: siteData.sections.filter(s => s.id !== id) });
  };

  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secNameAr && !secNameEn) return;
    const sec: Section = { id: uid(), nameAr: secNameAr, nameEn: secNameEn, photos: [] };
    updateSiteData({ sections: [...siteData.sections, sec] });
    setSecNameAr(''); setSecNameEn(''); setAddSecOpen(false);
    toast.success(isAr ? 'تم إضافة القسم' : 'Section added');
  };

  const handleFooterSave = () => {
    updateSiteData({ footer: footerDraft });
    setFooterOpen(false);
    toast.success(isAr ? 'تم حفظ المعلومات' : 'Saved');
  };

  const updateSectionName = (id: string, field: 'nameAr' | 'nameEn', val: string) => {
    const sections = siteData.sections.map(s => s.id === id ? { ...s, [field]: val } : s);
    updateSiteData({ sections });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ── TOP NAV CONTROLS ── */}
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

      {/* hidden admin trigger */}
      {!isAdmin && (
        <button className="no-print fixed top-3 end-3 w-2.5 h-2.5 rounded-full bg-border hover:bg-primary transition-colors z-50"
          onClick={() => setLoginOpen(true)} aria-label="Admin" data-testid="btn-admin-trigger" />
      )}

      {/* ── HEADER ── */}
      <header className="border-b border-border py-10 px-8 md:px-16 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          {siteData.logo.customUrl ? (
            <div className="relative group/logo inline-block">
              <img src={siteData.logo.customUrl} alt="logo" className="w-24 h-24 object-contain rounded-full" />
              {isAdmin && (
                <FileUploadInput onFile={url => updateSiteData({ logo: { customUrl: url } })}>
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <ImagePlus className="w-6 h-6 text-white" />
                  </div>
                </FileUploadInput>
              )}
            </div>
          ) : (
            <div className="relative group/logo">
              <div className="w-20 h-20 rounded-full bg-accent border-2 border-border flex items-center justify-center">
                <LeafSVG />
              </div>
              {isAdmin && (
                <FileUploadInput onFile={url => updateSiteData({ logo: { customUrl: url } })}>
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <ImagePlus className="w-5 h-5 text-white" />
                  </div>
                </FileUploadInput>
              )}
            </div>
          )}
        </div>

        {/* Title AR */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground arabic mb-1">
          {isAdmin
            ? <InlineEdit value={siteData.titleAr} onSave={v => updateSiteData({ titleAr: v })} className="arabic text-3xl md:text-4xl font-bold" />
            : siteData.titleAr}
        </h1>
        {/* Title EN */}
        <p className="text-sm md:text-base text-muted-foreground tracking-widest uppercase latin mb-3">
          {isAdmin
            ? <InlineEdit value={siteData.titleEn} onSave={v => updateSiteData({ titleEn: v })} className="latin text-sm uppercase tracking-widest" />
            : siteData.titleEn}
        </p>

        {/* Ornament */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-14 h-px bg-primary/40" />
          <div className="w-2 h-2 rounded-full bg-primary/60" />
          <div className="w-14 h-px bg-primary/40" />
        </div>
      </header>

      {/* ── SECTIONS ── */}
      <main className="flex-1 px-4 md:px-12 py-10 space-y-16">
        {siteData.sections.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            lang={lang}
            isAdmin={isAdmin}
            onUpdateName={(field, val) => updateSectionName(section.id, field, val)}
            onAddPhoto={() => setAddPhotoSectionId(section.id)}
            onDeletePhoto={(pid) => handleDeletePhoto(section.id, pid)}
            onDeleteSection={() => handleDeleteSection(section.id)}
            onPrintSection={() => printSectionPDF(section, lang)}
          />
        ))}

        {/* Empty state */}
        {siteData.sections.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p>{isAr ? 'لا توجد أقسام بعد' : 'No sections yet'}</p>
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border py-4 px-8 bg-card">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-xs text-muted-foreground text-center">
          {siteData.footer.email && <a href={`mailto:${siteData.footer.email}`} className="hover:text-primary transition-colors">{siteData.footer.email}</a>}
          {siteData.footer.phone && <span dir="ltr">{siteData.footer.phone}</span>}
          {siteData.footer.website && <a href={siteData.footer.website.startsWith('http') ? siteData.footer.website : `https://${siteData.footer.website}`} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors">{siteData.footer.website}</a>}
          {(isAr ? siteData.footer.noteAr : siteData.footer.noteEn) && (
            <span className="text-muted-foreground/70">{isAr ? siteData.footer.noteAr : siteData.footer.noteEn}</span>
          )}
        </div>
      </footer>

      {/* ── ADMIN TOOLBAR ── */}
      {isAdmin && (
        <div className="no-print fixed bottom-5 start-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-4 py-2 rounded-full bg-card/95 backdrop-blur-xl border border-primary/30 shadow-2xl">
          <span className="text-xs font-bold text-primary pe-2 border-e border-border arabic">{isAr ? 'تحرير' : 'Edit'}</span>

          <ToolBtn icon={<FolderPlus className="w-3.5 h-3.5" />} label={isAr ? 'قسم جديد' : 'New Section'} onClick={() => setAddSecOpen(true)} />
          <ToolBtn icon={<Settings className="w-3.5 h-3.5" />} label={isAr ? 'التواصل' : 'Contact'} onClick={() => { setFooterDraft({ ...siteData.footer }); setFooterOpen(true); }} />
          <ToolBtn icon={<FileDown className="w-3.5 h-3.5" />} label="PDF" variant="dark"
            onClick={() => printFullPDF(siteData.sections, siteData.titleAr, siteData.titleEn, lang, siteData.logo.customUrl)} />
          <button onClick={() => setIsAdmin(false)}
            className="flex items-center justify-center w-8 h-8 rounded-full text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── MODALS ── */}

      {/* Login */}
      <Dialog open={loginOpen} onOpenChange={o => { setLoginOpen(o); if (!o) { setUser(''); setPass(''); setLoginErr(''); } }}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl text-center arabic">{isAr ? 'دخول المدير' : 'Admin Login'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{isAr ? 'اسم المستخدم' : 'Username'}</Label>
              <Input value={user} onChange={e => setUser(e.target.value)} dir="ltr" autoComplete="off" data-testid="input-admin-user" />
            </div>
            <div className="space-y-1.5">
              <Label>{isAr ? 'كلمة المرور' : 'Password'}</Label>
              <Input type="password" value={pass} onChange={e => setPass(e.target.value)} dir="ltr" data-testid="input-admin-pass" />
            </div>
            {loginErr && <p className="text-destructive text-sm">{loginErr}</p>}
            <Button type="submit" className="w-full bg-primary text-primary-foreground">
              {isAr ? 'دخول' : 'Login'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add photo */}
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
                <FileUploadInput onFile={b64 => setPhotoUrl(b64)}>
                  <Button type="button" variant="outline" size="sm" className="shrink-0">
                    <ImagePlus className="w-4 h-4" />
                  </Button>
                </FileUploadInput>
              </div>
              {photoUrl && (
                <img src={photoUrl} alt="preview" className="w-full h-40 object-cover rounded-lg mt-2"
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

      {/* Add section */}
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

      {/* Footer edit */}
      <Dialog open={footerOpen} onOpenChange={setFooterOpen}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="arabic">{isAr ? 'معلومات التواصل' : 'Contact Info'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {[
              { key: 'email', label: isAr ? 'البريد الإلكتروني' : 'Email', type: 'email' },
              { key: 'phone', label: isAr ? 'رقم الهاتف' : 'Phone', type: 'tel' },
              { key: 'website', label: isAr ? 'رابط الموقع' : 'Website', type: 'text' },
              { key: 'noteAr', label: isAr ? 'ملاحظة عربية' : 'Note (AR)', type: 'text' },
              { key: 'noteEn', label: isAr ? 'ملاحظة إنجليزية' : 'Note (EN)', type: 'text' },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Input
                  type={f.type}
                  value={footerDraft[f.key as keyof typeof footerDraft]}
                  onChange={e => setFooterDraft({ ...footerDraft, [f.key]: e.target.value })}
                  dir={f.key.endsWith('Ar') ? 'rtl' : 'ltr'}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFooterOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleFooterSave} className="bg-primary text-primary-foreground">{isAr ? 'حفظ' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Section block component ─────────────────────────── */
function SectionBlock({ section, lang, isAdmin, onUpdateName, onAddPhoto, onDeletePhoto, onDeleteSection, onPrintSection }: {
  section: Section; lang: string; isAdmin: boolean;
  onUpdateName: (field: 'nameAr' | 'nameEn', val: string) => void;
  onAddPhoto: () => void; onDeletePhoto: (id: string) => void;
  onDeleteSection: () => void; onPrintSection: () => void;
}) {
  const isAr = lang === 'ar';
  return (
    <section className="w-full max-w-5xl mx-auto">
      {/* Section header */}
      <div className="flex items-center gap-4 mb-7">
        <div className="flex-1 h-px bg-border" />
        <div className="text-center">
          <h2 className="text-xl md:text-2xl font-bold text-foreground arabic">
            {isAdmin
              ? <InlineEdit value={section.nameAr} onSave={v => onUpdateName('nameAr', v)} className="arabic text-xl md:text-2xl font-bold text-foreground" />
              : section.nameAr}
          </h2>
          <p className="text-xs text-muted-foreground tracking-widest uppercase latin mt-0.5">
            {isAdmin
              ? <InlineEdit value={section.nameEn} onSave={v => onUpdateName('nameEn', v)} className="latin text-xs uppercase tracking-widest text-muted-foreground" />
              : section.nameEn}
          </p>
        </div>
        <div className="flex-1 h-px bg-border" />
        {/* Admin actions for section */}
        {isAdmin && (
          <div className="no-print flex items-center gap-1 shrink-0">
            <button onClick={onAddPhoto}
              className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
              title={isAr ? 'إضافة صورة' : 'Add photo'}>
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button onClick={onPrintSection}
              className="h-7 w-7 rounded-full bg-card border border-border text-muted-foreground flex items-center justify-center hover:text-foreground transition-colors"
              title={isAr ? 'طباعة PDF' : 'Print PDF'}>
              <FileDown className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDeleteSection}
              className="h-7 w-7 rounded-full bg-card border border-border text-destructive flex items-center justify-center hover:bg-destructive/10 transition-colors"
              title={isAr ? 'حذف القسم' : 'Delete section'}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Photos grid */}
      {section.photos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border-2 border-dashed border-border rounded-xl">
          {isAr ? 'لا توجد صور في هذا القسم' : 'No photos in this section'}
          {isAdmin && <p className="mt-1 text-primary text-xs">{isAr ? 'اضغط + لإضافة صورة' : 'Press + to add photos'}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 md:gap-7">
          {section.photos.map(photo => (
            <div key={photo.id} className="group relative rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 bg-card aspect-[4/5]">
              <img
                src={photo.image}
                alt={isAr ? photo.nameAr : photo.nameEn}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              {/* Gradient name overlay */}
              {(photo.nameAr || photo.nameEn) && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-10 pb-4 px-4">
                  <p className="text-white text-base font-semibold leading-tight arabic drop-shadow">
                    {isAr ? photo.nameAr : photo.nameEn}
                  </p>
                  {photo.nameAr && photo.nameEn && (
                    <p className="text-white/70 text-xs mt-0.5 latin">
                      {isAr ? photo.nameEn : photo.nameAr}
                    </p>
                  )}
                </div>
              )}
              {/* Admin delete */}
              {isAdmin && (
                <button
                  onClick={() => onDeletePhoto(photo.id)}
                  className="no-print absolute top-2 end-2 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
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

/* ── Small toolbar button ────────────────────────────── */
function ToolBtn({ icon, label, onClick, variant = 'default' }: {
  icon: React.ReactNode; label: string; onClick: () => void; variant?: 'default' | 'dark';
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors ${
        variant === 'dark'
          ? 'bg-foreground text-background hover:bg-foreground/90'
          : 'bg-accent border border-border text-foreground hover:bg-muted'
      }`}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ── Leaf SVG icon ───────────────────────────────────── */
function LeafSVG() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="hsl(27 80% 52%)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}
