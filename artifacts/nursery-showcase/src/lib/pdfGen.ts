import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Section, Photo, QuoteItem, QuoteRequest, SiteData } from '@/lib/storage';

export interface PDFSectionInput {
  section: Section;
  photos: Photo[];
}

/* Pre-load an image URL into a data URL via canvas (handles CORS) */
async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return src;
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || 400;
        c.height = img.naturalHeight || 400;
        c.getContext('2d')!.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = src;
    });
  } catch {
    // return a 1×1 transparent placeholder
    return 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  }
}

/* Build an off-screen DOM element with the catalog layout */
async function buildPrintContainer(
  sections: PDFSectionInput[],
  titleAr: string,
  titleEn: string,
  logoUrl: string,
  lang: string
): Promise<HTMLDivElement> {
  const isAr = lang === 'ar';
  const title = isAr ? titleAr : titleEn;

  // Pre-load logo
  let logoDataUrl = '';
  if (logoUrl) {
    logoDataUrl = await toDataUrl(logoUrl);
  }

  // Pre-load all photos
  const photoDataUrls = new Map<string, string>();
  for (const { photos } of sections) {
    for (const p of photos) {
      if (!photoDataUrls.has(p.id)) {
        photoDataUrls.set(p.id, await toDataUrl(p.image));
      }
    }
  }

  const dir = isAr ? 'rtl' : 'ltr';
  const fontFamily = isAr ? "'Cairo', sans-serif" : "'Cormorant Garamond', serif";

  const sectionsHtml = sections.map(({ section, photos }) => {
    const sName = isAr ? section.nameAr : section.nameEn;
    const photosHtml = photos.map(p => {
      const name = isAr ? p.nameAr : p.nameEn;
      const altName = isAr ? p.nameEn : p.nameAr;
      const src = photoDataUrls.get(p.id) ?? p.image;
      return `
        <div style="break-inside:avoid;page-break-inside:avoid;">
          <div style="width:100%;aspect-ratio:4/5;overflow:hidden;border-radius:10px;background:#f3f0eb;">
            <img src="${src}" alt="${name}" style="width:100%;height:100%;object-fit:cover;display:block;" />
          </div>
          <p style="text-align:center;margin:6px 0 0;font-size:13px;font-weight:700;color:#2d2d2d;line-height:1.3;">${name}</p>
          ${altName ? `<p style="text-align:center;margin:2px 0 0;font-size:10px;color:#888;font-family:'Cormorant Garamond',serif;letter-spacing:.04em;">${altName}</p>` : ''}
        </div>`;
    }).join('');

    return `
      <div style="margin-bottom:32px;page-break-inside:avoid;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <div style="flex:1;height:1px;background:#d4b896;"></div>
          <div style="text-align:center;">
            <div style="font-size:18px;font-weight:700;color:#1a1a1a;font-family:${fontFamily};">${sName}</div>
          </div>
          <div style="flex:1;height:1px;background:#d4b896;"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
          ${photosHtml}
        </div>
      </div>`;
  }).join('');

  const html = `
    <div style="font-family:${fontFamily};background:#fff;padding:32px 28px;width:750px;color:#111;direction:${dir};">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:28px;padding-bottom:18px;border-bottom:2px solid #d4b896;">
        ${logoDataUrl ? `<img src="${logoDataUrl}" alt="logo" style="width:56px;height:72px;object-fit:contain;margin-bottom:10px;display:inline-block;" />` : `
          <svg width="48" height="64" viewBox="0 0 56 76" style="display:inline-block;margin-bottom:10px;" fill="none">
            <polygon points="28,4 50,32 6,32" fill="#4a7c59"/>
            <polygon points="28,22 54,52 2,52" fill="#3d6b4a"/>
            <polygon points="28,40 56,72 0,72" fill="#2e5438"/>
            <rect x="23" y="72" width="10" height="12" rx="2" fill="#8b5e3c"/>
          </svg>`}
        <div style="font-size:26px;font-weight:800;color:#1a1a1a;font-family:'Cairo',sans-serif;line-height:1.2;">${isAr ? titleAr : titleEn}</div>
        <div style="font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#888;margin-top:4px;font-family:'Cormorant Garamond',serif;">${isAr ? titleEn : titleAr}</div>
      </div>
      <!-- Sections -->
      ${sectionsHtml}
      <!-- Footer -->
      <div style="text-align:center;margin-top:20px;padding-top:14px;border-top:1px solid #e5d5c0;font-size:10px;color:#999;font-family:'Cormorant Garamond',serif;letter-spacing:.05em;">
        ${new Date().getFullYear()} · ${isAr ? titleAr : titleEn}
      </div>
    </div>`;

  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
  div.innerHTML = html;
  return div;
}

