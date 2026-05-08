import React from 'react';
import { useApp } from '@/lib/context';
import { Save, Plus, LogOut, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRoute } from 'wouter';

export function EditToolbar() {
  const { isAdmin, setIsAdmin, t, siteData, updateSiteData, lang } = useApp();
  const [isCatOpen, setIsCatOpen] = React.useState(false);
  const [isPlantOpen, setIsPlantOpen] = React.useState(false);
  const [catMatch, catParams] = useRoute('/category/:id');
  const activeCatId = catMatch ? catParams?.id : null;

  const [newCat, setNewCat] = React.useState({ nameAr: '', nameEn: '', descAr: '', descEn: '', image: '' });
  const [newPlant, setNewPlant] = React.useState({ nameAr: '', nameEn: '', descAr: '', descEn: '', image: '' });

  if (!isAdmin) return null;

  const handleSave = () => {
    toast.success(t.admin.save_success);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `cat-${Date.now()}`;
    updateSiteData({
      categories: [
        ...siteData.categories,
        { id, ...newCat, plants: [] },
      ],
    });
    setIsCatOpen(false);
    setNewCat({ nameAr: '', nameEn: '', descAr: '', descEn: '', image: '' });
    toast.success(t.admin.save_success);
  };

  const handleAddPlant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCatId) return;
    const plant = { id: `plant-${Date.now()}`, ...newPlant };
    updateSiteData({
      categories: siteData.categories.map(c =>
        c.id === activeCatId ? { ...c, plants: [...c.plants, plant] } : c
      ),
    });
    setIsPlantOpen(false);
    setNewPlant({ nameAr: '', nameEn: '', descAr: '', descEn: '', image: '' });
    toast.success(t.admin.save_success);
  };

  return (
    <>
      <div className="fixed bottom-6 start-1/2 -translate-x-1/2 z-50 glass-panel px-4 py-2.5 rounded-full flex items-center gap-3 shadow-2xl border border-primary/25 animate-in slide-in-from-bottom-10">
        <span className="text-xs font-bold text-primary ps-2 pe-3 border-e border-border hidden md:inline-block">
          {t.admin.edit_mode}
        </span>

        {/* Add category (only on home) */}
        {!activeCatId && (
          <Button
            onClick={() => setIsCatOpen(true)}
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full border-primary/30 hover:bg-primary/10 text-xs h-8"
            data-testid="btn-add-category"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.admin.add_category}</span>
          </Button>
        )}

        {/* Add plant (only inside a category) */}
        {activeCatId && (
          <Button
            onClick={() => setIsPlantOpen(true)}
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full border-primary/30 hover:bg-primary/10 text-xs h-8"
            data-testid="btn-add-plant"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.admin.add_plant}</span>
          </Button>
        )}

        <Button
          onClick={handleSave}
          size="sm"
          className="gap-1.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-8"
          data-testid="btn-save"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.admin.save_changes}</span>
        </Button>

        <Button
          onClick={() => setIsAdmin(false)}
          variant="ghost"
          size="sm"
          className="gap-1.5 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-8"
          data-testid="btn-logout"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t.admin.logout}</span>
        </Button>
      </div>

      {/* Add Category Dialog */}
      <Dialog open={isCatOpen} onOpenChange={setIsCatOpen}>
        <DialogContent className="glass-panel sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{t.admin.add_category_title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCategory} className="space-y-4 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.admin.name_ar}</Label>
                <Input required dir="rtl" value={newCat.nameAr} onChange={e => setNewCat({ ...newCat, nameAr: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.admin.name_en}</Label>
                <Input required dir="ltr" value={newCat.nameEn} onChange={e => setNewCat({ ...newCat, nameEn: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.desc_ar}</Label>
              <Textarea dir="rtl" value={newCat.descAr} onChange={e => setNewCat({ ...newCat, descAr: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.desc_en}</Label>
              <Textarea dir="ltr" value={newCat.descEn} onChange={e => setNewCat({ ...newCat, descEn: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.image_url}</Label>
              <Input dir="ltr" value={newCat.image} onChange={e => setNewCat({ ...newCat, image: e.target.value })} placeholder="https://..." />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCatOpen(false)}>{t.admin.cancel}</Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">{t.admin.add}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Plant Dialog */}
      <Dialog open={isPlantOpen} onOpenChange={setIsPlantOpen}>
        <DialogContent className="glass-panel sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{t.admin.add_plant_title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPlant} className="space-y-4 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t.admin.name_ar}</Label>
                <Input required dir="rtl" value={newPlant.nameAr} onChange={e => setNewPlant({ ...newPlant, nameAr: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t.admin.name_en}</Label>
                <Input required dir="ltr" value={newPlant.nameEn} onChange={e => setNewPlant({ ...newPlant, nameEn: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.desc_ar}</Label>
              <Textarea dir="rtl" value={newPlant.descAr} onChange={e => setNewPlant({ ...newPlant, descAr: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.desc_en}</Label>
              <Textarea dir="ltr" value={newPlant.descEn} onChange={e => setNewPlant({ ...newPlant, descEn: e.target.value })} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.image_url}</Label>
              <Input dir="ltr" value={newPlant.image} onChange={e => setNewPlant({ ...newPlant, image: e.target.value })} placeholder="https://..." />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPlantOpen(false)}>{t.admin.cancel}</Button>
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">{t.admin.add}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
