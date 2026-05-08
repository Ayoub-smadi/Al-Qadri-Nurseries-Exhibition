import React from 'react';
import { useParams, useLocation } from 'wouter';
import { useApp } from '@/lib/context';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { EditToolbar } from '@/components/EditToolbar';
import { Plant } from '@/lib/storage';
import { X, Edit2, ArrowLeft, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function CategoryPage() {
  const { id } = useParams<{ id: string }>();
  const { lang, siteData, isAdmin, updateSiteData, t } = useApp();
  const [, setLocation] = useLocation();
  const [editingPlantId, setEditingPlantId] = React.useState<string | null>(null);
  const [newImageUrl, setNewImageUrl] = React.useState('');

  const category = siteData.categories.find(c => c.id === id);
  const BackArrow = lang === 'ar' ? ArrowRight : ArrowLeft;

  if (!category) {
    return (
      <main className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">{lang === 'ar' ? 'التصنيف غير موجود' : 'Category not found'}</p>
            <Button onClick={() => setLocation('/')} variant="outline">{lang === 'ar' ? 'العودة' : 'Go back'}</Button>
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  const handleDeletePlant = (plantId: string) => {
    if (!confirm(t.admin.delete_confirm)) return;
    updateSiteData({
      categories: siteData.categories.map(c =>
        c.id === id ? { ...c, plants: c.plants.filter(p => p.id !== plantId) } : c
      ),
    });
  };

  const updatePlantField = (plantId: string, field: keyof Plant, value: string) => {
    updateSiteData({
      categories: siteData.categories.map(c =>
        c.id === id
          ? { ...c, plants: c.plants.map(p => p.id === plantId ? { ...p, [field]: value } : p) }
          : c
      ),
    });
  };

  const handleImageUpdate = () => {
    if (!editingPlantId || !newImageUrl) return;
    updatePlantField(editingPlantId, 'image', newImageUrl);
    setEditingPlantId(null);
    setNewImageUrl('');
  };

  const editingPlant = category.plants.find(p => p.id === editingPlantId);

  return (
    <main className="min-h-screen w-full flex flex-col">
      <Navbar />
      <div className="pt-16 flex-1">

        {/* Category hero banner */}
        <div className="relative h-64 md:h-80 overflow-hidden">
          <img
            src={category.image}
            alt={lang === 'ar' ? category.nameAr : category.nameEn}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/30 to-foreground/10" />

          {/* Back button */}
          <button
            onClick={() => setLocation('/')}
            className="absolute top-5 start-5 flex items-center gap-2 text-white/90 hover:text-white transition-colors bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-full px-4 py-2 text-sm"
            data-testid="btn-back"
          >
            <BackArrow className="w-4 h-4" />
            <span>{t.nav.backToHome}</span>
          </button>

          {/* Category title */}
          <div className="absolute bottom-0 inset-x-0 p-8 text-white">
            <h1
              className="text-4xl md:text-5xl font-bold mb-2 animate-in fade-in slide-in-from-bottom-4 duration-700"
              style={{ fontFamily: lang === 'ar' ? 'var(--app-font-arabic)' : 'var(--app-font-serif)' }}
            >
              {lang === 'ar' ? category.nameAr : category.nameEn}
            </h1>
            <p className="text-white/75 text-base max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              {lang === 'ar' ? category.descAr : category.descEn}
            </p>
          </div>
        </div>

        {/* Plants grid */}
        <section className="py-16 container mx-auto px-6">
          {category.plants.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground">
              <p className="text-lg">
                {lang === 'ar' ? 'لا توجد نباتات في هذا التصنيف بعد' : 'No plants in this category yet'}
              </p>
              {isAdmin && (
                <p className="text-sm mt-2 text-primary">
                  {lang === 'ar' ? 'استخدم زر "نبتة جديدة" لإضافة نباتات' : 'Use "New Plant" button to add plants'}
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-7">
              {category.plants.map((plant, idx) => (
                <div
                  key={plant.id}
                  className="group relative bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-2 border border-border/40 flex flex-col"
                  data-testid={`card-plant-${plant.id}`}
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  {/* Delete (admin) */}
                  {isAdmin && (
                    <button
                      onClick={() => handleDeletePlant(plant.id)}
                      className="absolute top-3 end-3 z-20 w-7 h-7 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      data-testid={`btn-delete-plant-${plant.id}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Image */}
                  <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
                    <img
                      src={plant.image}
                      alt={lang === 'ar' ? plant.nameAr : plant.nameEn}
                      className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-108"
                      loading="lazy"
                    />
                    {isAdmin && (
                      <button
                        onClick={() => { setEditingPlantId(plant.id); setNewImageUrl(plant.image); }}
                        className="absolute inset-0 bg-black/35 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-10"
                        data-testid={`btn-edit-plant-image-${plant.id}`}
                      >
                        <Edit2 className="w-5 h-5" />
                        <span className="text-xs">{t.admin.edit_image}</span>
                      </button>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-5 flex flex-col grow">
                    <h3
                      className={`text-lg font-bold mb-1.5 leading-snug ${isAdmin ? 'admin-editable' : ''}`}
                      style={{ fontFamily: lang === 'ar' ? 'var(--app-font-arabic)' : 'var(--app-font-serif)' }}
                      contentEditable={isAdmin}
                      suppressContentEditableWarning
                      onBlur={e => updatePlantField(plant.id, lang === 'ar' ? 'nameAr' : 'nameEn', e.currentTarget.textContent || '')}
                    >
                      {lang === 'ar' ? plant.nameAr : plant.nameEn}
                    </h3>
                    <p
                      className={`text-muted-foreground text-sm leading-relaxed grow ${isAdmin ? 'admin-editable' : ''}`}
                      contentEditable={isAdmin}
                      suppressContentEditableWarning
                      onBlur={e => updatePlantField(plant.id, lang === 'ar' ? 'descAr' : 'descEn', e.currentTarget.textContent || '')}
                    >
                      {lang === 'ar' ? plant.descAr : plant.descEn}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <Footer />
      </div>
      <EditToolbar />

      {/* Image edit dialog */}
      <Dialog open={!!editingPlantId} onOpenChange={o => !o && setEditingPlantId(null)}>
        <DialogContent className="glass-panel sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.admin.edit_image}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-3">
            {editingPlant && (
              <img
                src={newImageUrl || editingPlant.image}
                alt="preview"
                className="w-full h-40 object-cover rounded-xl"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <Input value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} placeholder="https://..." dir="ltr" />
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setEditingPlantId(null)}>{t.admin.cancel}</Button>
              <Button onClick={handleImageUpdate} className="bg-primary text-primary-foreground hover:bg-primary/90">{t.admin.save_changes}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
