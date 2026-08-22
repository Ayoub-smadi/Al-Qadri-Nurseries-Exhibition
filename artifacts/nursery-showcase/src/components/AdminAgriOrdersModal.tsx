import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileText, Loader2, MapPin, Phone, RefreshCw, ShoppingCart, X } from 'lucide-react';
import { createInvoice, fetchQuotes, InvoiceItem, QuoteRequest, updateQuote } from '@/lib/storage';
import { toast } from 'sonner';

export function AdminAgriOrdersModal({ open, onClose, onCountChange }: { open: boolean; onClose: () => void; onCountChange?: (count: number) => void }) {
  const [orders, setOrders] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchQuotes({ orderType: 'agri_store' });
    if (result) {
      setOrders(result);
      onCountChange?.(result.filter(order => order.status !== 'priced').length);
    }
    setLoading(false);
  }, [onCountChange]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const convertToInvoice = async (order: QuoteRequest) => {
    setConverting(order.id);
    const items: InvoiceItem[] = (order.items ?? []).map(item => ({
      description: item.plantNameAr || item.plantNameEn || 'مواد زراعية',
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.price) || 0,
    }));
    if (Number(order.shipping_fee) > 0) items.push({ description: 'رسوم الشحن', quantity: 1, unitPrice: Number(order.shipping_fee) });
    const result = await createInvoice({
      customerName: order.customer_name,
      date: new Date(order.created_at).toISOString().slice(0, 10),
      items,
      notes: `طلب متجر المواد الزراعية\nالهاتف: ${order.phone}\nالموقع: ${order.shipping_address ?? ''}`,
      status: 'online',
    });
    if (result && result !== 'unauthorized' && !('error' in result)) {
      await updateQuote(order.id, {
        items: order.items,
        discount: Number(order.discount) || 0,
        tax: Number(order.tax) || 0,
        status: 'priced',
        notes: order.notes,
        shippingFee: Number(order.shipping_fee) || 0,
        shippingMethod: order.shipping_method,
        shippingAddress: order.shipping_address,
      });
      setOrders(prev => prev.map(item => item.id === order.id ? { ...item, status: 'priced' } : item));
      toast.success(`تم تحويل الطلب إلى فاتورة رقم ${result.number}`);
    } else {
      toast.error('فشل تحويل الطلب إلى فاتورة');
    }
    setConverting(null);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
      <div className="bg-card border border-border w-full sm:max-w-2xl max-h-[92vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col shadow-2xl">
        <div className="shrink-0 px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-primary" /><h2 className="font-bold arabic">طلبات مواد زراعية</h2></div>
          <div className="flex items-center gap-2"><button onClick={load} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center" title="تحديث"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button><button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button></div>
        </div>
        <div className="overflow-y-auto p-4 space-y-3">
          {loading && orders.length === 0 ? <div className="py-14 text-center"><Loader2 className="w-7 h-7 animate-spin mx-auto text-primary" /></div> : orders.length === 0 ? <div className="py-14 text-center text-muted-foreground arabic"><ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />لا توجد طلبات مواد زراعية حتى الآن</div> : orders.map(order => {
            const total = (order.items ?? []).reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0) + (Number(order.shipping_fee) || 0);
            return <div key={order.id} className="rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3"><div><p className="font-bold arabic">{order.customer_name}</p><p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString('ar-JO')}</p></div><span className={`text-[10px] rounded-full px-2 py-1 arabic ${order.status === 'priced' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{order.status === 'priced' ? 'تمت المعالجة' : 'جديد'}</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground arabic"><span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{order.phone || '—'}</span><span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{order.shipping_address || '—'}</span></div>
              <div className="space-y-1 border-t border-border pt-2">{(order.items ?? []).map((item, index) => <div key={index} className="flex justify-between gap-2 text-sm arabic"><span>{item.plantNameAr || item.plantNameEn} × {item.quantity}</span><span>{Number(item.price) > 0 ? `${(Number(item.price) * Number(item.quantity)).toFixed(2)} د.أ` : 'عند الطلب'}</span></div>)}<div className="flex justify-between font-bold text-primary pt-1 border-t border-border arabic"><span>الإجمالي مع الشحن</span><span>{total.toFixed(2)} د.أ</span></div></div>
              <button onClick={() => convertToInvoice(order)} disabled={converting === order.id || order.status === 'priced'} className="w-full rounded-xl border border-primary text-primary hover:bg-primary hover:text-primary-foreground py-2 text-sm font-bold arabic disabled:opacity-50 transition-colors">{converting === order.id ? <Loader2 className="w-4 h-4 animate-spin inline-block me-1" /> : order.status === 'priced' ? <CheckCircle2 className="w-4 h-4 inline-block me-1" /> : <FileText className="w-4 h-4 inline-block me-1" />}{order.status === 'priced' ? 'تم تحويله إلى فاتورة' : 'تحويل إلى فاتورة'}</button>
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}