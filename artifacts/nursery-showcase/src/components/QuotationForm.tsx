import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { loadSavedToken } from '@/lib/storage';
import {
  Plus, FileText, Save, Wand2, Trash2, CheckCircle2,
  Phone, Mail, Globe, RotateCcw, MessageCircle,
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type Item = {
  id: string; name: string; description: string; category: string;
  quantity: number; unit: string; price: number; total: number; imageUrl?: string;
};

type Headers = {
  index: string; image: string; name: string; description: string;
  category: string; quantity: string; price: string; total: string;
};

type Details = {
  quotationNumber: string; customerName: string;
  companyNameAr: string; companyLocationAr: string;
  companyNameEn: string; companyLocationEn: string;
  date: string; notes: string; phone: string; email: string; website: string;
  closingText: string; signerTitle: string; footerCompany: string;
};

const defaultDetails = (): Details => ({
  quotationNumber: format(new Date(), 'yyyyMMdd'),
  customerName: '',
  companyNameAr: 'مؤسسة ومشاتل القادري الزراعية',
  companyLocationAr: 'جرش – الرشايدة',
  companyNameEn: 'Al-Qadri Agricultural Establishment',
  companyLocationEn: 'Jerash - Al-Rashaidah',
  date: format(new Date(), 'yyyy-MM-dd'),
  notes: '',
  phone: '00962777772211',
  email: 'tamerqadri@gmail.com',
  website: 'www.alkadri-plants.com',
  closingText: 'واقبلوا فائق الاحترام....',
  signerTitle: 'المدير العام/ ثامر احمد القادري',
  footerCompany: 'مؤسسة ومشاتل القادري الزراعية',
});

const defaultItems = (): Item[] => [
  { id: '1', name: '', description: '', category: '', quantity: 1, unit: 'وحدة', price: 0, total: 0 },
];

const defaultHeaders = (): Headers => ({
  index: '#', image: 'الصورة', name: 'الاسم', description: 'الوصف',
  category: 'القسم', quantity: 'الكمية', price: 'السعر', total: 'الإجمالي',
});

const DRAFT_KEY = 'aq_admin_draft_quotation';

interface QuotationFormProps {
  onClose: () => void;
}

async function apiCreateQuotation(data: Record<string, unknown>) {
  const token = loadSavedToken();
  const res = await fetch('/api/admin-quotations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || 'فشل الحفظ');
  }
  return res.json();
}

async function apiParseText(text: string) {
  const token = loadSavedToken();
  const res = await fetch('/api/parse-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error('فشل التحليل');
  return res.json() as Promise<{ items: Array<{ name: string; description: string; category: string; quantity: number; price: number; total: number }> }>;
}

async function exportToPDF(elementId: string, filename: string, details: Details) {
  const element = document.getElementById(elementId);
  if (!element) return;
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pdfW) / canvas.width;
    if (imgH <= pdfH) {
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, imgH);
    } else {
      let srcY = 0;
      const srcH = Math.floor((pdfH / pdfW) * canvas.width);
      let pageIdx = 0;
      while (srcY < canvas.height) {
        if (pageIdx > 0) pdf.addPage();
        const sliceH = Math.min(srcH, canvas.height - srcY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        sliceCanvas.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfW, (sliceH * pdfW) / canvas.width);
        srcY += sliceH;
        pageIdx++;
      }
    }
    pdf.save(`${filename}.pdf`);
  } catch (e) {
    console.error('PDF export error:', e);
    toast.error('فشل تصدير PDF');
  }
}

