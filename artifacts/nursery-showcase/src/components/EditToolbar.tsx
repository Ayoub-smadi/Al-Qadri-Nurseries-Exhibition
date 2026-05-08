import React from 'react';
import { useApp } from '@/lib/context';
import { Save, Plus, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function EditToolbar() {
  const { isAdmin, setIsAdmin, t, siteData, updateSiteData } = useApp();
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  
  const [newPlant, setNewPlant] = React.useState({
    nameAr: '', nameEn: '', descAr: '', descEn: '', image: ''
  });

  if (!isAdmin) return null;

  const handleSave = () => {
    // Data is already saved to context on blur, but we can show a toast
    toast.success(t.admin.save_success);
  };

  const handleAddPlant = (e: React.FormEvent) => {
    e.preventDefault();
    const plant = {
      id: Date.now().toString(),
      ...newPlant
    };
    
    updateSiteData({
      plants: [plant, ...siteData.plants]
    });
    
    setIsAddOpen(false);
    setNewPlant({ nameAr: '', nameEn: '', descAr: '', descEn: '', image: '' });
    toast.success(t.admin.save_success);
  };

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-panel px-4 py-3 rounded-full flex items-center gap-4 shadow-xl border border-primary/20 animate-in slide-in-from-bottom-10">
        <span className="text-sm font-bold text-primary mr-2 pr-4 border-r border-border hidden md:inline-block">
          {t.admin.edit_mode}
        </span>
        
        <Button onClick={() => setIsAddOpen(true)} variant="outline" size="sm" className="gap-2 rounded-full border-primary/30 hover:bg-primary/10">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t.admin.add_plant}</span>
        </Button>
        
        <Button onClick={handleSave} size="sm" className="gap-2 rounded-full bg-primary hover:bg-primary/90 text-white">
          <Save className="w-4 h-4" />
          <span className="hidden sm:inline">{t.admin.save_changes}</span>
        </Button>
        
        <Button onClick={() => setIsAdmin(false)} variant="ghost" size="sm" className="gap-2 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive">
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">{t.admin.logout}</span>
        </Button>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[600px] glass-panel max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif">{t.admin.add_plant_title}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddPlant} className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.admin.plant_name_ar}</Label>
                <Input required value={newPlant.nameAr} onChange={e => setNewPlant({...newPlant, nameAr: e.target.value})} dir="rtl" />
              </div>
              <div className="space-y-2">
                <Label>{t.admin.plant_name_en}</Label>
                <Input required value={newPlant.nameEn} onChange={e => setNewPlant({...newPlant, nameEn: e.target.value})} dir="ltr" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>{t.admin.plant_desc_ar}</Label>
              <Textarea required value={newPlant.descAr} onChange={e => setNewPlant({...newPlant, descAr: e.target.value})} dir="rtl" />
            </div>
            
            <div className="space-y-2">
              <Label>{t.admin.plant_desc_en}</Label>
              <Textarea required value={newPlant.descEn} onChange={e => setNewPlant({...newPlant, descEn: e.target.value})} dir="ltr" />
            </div>
            
            <div className="space-y-2">
              <Label>{t.admin.plant_image}</Label>
              <Input required value={newPlant.image} onChange={e => setNewPlant({...newPlant, image: e.target.value})} dir="ltr" placeholder="https://..." />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                {t.admin.cancel}
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-white">
                {t.admin.add}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
