import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Section, Photo, QuoteItem, QuoteRequest } from '@/lib/storage';

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

/* ── Quote PDF ─────────────────────────────────────────── */
export async function downloadQuotePDF(
  quote: QuoteRequest,
  siteData: { titleAr: string; titleEn: string; logo: { customUrl: string }; footer: { phone?: string; email?: string; website?: string } }
): Promise<void> {
  const items = quote.items as QuoteItem[];
  const logoDataUrl = siteData.logo.customUrl ? await toDataUrl(siteData.logo.customUrl) : '';

  // Pre-load plant images
  const imgMap = new Map<string, string>();
  for (const item of items) {
    if (item.plantImage && !imgMap.has(item.plantId)) {
      imgMap.set(item.plantId, await toDataUrl(item.plantImage));
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
      <td style="padding:6px 8px;text-align:center;">${it.size || '-'}</td>
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
          <div style="font-size:10px;color:#888;margin-bottom:2px;">رسوم الشحن${quote.shipping_destination ? ` — ${quote.shipping_destination}` : ''}</div>
          <div style="font-size:13px;font-weight:700;color:#1565c0;">${fmt(shippingFee)} د.أ</div>
        </div>` : (quote.shipping_destination ? `
        <div style="flex:1;border:1px solid #ddd;border-radius:6px;padding:8px 12px;">
          <div style="font-size:10px;color:#888;margin-bottom:2px;">منطقة الشحن</div>
          <div style="font-size:13px;font-weight:700;">${quote.shipping_destination}</div>
        </div>` : '')}
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

  // Single-page PDF sized to content — no row splitting
  const PX_PER_MM = 3.7795275591;
  const pageW = canvas.width / PX_PER_MM;
  const pageH = canvas.height / PX_PER_MM;
  const pdf = new jsPDF({ orientation: pageW > pageH ? 'l' : 'p', unit: 'mm', format: [pageW, pageH] });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, pageH);
  pdf.save(`quote-${quoteNum}.pdf`);
}