export function QuotationForm({ onClose }: QuotationFormProps) {
  const loadDraft = () => {
    try { const r = sessionStorage.getItem(DRAFT_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  };
  const draft = loadDraft();

  const [items, setItems] = useState<Item[]>(draft?.items ?? defaultItems());
  const [details, setDetails] = useState<Details>(draft?.details ?? defaultDetails());
  const [headers, setHeaders] = useState<Headers>(draft?.headers ?? defaultHeaders());
  const [logoBase64, setLogoBase64] = useState<string | null>(draft?.logoBase64 ?? null);
  const [pasteText, setPasteText] = useState('');
  const [discountValue, setDiscountValue] = useState<number>(draft?.discountValue ?? 0);
  const [taxRate, setTaxRate] = useState<number>(draft?.taxRate ?? 0);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const saveDraft = useCallback(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ items, details, headers, logoBase64, discountValue, taxRate })); } catch { /* ignore */ }
  }, [items, details, headers, logoBase64, discountValue, taxRate]);

  useEffect(() => { saveDraft(); }, [saveDraft]);

  const clearDraft = () => {
    sessionStorage.removeItem(DRAFT_KEY);
    setItems(defaultItems());
    setDetails(defaultDetails());
    setHeaders(defaultHeaders());
    setLogoBase64(null);
    setDiscountValue(0);
    setTaxRate(0);
    setSavedSuccess(false);
  };

  const subtotal = items.reduce((acc, i) => acc + (i.total || 0), 0);
  const discountAmount = (subtotal * discountValue) / 100;
  const taxAmount = ((subtotal - discountAmount) * taxRate) / 100;
  const grandTotal = subtotal - discountAmount + taxAmount;
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const r = new FileReader(); r.onloadend = () => setLogoBase64(r.result as string); r.readAsDataURL(file); }
  };

  const handleItemImageUpload = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { const r = new FileReader(); r.onloadend = () => updateItem(itemId, 'imageUrl', r.result as string); r.readAsDataURL(file); }
  };

  const addItem = () => setItems(prev => [...prev, { id: Date.now().toString(), name: '', description: '', category: '', quantity: 1, unit: 'وحدة', price: 0, total: 0 }]);
  const removeItem = (id: string) => { if (items.length === 1) return; setItems(prev => prev.filter(i => i.id !== id)); };
  const updateItem = (id: string, field: keyof Item, value: string | number) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'price') updated.total = Number(updated.quantity) * Number(updated.price);
      return updated;
    }));
  };

  const handleParseText = async () => {
    if (!pasteText.trim()) return;
    setParsing(true);
    try {
      const data = await apiParseText(pasteText);
      const newItems = data.items.map(i => ({
        id: Date.now().toString() + Math.random(),
        name: i.name || 'عنصر غير معروف',
        description: i.description || '',
        category: i.category || '',
        quantity: i.quantity || 1,
        unit: 'وحدة',
        price: i.price || 0,
        total: (i.quantity || 1) * (i.price || 0),
      }));
      const filtered = items.filter(i => i.name.trim() !== '' || i.price > 0);
      setItems([...filtered, ...newItems]);
      setPasteText('');
      toast.success(`تمت إضافة ${newItems.length} عناصر إلى الجدول`);
    } catch {
      toast.error('خطأ في التحليل');
    } finally { setParsing(false); }
  };

  const handleWhatsApp = () => {
    const validItems = items.filter(i => i.name.trim());
    const itemLines = validItems.map((i, idx) => `${idx + 1}. ${i.name} × ${i.quantity} = ${i.total.toLocaleString()} د`).join('\n');
    const discLine = discountAmount > 0 ? `\nخصم: -${discountAmount.toLocaleString()} د` : '';
    const taxLine = taxAmount > 0 ? `\nضريبة (${taxRate}%): +${taxAmount.toLocaleString()} د` : '';
    const msg = `*عرض سعر رقم: ${details.quotationNumber}*\nالعميل: ${details.customerName || '—'}\nالتاريخ: ${details.date}\n\n${itemLines}${discLine}${taxLine}\n──────────────────\n*المجموع الكلي: ${grandTotal.toLocaleString()} دينار*\n\n${details.companyNameAr}\n☎ ${details.phone}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleSave = async () => {
    if (!details.customerName.trim()) { toast.error('مطلوب اسم العميل'); return; }
    const validItems = items.filter(i => i.name.trim());
    if (validItems.length === 0) { toast.error('مطلوب إضافة عناصر'); return; }
    setSaving(true);
    try {
      await apiCreateQuotation({
        quotationNumber: details.quotationNumber,
        customerName: details.customerName,
        date: details.date,
        notes: details.notes,
        grandTotal,
        discountValue,
        taxRate,
        details,
        items: validItems.map(i => ({
          name: i.name.trim(), description: i.description.trim(),
          category: i.category?.trim() || '',
          quantity: Math.max(1, i.quantity),
          unit: i.unit || 'وحدة',
          price: Math.max(0, i.price),
          total: Math.max(0, i.total),
          imageUrl: i.imageUrl || null,
        })),
      });
      toast.success('✅ تم حفظ عرض السعر بنجاح');
      setSavedSuccess(true);
      setTimeout(() => { clearDraft(); }, 2000);
    } catch (e) {
      toast.error((e as Error).message || 'خطأ في الحفظ');
    } finally { setSaving(false); }
  };

  const hdrCls = 'bg-transparent border-none focus:outline-none focus:bg-white/10 focus:ring-1 focus:ring-white/30 rounded px-1 text-center text-xs font-bold text-white w-full';

  if (savedSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 p-8">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">تم حفظ عرض السعر بنجاح!</h2>
        <p className="text-slate-500 text-sm">سيتم مسح النموذج تلقائياً...</p>
        <div className="flex gap-3">
          <button onClick={() => { clearDraft(); setSavedSuccess(false); }} className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90">
            إنشاء عرض جديد
          </button>
          <button onClick={onClose} className="px-5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm hover:opacity-90">
            إغلاق
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-6" dir="rtl">

      {/* Top Toolbar */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 bg-background/95 backdrop-blur border-b border-border px-1 py-2">
        <div>
          <h2 className="text-base font-bold text-foreground">إنشاء عرض سعر جديد</h2>
          <p className="text-muted-foreground text-xs">أدخل البيانات أو الصق النص لتحويله تلقائياً</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={clearDraft} className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 transition-all" title="مسح وبدء من جديد">
            <RotateCcw className="w-4 h-4" />
          </button>
          <button onClick={handleWhatsApp} className="p-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 transition-all" title="إرسال واتساب">
            <MessageCircle className="w-4 h-4" />
          </button>
          <button
            onClick={() => exportToPDF('aq-quotation-document', `عرض-سعر-${details.quotationNumber}`, details)}
            className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-all"
            title="تصدير PDF"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all disabled:opacity-50 text-sm"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ العرض'}
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Smart Paste */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Wand2 className="w-4 h-4" />
          <span className="text-sm font-bold">التحليل الذكي للنصوص</span>
        </div>
        <p className="text-muted-foreground text-xs">الصق النص على هذا النمط: <strong className="text-foreground">الكمية / الاسم / الوصف / القسم / السعر</strong></p>
        <div className="relative">
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={'مثال:\nشاشة سامسونج 5 حبات بسعر 1500\nكيبورد لوجيتك 2 قطعة سعر 300'}
            className="w-full h-20 p-2 rounded-lg bg-background border border-border resize-none text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleParseText}
            disabled={parsing || !pasteText.trim()}
            className="absolute bottom-2 left-2 flex items-center gap-1 px-3 py-1 rounded-lg bg-primary/10 text-primary font-bold hover:bg-primary/20 disabled:opacity-50 text-xs transition-all"
          >
            {parsing ? 'جاري التحليل...' : 'حلل النص'}
            <CheckCircle2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Document */}
      <div id="aq-quotation-document" className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 space-y-3">

        {/* Header */}
        <div className="pb-4 border-b-2 border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-4">
            <div className="shrink-0 relative group w-24 h-24 border border-slate-200 dark:border-slate-700 rounded overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-slate-900">
              {logoBase64
                ? <img src={logoBase64} alt="logo" className="w-full h-full object-contain p-1" />
                : <span className="text-[10px] text-slate-400 text-center px-1">انقر لتحميل الشعار</span>
              }
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer" title="تحميل شعار" />
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <input value={details.companyNameAr} onChange={e => setDetails({ ...details, companyNameAr: e.target.value })} className="text-base font-bold bg-transparent border-b border-slate-300 dark:border-slate-600 focus:border-primary outline-none w-full text-right px-1" placeholder="اسم الشركة عربي" />
                <input value={details.companyLocationAr} onChange={e => setDetails({ ...details, companyLocationAr: e.target.value })} className="text-xs text-slate-600 dark:text-slate-400 bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-primary outline-none w-full text-right px-1" placeholder="الموقع" />
              </div>
              <div className="space-y-1">
                <input value={details.companyNameEn} onChange={e => setDetails({ ...details, companyNameEn: e.target.value })} className="text-base font-bold bg-transparent border-b border-slate-300 dark:border-slate-600 focus:border-primary outline-none w-full text-left px-1" placeholder="Company Name EN" dir="ltr" />
                <input value={details.companyLocationEn} onChange={e => setDetails({ ...details, companyLocationEn: e.target.value })} className="text-xs text-slate-500 bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-primary outline-none w-full text-left px-1" placeholder="Location EN" dir="ltr" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-4">
            <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-lg px-4 py-2 text-center min-w-[140px]">
              <p className="text-[10px] font-bold opacity-70 mb-1">عرض سعر رقم</p>
              <input value={details.quotationNumber} onChange={e => setDetails({ ...details, quotationNumber: e.target.value })} className="bg-transparent border-none focus:outline-none text-sm font-black text-white text-center w-full" />
            </div>
            <div className="space-y-1 flex-1 min-w-[120px]">
              <label className="text-[10px] font-bold text-slate-500 block">التاريخ</label>
              <input type="date" value={details.date} onChange={e => setDetails({ ...details, date: e.target.value })} className="bg-transparent border-b-2 border-slate-300 dark:border-slate-600 focus:border-primary outline-none text-xs font-semibold w-full" />
            </div>
            <div className="space-y-1 flex-1 min-w-[140px]">
              <label className="text-[10px] font-bold text-slate-500 block">العميل</label>
              <input value={details.customerName} onChange={e => setDetails({ ...details, customerName: e.target.value })} className="bg-transparent border-b-2 border-slate-300 dark:border-slate-600 focus:border-primary outline-none text-xs font-semibold w-full" placeholder="اسم العميل *" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 dark:bg-slate-950 text-white">
                <th className="p-2 text-center w-6"><input value={headers.index} onChange={e => setHeaders({ ...headers, index: e.target.value })} className={hdrCls} style={{ width: '2rem' }} /></th>
                <th className="p-2"><input value={headers.name} onChange={e => setHeaders({ ...headers, name: e.target.value })} className={hdrCls} /></th>
                <th className="p-2"><input value={headers.description} onChange={e => setHeaders({ ...headers, description: e.target.value })} className={hdrCls} /></th>
                <th className="p-2"><input value={headers.category} onChange={e => setHeaders({ ...headers, category: e.target.value })} className={hdrCls} /></th>
                <th className="p-2 text-center w-20"><input value={headers.quantity} onChange={e => setHeaders({ ...headers, quantity: e.target.value })} className={hdrCls} /></th>
                <th className="p-2 text-center w-24"><input value={headers.price} onChange={e => setHeaders({ ...headers, price: e.target.value })} className={hdrCls} /></th>
                <th className="p-2 text-center w-24"><input value={headers.total} onChange={e => setHeaders({ ...headers, total: e.target.value })} className={hdrCls} /></th>
                <th className="p-2 text-center w-24"><input value={headers.image} onChange={e => setHeaders({ ...headers, image: e.target.value })} className={hdrCls} /></th>
                <th className="p-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 group">
                  <td className="p-1.5 text-center text-slate-500 font-semibold">{index + 1}</td>
                  <td className="p-1.5">
                    <input value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)} className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-primary focus:bg-blue-50 dark:focus:bg-slate-900 px-1.5 py-1 rounded text-xs transition-colors font-medium" placeholder="الاسم" />
                  </td>
                  <td className="p-1.5">
                    <input value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-primary focus:bg-blue-50 dark:focus:bg-slate-900 px-1.5 py-1 rounded text-xs transition-colors" placeholder="الوصف" />
                  </td>
                  <td className="p-1.5">
                    <input value={item.category} onChange={e => updateItem(item.id, 'category', e.target.value)} className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-primary focus:bg-blue-50 dark:focus:bg-slate-900 px-1.5 py-1 rounded text-xs transition-colors" placeholder="القسم" />
                  </td>
                  <td className="p-1.5 text-center">
                    <input type="number" min="1" dir="ltr" value={item.quantity || ''} onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} style={{ textAlign: 'center' }} className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-primary focus:bg-blue-50 dark:focus:bg-slate-900 px-1.5 py-1 rounded text-xs font-bold transition-colors" />
                  </td>
                  <td className="p-1.5 text-center">
                    <input type="number" min="0" step="0.01" dir="ltr" value={item.price || ''} onChange={e => updateItem(item.id, 'price', parseFloat(e.target.value) || 0)} style={{ textAlign: 'center' }} className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-primary focus:bg-blue-50 dark:focus:bg-slate-900 px-1.5 py-1 rounded text-xs font-bold transition-colors" />
                  </td>
                  <td className="p-1.5 text-center font-bold text-slate-900 dark:text-slate-50 bg-slate-100 dark:bg-slate-800/50 rounded text-xs">{fmt(item.total)}</td>
                  <td className="p-1 text-center">
                    <label className="relative cursor-pointer block w-20 h-20 mx-auto rounded overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-primary transition-colors" title="انقر لرفع صورة">
                      <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => handleItemImageUpload(item.id, e)} />
                      {item.imageUrl
                        ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900"><Plus className="w-3.5 h-3.5 text-slate-300" /></div>
                      }
                    </label>
                  </td>
                  <td className="p-1.5 text-center">
                    <button onClick={() => removeItem(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-0.5 rounded transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {(discountAmount > 0 || taxAmount > 0) && (
                <>
                  <tr className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <td colSpan={7} className="p-2 text-right text-xs text-slate-600 dark:text-slate-400 pr-4">المجموع الفرعي</td>
                    <td className="p-1.5 text-center text-xs font-semibold">{fmt(subtotal)}</td>
                    <td /><td />
                  </tr>
                  {discountAmount > 0 && (
                    <tr className="bg-green-50 dark:bg-green-900/10">
                      <td colSpan={7} className="p-2 text-right text-xs text-green-700 pr-4">خصم ({discountValue}%)</td>
                      <td className="p-1.5 text-center text-xs text-green-700 font-semibold">- {fmt(discountAmount)}</td>
                      <td /><td />
                    </tr>
                  )}
                  {taxAmount > 0 && (
                    <tr className="bg-orange-50 dark:bg-orange-900/10">
                      <td colSpan={7} className="p-2 text-right text-xs text-orange-700 pr-4">ضريبة ({taxRate}%)</td>
                      <td className="p-1.5 text-center text-xs text-orange-700 font-semibold">+ {fmt(taxAmount)}</td>
                      <td /><td />
                    </tr>
                  )}
                </>
              )}
              <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-900 dark:bg-slate-950 text-white">
                <td colSpan={7} className="p-2 text-right font-black text-xs pr-4">المجموع الكلي</td>
                <td className="p-1.5 text-center font-black text-sm bg-primary/20 text-white">{fmt(grandTotal)} <span className="text-xs font-bold opacity-80">د.أ</span></td>
                <td className="bg-slate-900" /><td className="bg-slate-900" />
              </tr>
            </tfoot>
          </table>
        </div>

        <button onClick={addItem} className="flex items-center gap-1 text-primary font-bold hover:bg-primary/10 px-2 py-1 rounded text-xs transition-colors">
          <Plus className="w-3 h-3" />إضافة صنف
        </button>

        {/* Discount & Tax */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">الخصم والضريبة</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">نسبة الخصم (%)</label>
              <input type="number" min="0" max="100" step="0.1" value={discountValue || ''} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary" placeholder="0" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">نسبة الضريبة (%)</label>
              <input type="number" min="0" max="100" step="0.1" value={taxRate || ''} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary" placeholder="0" />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">ملاحظات:</label>
          <textarea value={details.notes} onChange={e => setDetails({ ...details, notes: e.target.value })} className="w-full h-12 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded focus:border-primary resize-none text-xs" placeholder="شروط الدفع، مدة التوريد، إلخ..." />
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-center gap-4 text-slate-600 dark:text-slate-400 text-[10px]" dir="ltr">
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              <input value={details.phone} onChange={e => setDetails({ ...details, phone: e.target.value })} className="bg-transparent border-none focus:outline-none font-semibold w-28" dir="ltr" />
            </div>
            <div className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              <input value={details.email} onChange={e => setDetails({ ...details, email: e.target.value })} className="bg-transparent border-none focus:outline-none w-36" dir="ltr" />
            </div>
            <div className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              <input value={details.website} onChange={e => setDetails({ ...details, website: e.target.value })} className="bg-transparent border-none focus:outline-none w-36" dir="ltr" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
