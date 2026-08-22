import { useState } from 'react';
import { ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { AgriStoreCategory, AgriStoreProduct, uploadImage } from '@/lib/storage';
import { useApp } from '@/lib/context';
import { toast } from 'sonner';

const categories: { id: AgriStoreCategory; ar: string }[] = [
  { id: 'tools', ar: 'عدد زراعية' }, { id: 'fertilizers', ar: 'أسمدة' },
  { id: 'pesticides', ar: 'مبيدات' }, { id: 'irrigation', ar: 'شبكات ري' },
];
const empty = (): AgriStoreProduct => ({ id: `store-${Date.now()}`, category: 'tools', image: '', nameAr: '', nameEn: '', descriptionAr: '', descriptionEn: '', price: 0 });

export function AdminAgriProductsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { siteData, updateSiteData } = useApp();
  const [editing, setEditing] = useState<AgriStoreProduct | null>(null);
  const [uploading, setUploading] = useState(false);
  if (!open) return null;
  const products = siteData.agriStoreProducts ?? [];
  const save = () => {
    if (!editing?.nameAr.trim() || !editing.image) { toast.error('أدخل اسم المنتج وأضف صورة'); return; }
    const next = products.some(p => p.id === editing.id) ? products.map(p => p.id === editing.id ? editing : p) : [...products, editing];
    updateSiteData({ agriStoreProducts: next }); setEditing(null);
  };
  const pickImage = async (file?: File) => {
    if (!file) return; setUploading(true);
    try { const image = await uploadImage(file); setEditing(p => p ? { ...p, image } : p); }
    catch { toast.error('فشل رفع الصورة'); } finally { setUploading(false); }
  };
  return <div className="fixed inset-0 z-[75] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
    <div className="bg-card w-full sm:max-w-3xl max-h-[92vh] rounded-t-3xl sm:rounded-3xl overflow-y-auto shadow-2xl">
      <div className="p-4 border-b flex justify-between items-center"><div><h2 className="font-bold arabic">إدارة منتجات المواد الزراعية</h2><p className="text-xs text-muted-foreground arabic">أضف المنتجات مع صورها وأسعارها ليظهر السعر جاهزاً للعميل</p></div><button onClick={onClose}><X className="w-5 h-5" /></button></div>
      <div className="p-4 space-y-3">
        <button onClick={() => setEditing(empty())} className="w-full rounded-xl bg-primary text-primary-foreground py-2 font-bold arabic"><Plus className="w-4 h-4 inline me-1" />إضافة منتج</button>
        {products.map(p => <div key={p.id} className="flex items-center gap-3 border rounded-xl p-2">
          <img src={p.image} alt="" className="w-14 h-14 rounded-lg object-cover bg-muted" /><div className="flex-1"><b className="arabic">{p.nameAr}</b><p className="text-xs text-primary">{Number(p.price).toFixed(2)} د.أ · {categories.find(c => c.id === p.category)?.ar}</p></div>
          <button onClick={() => setEditing(p)} className="p-2 text-primary"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => updateSiteData({ agriStoreProducts: products.filter(x => x.id !== p.id) })} className="p-2 text-destructive"><Trash2 className="w-4 h-4" /></button>
        </div>)}
        {editing && <div className="border-t pt-4 space-y-3">
          <h3 className="font-bold arabic">{products.some(p => p.id === editing.id) ? 'تعديل المنتج' : 'منتج جديد'}</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={editing.nameAr} onChange={e => setEditing({ ...editing, nameAr: e.target.value })} placeholder="اسم المنتج بالعربي *" className="rounded-xl border bg-background p-2.5 arabic" />
            <input value={editing.nameEn} onChange={e => setEditing({ ...editing, nameEn: e.target.value })} placeholder="Product name" className="rounded-xl border bg-background p-2.5" />
            <select value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value as AgriStoreCategory })} className="rounded-xl border bg-background p-2.5 arabic">{categories.map(c => <option key={c.id} value={c.id}>{c.ar}</option>)}</select>
            <input type="number" min="0" step="0.01" value={editing.price} onChange={e => setEditing({ ...editing, price: Number(e.target.value) })} placeholder="السعر بالدينار *" className="rounded-xl border bg-background p-2.5 arabic" />
            <textarea value={editing.descriptionAr} onChange={e => setEditing({ ...editing, descriptionAr: e.target.value })} placeholder="وصف المنتج" className="rounded-xl border bg-background p-2.5 arabic sm:col-span-2" />
          </div>
          <div className="flex items-center gap-3"><label className="cursor-pointer rounded-xl border border-dashed p-3 text-sm arabic"><ImagePlus className="w-4 h-4 inline me-1" />{uploading ? 'جاري الرفع...' : 'اختيار صورة'}<input type="file" accept="image/*" className="hidden" onChange={e => pickImage(e.target.files?.[0])} /></label>{editing.image && <img src={editing.image} alt="" className="w-16 h-16 rounded-lg object-cover" />}</div>
          <div className="flex gap-2"><button onClick={save} disabled={uploading} className="flex-1 rounded-xl bg-primary text-primary-foreground py-2 font-bold arabic">حفظ المنتج</button><button onClick={() => setEditing(null)} className="rounded-xl border px-5 py-2 arabic">إلغاء</button></div>
        </div>}
      </div>
    </div>
  </div>;
}