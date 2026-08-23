import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Leaf, MapPin, Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { navigate } from '@/App';
import { useApp } from '@/lib/context';
import { AgriStoreCategory, AgriStoreProduct, QuoteItem, submitQuote } from '@/lib/storage';
import { toast } from 'sonner';
import gardeningToolIcon from '@/assets/store-icons/gardening-tool.png';
import seedIcon from '@/assets/store-icons/seed.png';
import fertilizerIcon from '@/assets/store-icons/fertilizer.png';
import pesticideIcon from '@/assets/store-icons/pesticide.png';
import plantIcon from '@/assets/store-icons/plant.png';

type CartLine = { product: AgriStoreProduct; quantity: number };

const categories: { id: AgriStoreCategory; ar: string; en: string; icon: string }[] = [
  { id: 'tools', ar: 'عدد زراعية', en: 'Agricultural Tools', icon: gardeningToolIcon },
  { id: 'seeds', ar: 'بذور', en: 'Seeds', icon: seedIcon },
  { id: 'fertilizers', ar: 'أسمدة', en: 'Fertilizers', icon: fertilizerIcon },
  { id: 'pesticides', ar: 'مبيدات', en: 'Pesticides', icon: pesticideIcon },
  { id: 'irrigation', ar: 'شبكات ري', en: 'Irrigation', icon: plantIcon },
];