/* Main export: download PDF file directly */
export async function downloadCatalogPDF(
  sections: PDFSectionInput[],
  titleAr: string,
  titleEn: string,
  logoUrl: string,
  lang: string,
  filename = 'alqadri-catalog.pdf'
): Promise<void> {
  const container = await buildPrintContainer(sections, titleAr, titleEn, logoUrl, lang);
  document.body.appendChild(container);

  await document.fonts.ready;

  const inner = container.firstElementChild as HTMLElement;

  const canvas = await html2canvas(inner, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  document.body.removeChild(container);

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();   // 210
  const pageH = pdf.internal.pageSize.getHeight();  // 297

  const ratio = pageW / canvas.width;
  const fullH = canvas.height * ratio;
  let drawn = 0;

  while (drawn < fullH) {
    if (drawn > 0) pdf.addPage();

    const sliceH = Math.min(pageH, fullH - drawn);
    const srcY = drawn / ratio;
    const srcH = sliceH / ratio;

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = Math.ceil(srcH);
    slice.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    const imgData = slice.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, 0, pageW, sliceH);

    drawn += pageH;
  }

  pdf.save(filename);
}

/* ── Quote PDF shared builder ───────────────────────────── */
type QuoteSiteData = { titleAr: string; titleEn: string; logo: { customUrl: string }; footer: { phone?: string; email?: string; website?: string }; sections?: SiteData['sections'] };

