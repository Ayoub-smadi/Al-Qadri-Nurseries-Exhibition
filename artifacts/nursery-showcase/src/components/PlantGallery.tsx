import React from 'react';
import { useApp } from '@/lib/context';
import { Plant } from '@/lib/storage';
import { X, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function PlantGallery() {
  const { lang, siteData, isAdmin, updateSiteData, t } = useApp();
  const [editingPlant, setEditingPlant] = React.useState<Plant | null>(null);
  const [newImageUrl, setNewImageUrl] = React.useState('');

  const handleDelete = (id: string) => {
    if (confirm(t.admin.delete_confirm)) {
      const newPlants = siteData.plants.filter(p => p.id !== id);
      updateSiteData({ plants: newPlants });
    }
  };

  const handleUpdatePlantField = (id: string, field: keyof Plant, value: string) => {
    const newPlants = siteData.plants.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    );
    updateSiteData({ plants: newPlants });
  };

  const handleImageUpdate = () => {
    if (editingPlant && newImageUrl) {
      handleUpdatePlantField(editingPlant.id, 'image', newImageUrl);
      setEditingPlant(null);
      setNewImageUrl('');
    }
  };

  return (
    <section className="py-24 bg-secondary/30 relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 font-serif">
            {lang === 'ar' ? siteData.gallery.titleAr : siteData.gallery.titleEn}
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {lang === 'ar' ? siteData.gallery.subtitleAr : siteData.gallery.subtitleEn}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {siteData.plants.map((plant) => (
            <div key={plant.id} className="group relative bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-2 border border-border/50 flex flex-col h-full">
              {isAdmin && (
                <button 
                  onClick={() => handleDelete(plant.id)}
                  className="absolute top-4 right-4 z-20 w-8 h-8 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              
              <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
                <img 
                  src={plant.image} 
                  alt={lang === 'ar' ? plant.nameAr : plant.nameEn}
                  className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                {isAdmin && (
                  <button 
                    onClick={() => { setEditingPlant(plant); setNewImageUrl(plant.image); }}
                    className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center flex-col gap-2 z-10"
                  >
                    <Edit2 className="w-6 h-6" />
                    <span>{t.admin.edit_image}</span>
                  </button>
                )}
              </div>
              
              <div className="p-6 flex flex-col grow">
                <h3 
                  className={`text-xl font-bold mb-2 font-serif ${isAdmin ? 'admin-editable' : ''}`}
                  contentEditable={isAdmin}
                  suppressContentEditableWarning
                  onBlur={(e) => handleUpdatePlantField(plant.id, lang === 'ar' ? 'nameAr' : 'nameEn', e.currentTarget.textContent || '')}
                >
                  {lang === 'ar' ? plant.nameAr : plant.nameEn}
                </h3>
                <p 
                  className={`text-muted-foreground text-sm leading-relaxed grow ${isAdmin ? 'admin-editable' : ''}`}
                  contentEditable={isAdmin}
                  suppressContentEditableWarning
                  onBlur={(e) => handleUpdatePlantField(plant.id, lang === 'ar' ? 'descAr' : 'descEn', e.currentTarget.textContent || '')}
                >
                  {lang === 'ar' ? plant.descAr : plant.descEn}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!editingPlant} onOpenChange={(o) => !o && setEditingPlant(null)}>
        <DialogContent className="glass-panel">
          <DialogHeader>
            <DialogTitle>{t.admin.edit_image}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label>{t.admin.enter_image_url}</label>
              <Input 
                value={newImageUrl} 
                onChange={e => setNewImageUrl(e.target.value)} 
                placeholder="https://..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingPlant(null)}>
                {t.admin.cancel}
              </Button>
              <Button onClick={handleImageUpdate}>
                {t.admin.save_changes}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