export default function AgriStorePage() {
  const { lang, siteData } = useApp();
  const isAr = lang === 'ar';
  const products = siteData.agriStoreProducts ?? [];
  const content = siteData.agriStoreContent;
  const [category, setCategory] = useState<AgriStoreCategory>('tools');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [location, setLocation] = useState('');
  const [sending, setSending] = useState(false);

  const visibleProducts = useMemo(() => products.filter(p => p.category === category), [products, category]);
  const detailId = window.location.pathname.match(/^\/agri-store\/product\/([^/]+)$/)?.[1];
  const detailProduct = detailId ? products.find(product => product.id === decodeURIComponent(detailId)) : null;
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.quantity * Number(line.product.price || 0), 0);
  const shippingZones = siteData.shippingZones ?? [];
  const shippingFee = shippingZones.find(zone => zone.id === governorate)?.fee ?? 0;
  const total = subtotal + (governorate ? shippingFee : 0);

  const addToCart = (product: AgriStoreProduct) => {
    setCart(prev => {
      const found = prev.find(line => line.product.id === product.id);
      if (found) return prev.map(line => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line);
      return [...prev, { product, quantity: 1 }];
    });
    toast.success(isAr ? 'تمت إضافة المنتج للسلة' : 'Product added to cart');
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev
      .map(line => line.product.id === id ? { ...line, quantity: line.quantity + delta } : line)
      .filter(line => line.quantity > 0));
  };

  const handleSubmit = async () => {
    if (!customerName.trim() || !phone.trim() || !location.trim() || !governorate) {
      toast.error(isAr ? 'الاسم والهاتف ومنطقة التوصيل والموقع حقول إلزامية' : 'Name, phone, delivery area and location are required');
      return;
    }
    if (!cart.length) {
      toast.error(isAr ? 'أضف منتجاً واحداً على الأقل' : 'Add at least one product');
      return;
    }
    setSending(true);
    const items: QuoteItem[] = cart.map(({ product, quantity }) => ({
      plantId: product.id,
      plantNameAr: product.nameAr,
      plantNameEn: product.nameEn,
      plantImage: product.image,
      sectionNameAr: categories.find(c => c.id === product.category)?.ar ?? '',
      sectionNameEn: categories.find(c => c.id === product.category)?.en ?? '',
      quantity,
      size: '',
      price: Number(product.price || 0),
    }));
    const id = await submitQuote({
      orderType: 'agri_store',
      shippingMethod: 'delivery',
      shippingAddress: `${shippingZones.find(zone => zone.id === governorate)?.nameAr ?? governorate} - ${location}`,
      customerName: customerName.trim(),
      phone: phone.trim(),
      items,
      notes: 'طلب متجر المواد الزراعية',
      shippingFee,
    });
    setSending(false);
    if (!id) {
      toast.error(isAr ? 'تعذر إرسال الطلب، حاول مرة أخرى' : 'Could not send the order');
      return;
    }
    setCheckout(false);
    setCart([]);
    setCustomerName('');
    setPhone('');
    setLocation('');
    toast.success(isAr ? 'تم إرسال الطلب بنجاح، سنتواصل معك قريباً' : 'Order sent successfully');
  };

  if (detailId && detailProduct) {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="store-page min-h-screen bg-[#f8fbf8] text-[#123b2b]">
        <header className="sticky top-0 z-40 border-b border-[#d7e7de] bg-white/95 backdrop-blur">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <button onClick={() => navigate('/agri-store')} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm arabic hover:bg-[#e5f2e9] transition-colors">
              <ArrowRight className="w-4 h-4" /> {isAr ? 'العودة للمتجر' : 'Back to store'}
            </button>
            <h1 className="font-bold text-base sm:text-xl arabic truncate">{isAr ? (content?.storeTitleAr ?? 'متجر المواد الزراعية') : (content?.storeTitleEn ?? 'Agricultural Supplies Store')}</h1>
            <button onClick={() => setCheckout(true)} className="relative inline-flex items-center gap-1.5 rounded-xl bg-[#004f31] text-white px-3 py-2 text-sm font-bold arabic shadow-lg shadow-[#004f31]/20">
              <ShoppingCart className="w-4 h-4" /><span className="hidden sm:inline">{isAr ? 'السلة' : 'Cart'}</span>
              {cartCount > 0 && <span className="absolute -top-2 -end-2 min-w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{cartCount}</span>}
            </button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          <article className="overflow-hidden rounded-[2rem] border border-[#d7e7de] bg-white shadow-xl">
            <div className="grid md:grid-cols-2">
              <div className="aspect-square md:aspect-auto md:min-h-[460px] bg-[#edf6f0]">
                <img src={detailProduct.image} alt={isAr ? detailProduct.nameAr : detailProduct.nameEn} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col justify-center p-6 sm:p-10">
                <p className="text-sm font-bold text-[#5c7b6b] arabic">{categories.find(item => item.id === detailProduct.category)?.[isAr ? 'ar' : 'en']}</p>
                <h2 className="mt-2 text-2xl sm:text-4xl font-bold arabic leading-tight">{isAr ? detailProduct.nameAr : detailProduct.nameEn}</h2>
                <p className="mt-5 text-base leading-8 text-[#648273] arabic whitespace-pre-line">{isAr ? detailProduct.descriptionAr : detailProduct.descriptionEn}</p>
                <p className="mt-6 text-xl font-bold text-[#004f31] arabic">{detailProduct.price > 0 ? `${detailProduct.price.toFixed(2)} د.أ` : (isAr ? 'السعر عند الطلب' : 'Price on request')}</p>
                <button onClick={() => { addToCart(detailProduct); navigate('/agri-store'); }} className="mt-7 w-full rounded-xl bg-[#004f31] text-white py-3.5 font-bold arabic hover:bg-[#003d26] transition-colors">
                  <ShoppingCart className="w-4 h-4 inline-block me-2 align-middle" />{isAr ? 'إضافة للسلة' : 'Add to cart'}
                </button>
              </div>
            </div>
          </article>
        </main>
      </div>
    );
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="store-page min-h-screen bg-[#f8fbf8] text-[#123b2b]">
      <header className="sticky top-0 z-40 border-b border-[#d7e7de] bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm arabic hover:bg-muted transition-colors">
             <ArrowRight className="w-4 h-4" /> {isAr ? 'رجوع للموقع' : 'Back to website'}
          </button>
          <div className="text-center min-w-0">
             <h1 className="font-bold text-base sm:text-xl arabic truncate">{isAr ? (content?.storeTitleAr ?? 'متجر المواد الزراعية') : (content?.storeTitleEn ?? 'Agricultural Supplies Store')}</h1>
             <p className="text-[10px] sm:text-xs text-[#5c7b6b] arabic">{isAr ? (content?.storeSubtitleAr ?? 'مشاتل القادري الزراعية') : (content?.storeSubtitleEn ?? 'Al-Qadri Agricultural Nurseries')}</p>
          </div>
           <button onClick={() => setCheckout(true)} className="relative inline-flex items-center gap-1.5 rounded-xl bg-[#004f31] text-white px-3 py-2 text-sm font-bold arabic shadow-lg shadow-[#004f31]/20">
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">{isAr ? 'السلة' : 'Cart'}</span>
            {cartCount > 0 && <span className="absolute -top-2 -end-2 min-w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{cartCount}</span>}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
         <section className="store-hero relative rounded-[2rem] overflow-hidden bg-[#004f31] text-white p-7 sm:p-12 mb-10 shadow-xl shadow-[#004f31]/15">
           <div className="relative z-10 max-w-2xl">
             <p className="text-[#b9dfc8] text-sm arabic mb-2">{isAr ? content?.eyebrowAr : content?.eyebrowEn}</p>
             <h2 className="text-3xl sm:text-5xl font-bold arabic mb-4 leading-tight">{isAr ? content?.titleAr : content?.titleEn}</h2>
             <p className="text-white/75 text-sm sm:text-base arabic max-w-2xl leading-8">{isAr ? content?.descriptionAr : content?.descriptionEn}</p>
           </div>
           <Leaf className="store-hero-leaf absolute -bottom-8 -end-4 h-48 w-48 text-white/10 rotate-12" />
           <div className="absolute -top-20 -start-10 h-48 w-48 rounded-full border border-white/10" />
        </section>

         <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {categories.map(item => (
             <button key={item.id} onClick={() => setCategory(item.id)}
               className={`group relative min-h-[116px] overflow-hidden rounded-2xl border p-3 text-start transition-all ${category === item.id ? 'border-[#004f31] bg-[#004f31] text-white shadow-lg shadow-[#004f31]/15' : 'border-[#d7e7de] bg-white text-[#37634f] hover:-translate-y-1 hover:border-[#004f31] hover:shadow-md'}`}>
               <span className={`absolute -end-3 -bottom-5 h-24 w-24 rounded-full ${category === item.id ? 'bg-white/10' : 'bg-[#edf6f0]'}`} />
               <img src={item.icon} alt="" className={`relative h-14 w-14 object-contain transition-transform duration-300 group-hover:scale-110 ${category === item.id ? 'brightness-110' : ''}`} />
               <span className="relative mt-2 block text-sm font-bold arabic">{isAr ? item.ar : item.en}</span>
               <span className={`relative mt-0.5 block text-[10px] ${category === item.id ? 'text-white/60' : 'text-[#8aa294]'}`}>{category === item.id ? (isAr ? 'تصفح المنتجات' : 'Browse products') : ' '}</span>
            </button>
          ))}
        </div>

        {visibleProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-16 text-center text-muted-foreground arabic">{isAr ? 'لا توجد منتجات في هذا القسم حالياً' : 'No products in this category yet'}</div>
        ) : (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
             {visibleProducts.map(product => (
               <article key={product.id} className="group flex h-full flex-col rounded-2xl overflow-hidden border border-[#d7e7de] bg-white shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all">
                 <button onClick={() => navigate(`/agri-store/product/${encodeURIComponent(product.id)}`)} className="block w-full flex-1 text-start">
                   <div className="aspect-square overflow-hidden bg-[#edf6f0]">
                     <img src={product.image} alt={isAr ? product.nameAr : product.nameEn} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                   <div className="p-5">
                    <h3 className="font-bold arabic text-base">{isAr ? product.nameAr : product.nameEn}</h3>
                      <p className="text-sm text-[#648273] arabic mt-1 line-clamp-3">{isAr ? product.descriptionAr : product.descriptionEn}</p>
                       <p className="text-[#004f31] font-bold mt-3 arabic">{product.price > 0 ? `${product.price.toFixed(2)} د.أ` : (isAr ? 'السعر عند الطلب' : 'Price on request')}</p>
                  </div>
                </button>
                 <div className="px-5 pb-5 mt-auto">
                   <button onClick={() => addToCart(product)} className="w-full rounded-xl bg-[#e5f2e9] text-[#004f31] hover:bg-[#004f31] hover:text-white py-2.5 text-sm font-bold arabic transition-colors">
                    <Plus className="w-4 h-4 inline-block me-1 align-middle" /> {isAr ? 'إضافة للسلة' : 'Add to cart'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {checkout && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setCheckout(false)}>
          <div className="bg-card w-full sm:max-w-xl max-h-[95vh] rounded-t-3xl sm:rounded-3xl overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between"><h2 className="text-lg font-bold arabic">{isAr ? 'السلة وإرسال الطلب' : 'Cart & checkout'}</h2><button onClick={() => setCheckout(false)}><X className="w-5 h-5" /></button></div>
            <div className="p-5 space-y-4">
              {cart.length === 0 ? <div className="text-center py-10 text-muted-foreground arabic"><ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />{isAr ? 'السلة فارغة' : 'Your cart is empty'}</div> : (
                <>
                  <div className="space-y-2">
                    {cart.map(line => <div key={line.product.id} className="flex items-center gap-3 border-b border-border pb-2">
                       <img src={line.product.image} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                       <div className="flex-1 min-w-0"><p className="font-bold arabic truncate">{isAr ? line.product.nameAr : line.product.nameEn}</p><p className="text-xs text-muted-foreground arabic">{line.product.price > 0 ? `${(line.product.price * line.quantity).toFixed(2)} د.أ` : (isAr ? 'السعر عند الطلب' : 'Price on request')}</p></div>
                      <div className="flex items-center gap-1"><button onClick={() => updateQuantity(line.product.id, -1)} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center"><Minus className="w-3 h-3" /></button><span className="w-6 text-center">{line.quantity}</span><button onClick={() => updateQuantity(line.product.id, 1)} className="w-7 h-7 rounded-lg border border-border flex items-center justify-center"><Plus className="w-3 h-3" /></button></div>
                      <button onClick={() => updateQuantity(line.product.id, -line.quantity)} className="text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </div>)}
                  </div>
                   <div className="rounded-xl bg-[#f1f7f3] p-3 space-y-1 text-sm arabic"><div className="flex justify-between"><span>{isAr ? 'المجموع الفرعي' : 'Subtotal'}</span><b>{subtotal.toFixed(2)} د.أ</b></div><div className="flex justify-between text-[#3d7357]"><span>{isAr ? 'رسوم الشحن' : 'Shipping'}</span><b>{governorate ? `${shippingFee.toFixed(2)} د.أ` : (isAr ? 'اختر المنطقة' : 'Select area')}</b></div><div className="flex justify-between border-t border-[#cfe2d5] pt-2 text-base text-[#004f31]"><b>{isAr ? 'الإجمالي' : 'Total'}</b><b>{total.toFixed(2)} د.أ</b></div></div>
                  <div className="space-y-3">
                    <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder={isAr ? 'اسم الزبون *' : 'Customer name *'} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 arabic" />
                    <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" dir="ltr" placeholder={isAr ? 'رقم الهاتف *' : 'Phone *'} className="w-full rounded-xl border border-border bg-background px-3 py-2.5" />
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><select value={governorate} onChange={e => setGovernorate(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 arabic"><option value="">{isAr ? 'اختر منطقة التوصيل *' : 'Select delivery area *'}</option>{shippingZones.map(zone => <option key={zone.id} value={zone.id}>{isAr ? zone.nameAr : zone.nameEn} — {zone.fee.toFixed(2)} د.أ</option>)}</select><div className="relative"><MapPin className="absolute start-3 top-3 w-4 h-4 text-muted-foreground" /><input value={location} onChange={e => setLocation(e.target.value)} placeholder={isAr ? 'الموقع بالتفصيل *' : 'Full location *'} className="w-full rounded-xl border border-border bg-background ps-9 pe-3 py-2.5 arabic" /></div></div>
                     <p className="text-xs text-muted-foreground arabic">{isAr ? 'تُضاف رسوم الشحن بعد اختيار منطقة التوصيل.' : 'Shipping is added after selecting a delivery area.'}</p>
                  </div>
                   <button onClick={handleSubmit} disabled={sending} className="w-full rounded-xl bg-[#004f31] text-white py-3 font-bold arabic disabled:opacity-50 hover:bg-[#003d26] transition-colors">{sending ? 'جاري إرسال الطلب...' : <><CheckCircle2 className="w-4 h-4 inline-block me-2 align-middle" />إرسال الطلب</>}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}