async function buildQuotePDF(quote: QuoteRequest, siteData: QuoteSiteData): Promise<{ pdf: jsPDF; fileName: string }> {
  const items = quote.items as QuoteItem[];
  const logoDataUrl = siteData.logo.customUrl ? await toDataUrl(siteData.logo.customUrl) : '';
  const stampDataUrl = await toDataUrl('/stamp.jpeg').catch(() => '');

  // Build a lookup of plantId → image from current siteData sections (fallback for stripped images)
  const sectionImgLookup = new Map<string, string>();
  for (const sec of (siteData.sections ?? [])) {
    for (const p of sec.photos) {
      if (p.image) sectionImgLookup.set(p.id, p.image);
    }
  }

  // Pre-load plant images — prefer stored plantImage, fall back to current siteData image
  const imgMap = new Map<string, string>();
  for (const item of items) {
    const src = item.plantImage || sectionImgLookup.get(item.plantId) || '';
    if (src && !imgMap.has(item.plantId)) {
      imgMap.set(item.plantId, await toDataUrl(src));
    }
  }

  const subtotal = items.reduce((s, it) => it.unavailable ? s : s + (it.price || 0) * it.quantity, 0);
  const discountAmt = subtotal * (Number(quote.discount) / 100);
  const afterDiscount = subtotal - discountAmt;
  const taxAmt = afterDiscount * (Number(quote.tax) / 100);
  const shippingFee = Number(quote.shipping_fee) || 0;
  const grand = afterDiscount + taxAmt + shippingFee;

  const fmt = (n: number) => n.toLocaleString('ar', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const quoteNum = quote.id.replace('q-', '').split('-')[0];
  const dateStr = new Date(quote.created_at).toLocaleDateString('ar-JO');

  const rowsHtml = items.map((it, i) => {
    const imgSrc = imgMap.get(it.plantId) ?? it.plantImage;
    const total = (it.price || 0) * it.quantity;
    const unavailCell = `<td colspan="2" style="padding:6px 8px;text-align:center;color:#c62828;font-weight:700;background:#fff5f5;">غير متوفر حاليًا</td>`;
    const priceCell = `<td style="padding:6px 8px;text-align:center;">${fmt(it.price || 0)}</td><td style="padding:6px 8px;text-align:center;font-weight:600;">${fmt(total)}</td>`;
    return `<tr style="border-bottom:1px solid #ddd;${it.unavailable ? 'opacity:0.6;' : ''}">
      <td style="padding:6px 8px;text-align:center;border-left:1px solid #e0e0e0;">${i + 1}</td>
      <td style="padding:6px 8px;text-align:right;font-weight:600;" class="ar">${it.plantNameAr}</td>
      <td style="padding:6px 8px;text-align:right;" class="ar">${it.plantNameEn || ''}</td>
      <td style="padding:6px 8px;text-align:right;" class="ar">${it.sectionNameAr}</td>
      <td style="padding:6px 8px;text-align:center;">${it.quantity}</td>
      <td style="padding:8px 8px;text-align:center;line-height:2;">
        ${it.availableSize
          ? `<span style="display:inline-flex;flex-direction:column;align-items:stretch;"><span style="color:#aaa;font-size:11px;font-weight:500;line-height:1;display:block;">${it.size || '-'}</span><span style="display:block;height:2px;background:#555;border-radius:1px;margin-top:-0.5em;"></span></span><br/><span style="color:#2e7d32;font-weight:800;font-size:14px;">${it.availableSize}</span>`
          : (it.size || '-')
        }
      </td>
      ${it.unavailable ? unavailCell : priceCell}
      <td style="padding:4px;text-align:center;width:64px;">
        ${imgSrc ? `<img src="${imgSrc}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;display:block;margin:auto;" />` : '<div style="width:56px;height:56px;background:#f0f0f0;border-radius:6px;display:inline-block;"></div>'}
      </td>
    </tr>`;
  }).join('');

  const html = `
    <div style="font-family:'Cairo',sans-serif;background:#fff;padding:28px 24px;width:900px;direction:rtl;color:#111;font-size:13px;">

      <!-- HEADER -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:3px solid #2e7d32;">
        <div style="direction:ltr;text-align:left;">
          <div style="font-size:13px;font-weight:700;color:#333;font-family:'Cormorant Garamond',serif;">Al-Qadri Agricultural Establishment</div>
          <div style="font-size:11px;color:#666;margin-top:2px;">Jerash – Al-Rashaidah</div>
          <div style="font-size:11px;color:#2e7d32;margin-top:2px;">alkadrionline.com</div>
        </div>
        ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:70px;height:70px;object-fit:contain;" />` : ''}
        <div style="text-align:right;">
          <div style="font-size:18px;font-weight:800;color:#1a1a1a;">مؤسسة ومشاتل القادري الزراعية</div>
          <div style="font-size:11px;color:#666;margin-top:2px;">جرش – الرشايدة</div>
          <div style="font-size:11px;color:#2e7d32;margin-top:2px;">alkadrionline.com</div>
        </div>
      </div>

      <!-- INFO ROW -->
      <div style="display:flex;gap:12px;margin-bottom:16px;background:#f5f9f5;border-radius:8px;padding:10px 14px;border:1px solid #c8e6c9;">
        <div style="flex:1;text-align:right;">
          <div style="font-size:10px;color:#888;">العميل</div>
          <div style="font-size:13px;font-weight:700;">${quote.customer_name}</div>
          ${quote.phone ? `<div style="font-size:11px;color:#555;direction:ltr;text-align:right;">${quote.phone}</div>` : ''}
        </div>
        <div style="width:1px;background:#ccc;"></div>
        <div style="flex:1;text-align:center;">
          <div style="font-size:10px;color:#888;">عرض سعر رقم</div>
          <div style="font-size:14px;font-weight:800;color:#2e7d32;">${quoteNum}</div>
        </div>
        <div style="width:1px;background:#ccc;"></div>
        <div style="flex:1;text-align:left;direction:ltr;">
          <div style="font-size:10px;color:#888;direction:rtl;text-align:right;">التاريخ</div>
          <div style="font-size:13px;font-weight:700;">${dateStr}</div>
        </div>
      </div>

      <!-- TABLE -->
      <table style="width:100%;border-collapse:collapse;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#2e7d32;color:#fff;">
            <th style="padding:8px 6px;text-align:center;width:30px;">#</th>
            <th style="padding:8px 6px;text-align:right;">الاسم</th>
            <th style="padding:8px 6px;text-align:right;">الوصف</th>
            <th style="padding:8px 6px;text-align:right;">القسم</th>
            <th style="padding:8px 6px;text-align:center;">الكمية</th>
            <th style="padding:8px 6px;text-align:center;">الحجم</th>
            <th style="padding:8px 6px;text-align:center;">السعر</th>
            <th style="padding:8px 6px;text-align:center;">الإجمالي</th>
            <th style="padding:8px 6px;text-align:center;">الصورة</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="background:#f1f8f1;font-weight:700;border-top:2px solid #2e7d32;">
            <td colspan="7" style="padding:8px 12px;text-align:right;">المجموع الكلي</td>
            <td style="padding:8px 12px;text-align:center;color:#2e7d32;font-size:15px;">${fmt(subtotal)} د.أ</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <!-- DISCOUNT / TAX / SHIPPING -->
      <div style="display:flex;gap:12px;margin-top:12px;direction:rtl;">
        <div style="flex:1;border:1px solid #ddd;border-radius:6px;padding:8px 12px;">
          <div style="font-size:10px;color:#888;margin-bottom:2px;">نسبة الخصم (%)</div>
          <div style="font-size:13px;font-weight:700;">${Number(quote.discount).toFixed(2)}</div>
          <div style="font-size:11px;color:#555;">— ${fmt(discountAmt)} د.أ</div>
        </div>
        <div style="flex:1;border:1px solid #ddd;border-radius:6px;padding:8px 12px;">
          <div style="font-size:10px;color:#888;margin-bottom:2px;">نسبة الضريبة (%)</div>
          <div style="font-size:13px;font-weight:700;">${Number(quote.tax).toFixed(2)}</div>
          <div style="font-size:11px;color:#555;">+ ${fmt(taxAmt)} د.أ</div>
        </div>
        ${shippingFee > 0 ? `
        <div style="flex:1;border:1px solid #1565c0;border-radius:6px;padding:8px 12px;background:#f0f4ff;">
          <div style="font-size:10px;color:#888;margin-bottom:2px;">رسوم الشحن${quote.shipping_method === 'delivery' && quote.shipping_address ? ` — ${quote.shipping_address}` : ''}</div>
          <div style="font-size:13px;font-weight:700;color:#1565c0;">${fmt(shippingFee)} د.أ</div>
        </div>` : (quote.shipping_method === 'delivery_free' ? `
        <div style="flex:1;border:1px solid #00796b;border-radius:6px;padding:8px 12px;background:#e0f2f1;">
          <div style="font-size:10px;color:#888;margin-bottom:2px;">طريقة التوصيل${quote.shipping_address ? ` — ${quote.shipping_address}` : ''}</div>
          <div style="font-size:13px;font-weight:700;color:#00796b;">🚗 توصيل مجاني</div>
        </div>` : (quote.shipping_method ? `
        <div style="flex:1;border:1px solid ${quote.shipping_method === 'pickup' ? '#2e7d32' : '#ddd'};border-radius:6px;padding:8px 12px;${quote.shipping_method === 'pickup' ? 'background:#f1f8f1;' : ''}">
          <div style="font-size:10px;color:#888;margin-bottom:2px;">${quote.shipping_method === 'pickup' ? 'طريقة التوصيل' : 'عنوان الشحن'}</div>
          <div style="font-size:13px;font-weight:700;${quote.shipping_method === 'pickup' ? 'color:#2e7d32;' : ''}">${quote.shipping_method === 'pickup' ? '🏪 استلام من المشتل' : (quote.shipping_address ?? '')}</div>
        </div>` : ''))}
        <div style="flex:2;border:2px solid #2e7d32;border-radius:6px;padding:8px 12px;background:#f1f8f1;">
          <div style="font-size:10px;color:#888;margin-bottom:2px;">الإجمالي الكلي</div>
          <div style="font-size:18px;font-weight:800;color:#2e7d32;">${fmt(grand)} د.أ</div>
        </div>
      </div>

      <!-- NOTES -->
      ${quote.notes ? `
        <div style="margin-top:12px;border:1px solid #ddd;border-radius:6px;padding:10px 14px;">
          <div style="font-size:10px;color:#888;margin-bottom:4px;">ملاحظات:</div>
          <div style="font-size:12px;line-height:1.6;">${quote.notes}</div>
        </div>` : ''}

      <!-- SIGNATURE -->
      <div style="margin-top:20px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div style="text-align:center;">
          ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:80px;height:80px;object-fit:contain;opacity:0.7;" />` : ''}
        </div>
        <div style="text-align:center;">
          <div style="font-size:12px;color:#555;">المدير العام/ ثامر احمد القادري</div>
          <div style="margin-top:8px;padding-top:8px;border-top:1px solid #ccc;width:160px;margin-left:auto;margin-right:auto;">
            <span style="font-size:10px;color:#aaa;">واقبلوا فائق الاحترام....</span>
            ${stampDataUrl ? `<div style="margin-top:6px;"><img src="${stampDataUrl}" style="width:120px;height:auto;object-fit:contain;display:inline-block;" /></div>` : ''}
          </div>
        </div>
        <div></div>
      </div>

      <!-- FOOTER -->
      <div style="margin-top:16px;padding-top:10px;border-top:2px solid #2e7d32;display:flex;justify-content:center;gap:28px;font-size:10px;color:#555;direction:ltr;text-align:center;">
        ${siteData.footer.phone ? `<span>📞 ${siteData.footer.phone}</span>` : ''}
        ${siteData.footer.email ? `<span>✉ ${siteData.footer.email}</span>` : ''}
        ${siteData.footer.website ? `<span>🌐 ${siteData.footer.website}</span>` : ''}
      </div>
      <div style="text-align:center;margin-top:4px;font-size:10px;color:#aaa;">مؤسسة ومشاتل القادري الزراعية</div>
    </div>`;

  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
  div.innerHTML = html;
  document.body.appendChild(div);
  await document.fonts.ready;

  const inner = div.firstElementChild as HTMLElement;
  const canvas = await html2canvas(inner, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#fff', logging: false });
  document.body.removeChild(div);

  const PX_PER_MM = 3.7795275591;
  const pageW = canvas.width / PX_PER_MM;
  const pageH = canvas.height / PX_PER_MM;
  const pdf = new jsPDF({ orientation: pageW > pageH ? 'l' : 'p', unit: 'mm', format: [pageW, pageH] });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, pageH);
  const safeName = quote.customer_name.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const dateTag = new Date(quote.created_at).toLocaleDateString('en-CA');
  const fileName = `${safeName}_${dateTag}.pdf`;
  return { pdf, fileName };
}

export async function downloadQuotePDF(quote: QuoteRequest, siteData: QuoteSiteData): Promise<void> {
  const { pdf, fileName } = await buildQuotePDF(quote, siteData);
  pdf.save(fileName);
}

export async function shareQuotePDFToWhatsApp(quote: QuoteRequest, siteData: QuoteSiteData): Promise<void> {
  const { pdf, fileName } = await buildQuotePDF(quote, siteData);
  const blob = pdf.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  const rawPhone = (quote.phone || '').replace(/[\s\-\(\)]/g, '');
  const phone = rawPhone.startsWith('0') ? '962' + rawPhone.slice(1) : rawPhone;
  const textMsg = `السلام عليكم ${quote.customer_name} 🌿\nتجدون مرفقاً عرض الأسعار الخاص بطلبكم.\nمشاتل القادري الزراعية`;

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: fileName, text: textMsg });
  } else {
    pdf.save(fileName);
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(textMsg)}`, '_blank');
  }
}

