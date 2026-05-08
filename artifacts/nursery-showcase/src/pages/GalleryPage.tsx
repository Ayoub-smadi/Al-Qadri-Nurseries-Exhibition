import React from 'react';
import { useApp, Language } from '@/lib/context';
import { Photo } from '@/lib/storage';
import { toast } from 'sonner';
import { X, Plus, Download, LogOut, Settings, Globe, ImagePlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function GalleryPage() {
  const { lang, setLang, isAdmin, setIsAdmin, siteData, updateSiteData } = useApp();

  /* ── Admin login state ── */
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [user, setUser] = React.useState('');
  const [pass, setPass] = React.useState('');
  const [loginErr, setLoginErr] = React.useState('');

  /* ── Add photo state ── */
  const [addOpen, setAddOpen] = React.useState(false);
  const [newPhoto, setNewPhoto] = React.useState({ image: '', nameAr: '', nameEn: '' });

  /* ── Logo dialog ── */
  const [logoOpen, setLogoOpen] = React.useState(false);
  const [logoUrl, setLogoUrl] = React.useState('');

  /* ── Footer edit ── */
  const [footerOpen, setFooterOpen] = React.useState(false);
  const [footerDraft, setFooterDraft] = React.useState({ ...siteData.footer });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (user === 'Ayoub' && pass === 'Ayoub@123') {
      setIsAdmin(true);
      setLoginOpen(false);
      setUser(''); setPass(''); setLoginErr('');
    } else {
      setLoginErr(lang === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials');
    }
  };

  const handleAddPhoto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhoto.image) return;
    const photo: Photo = { id: `ph-${Date.now()}`, ...newPhoto };
    updateSiteData({ photos: [...siteData.photos, photo] });
    setAddOpen(false);
    setNewPhoto({ image: '', nameAr: '', nameEn: '' });
    toast.success(lang === 'ar' ? 'تمت إضافة الصورة' : 'Photo added');
  };

  const handleDelete = (id: string) => {
    if (!confirm(lang === 'ar' ? 'حذف الصورة؟' : 'Delete photo?')) return;
    updateSiteData({ photos: siteData.photos.filter(p => p.id !== id) });
    toast.success(lang === 'ar' ? 'تم الحذف' : 'Deleted');
  };

  const handleLogoSave = () => {
    updateSiteData({ logo: { customUrl: logoUrl } });
    setLogoOpen(false);
    toast.success(lang === 'ar' ? 'تم تحديث اللوجو' : 'Logo updated');
  };

  const handleFooterSave = () => {
    updateSiteData({ footer: footerDraft });
    setFooterOpen(false);
    toast.success(lang === 'ar' ? 'تم حفظ معلومات التواصل' : 'Contact info saved');
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const toggleLang = () => setLang(lang === 'ar' ? 'en' : 'ar');

  return (
    <div className="min-h-screen bg-white flex flex-col print-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>

      {/* ── PAGE HEADER ─────────────────────────────────── */}
      <header className="print-header border-b border-border/50 py-8 px-8 md:px-16">
        <div className="flex flex-col items-center gap-3 text-center">

          {/* Logo */}
          <div className="flex items-center justify-center">
            {siteData.logo.customUrl ? (
              <img
                src={siteData.logo.customUrl}
                alt="logo"
                className="w-20 h-20 object-contain"
                data-testid="header-logo-img"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200/60 flex items-center justify-center">
                <LeafSVG />
              </div>
            )}
          </div>

          {/* Name bilingual */}
          <div className="space-y-1">
            <h1
              className="text-2xl md:text-3xl font-bold tracking-tight text-foreground"
              style={{ fontFamily: "'Cairo', sans-serif" }}
              data-testid="header-title-ar"
            >
              مشاتل القادري الزراعية
            </h1>
            <p
              className="text-base md:text-lg text-muted-foreground tracking-widest uppercase"
              style={{ fontFamily: "'Cormorant Garamond', serif", letterSpacing: '0.12em' }}
              data-testid="header-title-en"
            >
              Al-Qadri Agricultural Nurseries
            </p>
          </div>

          {/* Ornament */}
          <div className="flex items-center gap-3 pt-1">
            <div className="w-12 h-px bg-amber-300/60" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <div className="w-12 h-px bg-amber-300/60" />
          </div>
        </div>
      </header>

      {/* ── GALLERY SECTION ─────────────────────────────── */}
      <main className="flex-1 px-6 md:px-12 py-10">

        {/* Section title */}
        <div className="text-center mb-10">
          <h2
            className="text-xl md:text-2xl font-semibold text-foreground/80 mb-1"
            style={{ fontFamily: lang === 'ar' ? "'Cairo', sans-serif" : "'Cormorant Garamond', serif" }}
            data-testid="gallery-title"
          >
            {lang === 'ar' ? 'معرض صور مشاتل القادري' : 'Al-Qadri Nurseries Photo Gallery'}
          </h2>
          <div className="flex items-center justify-center gap-3 mt-2">
            <div className="w-8 h-px bg-amber-300/50" />
            <div className="w-1 h-1 rounded-full bg-amber-400/70" />
            <div className="w-8 h-px bg-amber-300/50" />
          </div>
        </div>

        {/* Photo grid */}
        {siteData.photos.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <p>{lang === 'ar' ? 'لا توجد صور بعد' : 'No photos yet'}</p>
            {isAdmin && (
              <p className="text-sm mt-2 text-primary">
                {lang === 'ar' ? 'اضغط "إضافة صورة" للبدء' : 'Click "Add Photo" to start'}
              </p>
            )}
          </div>
        ) : (
          <div
            className="photo-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-5"
            data-testid="photo-grid"
          >
            {siteData.photos.map((photo, idx) => (
              <div
                key={photo.id}
                className="photo-card group relative rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 bg-gray-50 aspect-square"
                data-testid={`photo-card-${photo.id}`}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <img
                  src={photo.image}
                  alt={lang === 'ar' ? photo.nameAr : photo.nameEn}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                {/* Name overlay */}
                {(photo.nameAr || photo.nameEn) && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-3">
                    <p className="text-white text-sm font-medium leading-tight">
                      {lang === 'ar' ? photo.nameAr : photo.nameEn}
                    </p>
                  </div>
                )}

                {/* Admin: delete button */}
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(photo.id)}
                    className="absolute top-2 end-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md no-print"
                    data-testid={`btn-delete-photo-${photo.id}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <footer className="print-footer border-t border-border/40 py-3 px-8 bg-white">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-xs text-muted-foreground">
          {siteData.footer.email && (
            <a href={`mailto:${siteData.footer.email}`} className="hover:text-primary transition-colors">
              {siteData.footer.email}
            </a>
          )}
          {siteData.footer.phone && (
            <span dir="ltr">{siteData.footer.phone}</span>
          )}
          {siteData.footer.website && (
            <a
              href={siteData.footer.website.startsWith('http') ? siteData.footer.website : `https://${siteData.footer.website}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary transition-colors"
            >
              {siteData.footer.website}
            </a>
          )}
        </div>
      </footer>

      {/* ── TOP CONTROLS (no-print) ─────────────────────── */}
      <div className="no-print fixed top-3 start-3 flex items-center gap-2 z-50">
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="h-8 px-3 rounded-full bg-white/90 border border-border/60 shadow-sm text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white transition-all"
          data-testid="btn-lang"
        >
          {lang === 'ar' ? 'EN' : 'ع'}
        </button>
      </div>

      {/* Hidden admin trigger (no-print) */}
      {!isAdmin && (
        <button
          className="no-print fixed top-3 end-3 w-2 h-2 rounded-full bg-foreground/20 hover:bg-foreground/60 transition-colors z-50"
          onClick={() => setLoginOpen(true)}
          aria-label="Admin login"
          data-testid="btn-admin-trigger"
        />
      )}

      {/* ── ADMIN TOOLBAR (no-print) ────────────────────── */}
      {isAdmin && (
        <div className="no-print fixed bottom-5 start-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/90 backdrop-blur-xl border border-amber-200/60 shadow-xl">
          <span className="text-xs font-bold text-amber-600 pe-3 border-e border-border">
            {lang === 'ar' ? 'وضع التحرير' : 'Edit Mode'}
          </span>

          {/* Add photo */}
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
            data-testid="btn-add-photo"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'إضافة صورة' : 'Add Photo'}</span>
          </button>

          {/* Change logo */}
          <button
            onClick={() => { setLogoUrl(siteData.logo.customUrl); setLogoOpen(true); }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
            data-testid="btn-change-logo"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'اللوجو' : 'Logo'}</span>
          </button>

          {/* Edit footer */}
          <button
            onClick={() => { setFooterDraft({ ...siteData.footer }); setFooterOpen(true); }}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors"
            data-testid="btn-edit-footer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{lang === 'ar' ? 'التواصل' : 'Contact'}</span>
          </button>

          {/* Download PDF */}
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors"
            data-testid="btn-download-pdf"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          {/* Logout */}
          <button
            onClick={() => setIsAdmin(false)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors"
            data-testid="btn-logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── MODALS ──────────────────────────────────────── */}

      {/* Login modal */}
      <Dialog open={loginOpen} onOpenChange={o => { setLoginOpen(o); if (!o) { setUser(''); setPass(''); setLoginErr(''); } }}>
        <DialogContent className="sm:max-w-sm bg-white border border-border/60 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-center" style={{ fontFamily: lang === 'ar' ? "'Cairo', sans-serif" : undefined }}>
              {lang === 'ar' ? 'دخول المدير' : 'Admin Login'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'اسم المستخدم' : 'Username'}</Label>
              <Input value={user} onChange={e => setUser(e.target.value)} dir="ltr" autoComplete="off" data-testid="input-admin-user" />
            </div>
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'كلمة المرور' : 'Password'}</Label>
              <Input type="password" value={pass} onChange={e => setPass(e.target.value)} dir="ltr" data-testid="input-admin-pass" />
            </div>
            {loginErr && <p className="text-destructive text-sm">{loginErr}</p>}
            <Button type="submit" className="w-full bg-primary text-white hover:bg-primary/90" data-testid="btn-login-submit">
              {lang === 'ar' ? 'دخول' : 'Login'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add photo modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-border/60 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl" style={{ fontFamily: lang === 'ar' ? "'Cairo', sans-serif" : undefined }}>
              {lang === 'ar' ? 'إضافة صورة' : 'Add Photo'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPhoto} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'رابط الصورة' : 'Image URL'}</Label>
              <Input required value={newPhoto.image} onChange={e => setNewPhoto({ ...newPhoto, image: e.target.value })} dir="ltr" placeholder="https://..." data-testid="input-photo-url" />
            </div>
            {newPhoto.image && (
              <img src={newPhoto.image} alt="preview" className="w-full h-36 object-cover rounded-lg" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{lang === 'ar' ? 'الاسم عربي' : 'Name (AR)'}</Label>
                <Input value={newPhoto.nameAr} onChange={e => setNewPhoto({ ...newPhoto, nameAr: e.target.value })} dir="rtl" />
              </div>
              <div className="space-y-1.5">
                <Label>{lang === 'ar' ? 'الاسم إنجليزي' : 'Name (EN)'}</Label>
                <Input value={newPhoto.nameEn} onChange={e => setNewPhoto({ ...newPhoto, nameEn: e.target.value })} dir="ltr" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" className="bg-primary text-white hover:bg-primary/90">
                {lang === 'ar' ? 'إضافة' : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Logo modal */}
      <Dialog open={logoOpen} onOpenChange={setLogoOpen}>
        <DialogContent className="sm:max-w-sm bg-white border border-border/60 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl" style={{ fontFamily: lang === 'ar' ? "'Cairo', sans-serif" : undefined }}>
              {lang === 'ar' ? 'تغيير اللوجو' : 'Change Logo'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'رابط الصورة' : 'Image URL'}</Label>
              <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} dir="ltr" placeholder="https://..." />
            </div>
            {logoUrl && (
              <img src={logoUrl} alt="preview" className="w-20 h-20 object-contain rounded-full mx-auto border border-border/50" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setLogoOpen(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleLogoSave} className="bg-primary text-white hover:bg-primary/90">{lang === 'ar' ? 'حفظ' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer edit modal */}
      <Dialog open={footerOpen} onOpenChange={setFooterOpen}>
        <DialogContent className="sm:max-w-sm bg-white border border-border/60 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl" style={{ fontFamily: lang === 'ar' ? "'Cairo', sans-serif" : undefined }}>
              {lang === 'ar' ? 'معلومات التواصل' : 'Contact Info'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</Label>
              <Input value={footerDraft.email} onChange={e => setFooterDraft({ ...footerDraft, email: e.target.value })} dir="ltr" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'رقم الهاتف' : 'Phone'}</Label>
              <Input value={footerDraft.phone} onChange={e => setFooterDraft({ ...footerDraft, phone: e.target.value })} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label>{lang === 'ar' ? 'رابط الموقع' : 'Website'}</Label>
              <Input value={footerDraft.website} onChange={e => setFooterDraft({ ...footerDraft, website: e.target.value })} dir="ltr" placeholder="www.example.com" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setFooterOpen(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Button>
              <Button onClick={handleFooterSave} className="bg-primary text-white hover:bg-primary/90">{lang === 'ar' ? 'حفظ' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeafSVG() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="hsl(27 80% 52%)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  );
}
