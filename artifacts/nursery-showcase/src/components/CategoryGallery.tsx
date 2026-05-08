import React from 'react';
import { useApp } from '@/lib/context';
import { Category } from '@/lib/storage';
import { X, Edit2, ArrowLeft, ArrowRight } from 'lucide-react';
import { useLocation } from 'wouter';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function CategoryGallery() {
  const { lang, siteData, isAdmin, updateSiteData, t } = useApp();
  const [, setLocation] = useLocation();
  const [editingCatId, setEditingCatId] = React.useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = React.useState('');

  const handleDelete = (id: string) => {
    if (!confirm(t.admin.delete_confirm)) return;
    updateSiteData({ categories: siteData.categories.filter(c => c.id !== id) });
  };

  const handleImageUpdate = () => {
    if (!editingCatId || !newImageUrl) return;
    updateSiteData({
      categories: siteData.categories.map(c =>
        c.id === editingCatId ? { ...c, image: newImageUrl } : c
      ),
    });
    setEditingCatId(null);
    setNewImageUrl('');
  };

  const updateCatField = (id: string, field: keyof Category, value: string) => {
    updateSiteData({
      categories: siteData.categories.map(c =>
        c.id === id ? { ...c, [field]: value } : c
      ),
    });
  };

  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;
  const editingCat = siteData.categories.find(c => c.id === editingCatId);

  return (
    <section className="py-20 relative" id="categories">
      <div className="container mx-auto px-6">

        {/* Section header */}
        <div className="text-center mb-14">
          <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase mb-3">
            {lang === 'ar' ? 'مجموعاتنا' : 'Our Collections'}
          </p>
          <h2
            className="text-4xl md:text-5xl font-bold mb-3"
            style={{ fontFamily: lang === 'ar' ? 'var(--app-font-arabic)' : 'var(--app-font-serif)' }}
          >
            {lang === 'ar' ? 'تصنيفات نباتاتنا' : t.categories.title}
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            {t.categories.subtitle}
          </p>
        </div>

        {/* Category grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {siteData.categories.map((cat, idx) => (
            <div
              key={cat.id}
              className="group relative rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 bg-card border border-border/40"
              data-testid={`card-category-${cat.id}`}
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {/* Delete button (admin) */}
              {isAdmin && (
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(cat.id); }}
                  className="absolute top-3 end-3 z-30 w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  data-testid={`btn-delete-category-${cat.id}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Image */}
              <div
                className="relative aspect-[4/5] overflow-hidden bg-secondary"
                onClick={() => setLocation(`/category/${cat.id}`)}
              >
                <img
                  src={cat.image}
                  alt={lang === 'ar' ? cat.nameAr : cat.nameEn}
                  className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-108"
                  loading="lazy"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/10 to-transparent transition-opacity duration-500 group-hover:from-foreground/90" />

                {/* Edit image (admin) */}
                {isAdmin && (
                  <button
                    onClick={e => { e.stopPropagation(); setEditingCatId(cat.id); setNewImageUrl(cat.image); }}
                    className="absolute inset-0 bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center flex-col gap-2 z-10"
                    data-testid={`btn-edit-image-${cat.id}`}
                  >
                    <Edit2 className="w-5 h-5" />
                    <span className="text-xs">{t.admin.edit_image}</span>
                  </button>
                )}

                {/* Text overlay */}
                <div
                  className="absolute bottom-0 inset-x-0 p-5 text-white z-20 pointer-events-none"
                  onClick={() => setLocation(`/category/${cat.id}`)}
                >
                  <h3
                    className={`text-xl font-bold mb-1 leading-tight ${isAdmin ? 'pointer-events-auto admin-editable' : ''}`}
                    style={{ fontFamily: lang === 'ar' ? 'var(--app-font-arabic)' : 'var(--app-font-serif)' }}
                    contentEditable={isAdmin}
                    suppressContentEditableWarning
                    onBlur={e => updateCatField(cat.id, lang === 'ar' ? 'nameAr' : 'nameEn', e.currentTarget.textContent || '')}
                    onClick={e => isAdmin && e.stopPropagation()}
                  >
                    {lang === 'ar' ? cat.nameAr : cat.nameEn}
                  </h3>
                  <p
                    className={`text-white/75 text-xs leading-relaxed line-clamp-2 ${isAdmin ? 'pointer-events-auto admin-editable' : ''}`}
                    contentEditable={isAdmin}
                    suppressContentEditableWarning
                    onBlur={e => updateCatField(cat.id, lang === 'ar' ? 'descAr' : 'descEn', e.currentTarget.textContent || '')}
                    onClick={e => isAdmin && e.stopPropagation()}
                  >
                    {lang === 'ar' ? cat.descAr : cat.descEn}
                  </p>
                </div>
              </div>

              {/* Card footer */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer"
                onClick={() => setLocation(`/category/${cat.id}`)}
              >
                <span className="text-xs text-muted-foreground">
                  {cat.plants.length} {t.categories.plantsCount}
                </span>
                <div className="flex items-center gap-1.5 text-primary text-sm font-medium group/btn">
                  <span>{t.categories.exploreBtn}</span>
                  <ArrowIcon className="w-4 h-4 transition-transform group-hover/btn:translate-x-1 rtl:group-hover/btn:-translate-x-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Image edit dialog */}
      <Dialog open={!!editingCatId} onOpenChange={o => !o && setEditingCatId(null)}>
        <DialogContent className="glass-panel sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.admin.edit_image}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-3">
            {editingCat && (
              <img
                src={newImageUrl || editingCat.image}
                alt="preview"
                className="w-full h-40 object-cover rounded-xl"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <Input
              value={newImageUrl}
              onChange={e => setNewImageUrl(e.target.value)}
              placeholder="https://..."
              dir="ltr"
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditingCatId(null)}>{t.admin.cancel}</Button>
              <Button onClick={handleImageUpdate} className="bg-primary text-primary-foreground hover:bg-primary/90">{t.admin.save_changes}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