/* ── Invoice PDF ────────────────────────────────────────── */
import type { Invoice, InvoiceItem } from '@/lib/storage';

export async function downloadInvoicePDF(invoice: Invoice, siteData: QuoteSiteData): Promise<void> {
  const logoDataUrl = siteData.logo.customUrl ? await toDataUrl(siteData.logo.customUrl) : '';
  const stampDataUrl = await toDataUrl('/stamp.jpeg').catch(() => '');

  const items = invoice.items as InvoiceItem[];
  const total = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);

  const toDinarsFilsHtml = (amount: number) => {
    const dinars = Math.floor(amount);
    const fils = Math.round((amount - dinars) * 1000);
    return `<td style="padding:5px 8px;text-align:center;border-left:1px solid #1a3a8a;">${dinars}</td><td style="padding:5px 8px;text-align:center;">${fils > 0 ? fils : '-'}</td>`;
  };

  const rowsHtml = items.map((it, i) => {
    const rowTotal = it.quantity * it.unitPrice;
    return `<tr style="border-bottom:1px solid #c8d4f0;${i % 2 === 1 ? 'background:#f7f9ff;' : ''}">
      ${toDinarsHtml(rowTotal)}
      <td style="padding:5px 8px;text-align:right;font-weight:600;">${it.description}</td>
      <td style="padding:5px 8px;text-align:center;">${it.quantity}</td>
      ${toDinarsHtml(it.unitPrice)}
    </tr>`;
  }).join('');

  function toDinarsHtml(amount: number) {
    const dinars = Math.floor(amount);
    const fils = Math.round((amount - dinars) * 1000);
    return `<td style="padding:5px 8px;text-align:center;border-left:1px solid #c8d4f0;">${fils > 0 ? fils : '-'}</td><td style="padding:5px 8px;text-align:center;border-left:1px solid #c8d4f0;">${dinars}</td>`;
  }

  const totalDinars = Math.floor(total);
  const totalFils = Math.round((total - totalDinars) * 1000);
  const totalText = totalFils > 0 ? `${totalDinars} دينار و ${totalFils} فلس` : `${totalDinars} دينار`;

  const dateDisplay = invoice.date
    ? new Date(invoice.date).toLocaleDateString('ar-JO')
    : new Date().toLocaleDateString('ar-JO');

  const html = `
    <div style="font-family:'Cairo',sans-serif;background:#fff;padding:28px 24px;width:720px;direction:rtl;color:#111;font-size:13px;">

      <!-- HEADER -->
      <div style="text-align:center;border-bottom:3px double #1a3a8a;padding-bottom:14px;margin-bottom:14px;">
        ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:72px;height:72px;object-fit:contain;margin-bottom:6px;display:inline-block;" />` : ''}
        <div style="font-size:22px;font-weight:900;color:#1a3a8a;">مؤسسة القادري الزراعية</div>
        <div style="font-size:11px;color:#555;margin-top:3px;">لصاحبها ثامر احمد عبدالرحمن القادري</div>
        <div style="font-size:11px;color:#333;margin-top:4px;border:1px solid #1a3a8a;display:inline-block;padding:2px 16px;border-radius:3px;">
          الاردن - جرش - 0777772211 - 0778111155
        </div>
      </div>

      <!-- INVOICE NUMBER + DATE -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-size:12px;direction:ltr;text-align:left;">
          <span style="font-weight:700;font-size:13px;">No. ${invoice.number}</span>
        </div>
        <div style="font-size:16px;font-weight:900;color:#1a3a8a;text-decoration:underline;text-underline-offset:4px;">فـاتـورة</div>
        <div style="font-size:12px;">
          التاريخ: <span style="font-weight:700;">${dateDisplay}</span>
        </div>
      </div>

      <!-- CUSTOMER -->
      <div style="margin-bottom:12px;padding:7px 12px;border:1px solid #1a3a8a;border-radius:4px;font-size:13px;">
        المطلوب من: <span style="font-weight:700;margin-right:6px;">${invoice.customer_name}</span>
      </div>
      <div style="margin-bottom:12px;font-size:12px;color:#555;">المواد المبينة أدناه:</div>

      <!-- TABLE -->
      <table style="width:100%;border-collapse:collapse;border:2px solid #1a3a8a;font-size:12px;">
        <thead>
          <tr style="background:#1a3a8a;color:#fff;text-align:center;">
            <th colspan="2" style="padding:7px 6px;border-left:2px solid #fff;">السعر الاجمالي<br/><span style="font-size:10px;font-weight:400;">فلس &nbsp;|&nbsp; دينار</span></th>
            <th style="padding:7px 6px;border-left:2px solid #fff;">البيـان</th>
            <th style="padding:7px 6px;border-left:2px solid #fff;">الوحدة</th>
            <th colspan="2" style="padding:7px 6px;">السعر الافرادي<br/><span style="font-size:10px;font-weight:400;">فلس &nbsp;|&nbsp; دينار</span></th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          ${Array.from({ length: Math.max(0, 10 - items.length) }).map((_, i) =>
            `<tr style="border-bottom:1px solid #c8d4f0;${(items.length + i) % 2 === 1 ? 'background:#f7f9ff;' : ''}">
              <td style="padding:14px 8px;border-left:1px solid #c8d4f0;"></td>
              <td style="border-left:1px solid #c8d4f0;"></td>
              <td style="border-left:1px solid #c8d4f0;"></td>
              <td style="border-left:1px solid #c8d4f0;"></td>
              <td style="border-left:1px solid #c8d4f0;"></td>
              <td></td>
            </tr>`
          ).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#eef2ff;border-top:2px solid #1a3a8a;font-weight:800;">
            <td colspan="2" style="padding:8px 12px;text-align:center;font-size:13px;border-left:1px solid #1a3a8a;">
              ${totalFils > 0 ? totalFils : '-'} &nbsp;|&nbsp; ${totalDinars}
            </td>
            <td colspan="4" style="padding:8px 12px;text-align:right;font-size:13px;">
              الاجمالي: &nbsp;<span style="color:#1a3a8a;">${totalText}</span>
            </td>
          </tr>
        </tfoot>
      </table>

      ${invoice.notes ? `<div style="margin-top:10px;padding:7px 12px;border:1px solid #ddd;border-radius:4px;font-size:11px;color:#555;">${invoice.notes}</div>` : ''}

      <!-- FOOTER NOTES -->
      <div style="margin-top:14px;font-size:10px;color:#555;border-top:1px solid #ddd;padding-top:8px;">
        <p style="margin:0 0 4px;">البضاعة المباعة لا ترد ولا تستبدل</p>
        <p style="margin:0;">استلمت المواد المبينة أعلاه تماماً وبحالة جيدة وبعد المعاينة والقبول حساب، كما أنني أتعهد بتسديد القيمة المبينة أعلاه وقدرها.</p>
      </div>

      <!-- SIGNATURES -->
      <div style="display:flex;justify-content:space-between;margin-top:20px;gap:16px;">
        <div style="flex:1;text-align:center;">
          <div style="font-size:11px;color:#555;margin-bottom:30px;">توقيع المستلم</div>
          <div style="border-top:1px solid #999;padding-top:4px;font-size:10px;color:#aaa;">.............................</div>
        </div>
        <div style="flex:1;text-align:center;">
          ${stampDataUrl ? `<img src="${stampDataUrl}" style="width:80px;height:auto;object-fit:contain;display:inline-block;opacity:0.8;" />` : ''}
        </div>
        <div style="flex:1;text-align:center;">
          <div style="font-size:11px;color:#555;margin-bottom:4px;">حين الطلب وبتاريخ:</div>
          <div style="border-bottom:1px solid #999;min-width:120px;height:24px;display:inline-block;"></div>
        </div>
      </div>

      <!-- PAYMENT STATUS -->
      <div style="margin-top:18px;border-top:2px solid #1a3a8a;padding-top:12px;display:flex;gap:16px;justify-content:center;align-items:center;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:22px;height:22px;border:2px solid #16a34a;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;background:${invoice.status === 'paid' ? '#16a34a' : '#fff'};color:${invoice.status === 'paid' ? '#fff' : '#16a34a'};">
            ${invoice.status === 'paid' ? '✓' : ''}
          </div>
          <span style="font-size:13px;font-weight:700;color:#16a34a;">مدفوع</span>
        </div>
        <div style="width:1px;height:28px;background:#ddd;"></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:22px;height:22px;border:2px solid #d97706;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;background:${invoice.status === 'receivable' || !invoice.status ? '#d97706' : '#fff'};color:${invoice.status === 'receivable' || !invoice.status ? '#fff' : '#d97706'};">
            ${invoice.status === 'receivable' || !invoice.status ? '✓' : ''}
          </div>
          <span style="font-size:13px;font-weight:700;color:#d97706;">ذمم</span>
        </div>
      </div>

    </div>`;

  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
  div.innerHTML = html;
  document.body.appendChild(div);
  await document.fonts.ready;

  const inner = div.firstElementChild as HTMLElement;
  const canvas = await html2canvas(inner, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#fff', logging: false });
  document.body.removeChild(div);

  const PX_PER_MM = 3.7795275591;
  const pageW = canvas.width / PX_PER_MM;
  const pageH = canvas.height / PX_PER_MM;
  const pdf = new jsPDF({ orientation: pageW > pageH ? 'l' : 'p', unit: 'mm', format: [pageW, pageH] });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, pageH);

  const safeName = invoice.customer_name.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  pdf.save(`فاتورة_${invoice.number}_${safeName}.pdf`);
}
