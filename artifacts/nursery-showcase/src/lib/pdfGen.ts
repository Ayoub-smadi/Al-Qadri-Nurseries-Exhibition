import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { sliceCanvasToPdf } from './pdfMultiPage';
import { Section, Photo, QuoteItem, QuoteRequest, SiteData } from '@/lib/storage';

export interface PDFSectionInput {
  section: Section;
  photos: Photo[];
}

/* Pre-load an image URL into a data URL — uses fetch() to avoid CORS/canvas tainting */
async function toDataUrl(src: string): Promise<string> {
  if (!src) return 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  if (src.startsWith('data:')) return src;
  // 1) Try fetch (works for same-origin /api/images/... and CORS-enabled URLs)
  try {
    const res = await fetch(src, { cache: 'force-cache' });
    if (res.ok) {
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch { /* fall through to canvas method */ }
  // 2) Fallback: canvas with crossOrigin (for external CDN images)
  try {
    return await new Promise<string>((resolve, reject) => {
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
        <div data-card style="break-inside:avoid;page-break-inside:avoid;">
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
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
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

  // Measure card positions BEFORE html2canvas using getBoundingClientRect.
  // container is position:fixed;top:0 so inner.getBoundingClientRect().top ≈ 0,
  // meaning card.getBoundingClientRect().bottom is the card bottom in CSS px from
  // inner's top — no offsetParent traversal needed, works correctly with CSS Grid.
  const innerTop = inner.getBoundingClientRect().top;
  const cards = Array.from(inner.querySelectorAll('[data-card]')) as HTMLElement[];
  const cardBottomsCssPx = cards.map(c => c.getBoundingClientRect().bottom - innerTop);

  const canvas = await html2canvas(inner, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const innerCssPx = inner.offsetHeight;   // actual content height (not clipped)
  document.body.removeChild(container);

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();   // 210
  const pageH = pdf.internal.pageSize.getHeight();  // 297

  // ratio: mm per canvas pixel (based on width, which is exact)
  const ratio = pageW / canvas.width;
  const fullH  = canvas.height * ratio;  // total content height in mm

  // cssToMm: converts a CSS-pixel measurement to mm
  // renderScale ≈ 2 (html2canvas scale:2), but derived from actual canvas/CSS heights
  const renderScale = innerCssPx > 0 ? canvas.height / innerCssPx : 2;
  const cssToMm = ratio * renderScale;

  // Safe cut points: bottom edge of every card (in mm). Duplicates are fine — sort removes them.
  const safeCutsMm = [...new Set(cardBottomsCssPx.map(b => Math.round(b * cssToMm)))]
    .sort((a, b) => a - b);

  let drawn = 0; // mm

  while (drawn < fullH) {
    if (drawn > 0) pdf.addPage();

    const idealCut = Math.min(drawn + pageH, fullH);

    // Find the largest card bottom that fits within this page (avoids splitting a card)
    const suitable = safeCutsMm.filter(c => c > drawn && c <= idealCut);
    const cutAt = suitable.length > 0 ? Math.max(...suitable) : idealCut;

    const sliceH = cutAt - drawn;   // mm
    const srcY   = drawn / ratio;   // canvas px
    const srcH   = sliceH / ratio;  // canvas px

    const slice = document.createElement('canvas');
    slice.width  = canvas.width;
    slice.height = Math.ceil(srcH);
    slice.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, sliceH);

    drawn = cutAt;
  }

  pdf.save(filename);
}

/* ── Quote PDF shared builder ───────────────────────────── */
type QuoteSiteData = { titleAr: string; titleEn: string; logo: { customUrl: string }; footer: { phone?: string; email?: string; website?: string }; sections?: SiteData['sections'] };

async function buildQuotePDF(quote: QuoteRequest, siteData: QuoteSiteData): Promise<{ canvas: HTMLCanvasElement; inner: HTMLElement; div: HTMLElement; fileName: string }> {
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
  const plantingFee = Number(quote.planting_fee) || 0;
  const grand = afterDiscount + taxAmt + shippingFee + plantingFee;

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
      <td style="padding:8px 8px;text-align:center;line-height:2;">
        ${it.availableSize
          ? `<span style="color:#e57373;font-size:10px;font-weight:900;">✕</span> <span style="color:#aaa;font-size:11px;">${it.size || '-'}</span><br/><span style="color:#2e7d32;font-weight:800;font-size:14px;">${it.availableSize}</span>`
          : (it.size || '-')
        }
      </td>
      <td style="padding:6px 8px;text-align:center;">${it.quantity}</td>
      ${it.unavailable ? unavailCell : priceCell}
      <td style="padding:4px;text-align:center;width:90px;">
        ${imgSrc ? `<img src="${imgSrc}" style="width:82px;height:82px;object-fit:cover;border-radius:6px;display:block;margin:auto;" />` : '<div style="width:82px;height:82px;background:#f0f0f0;border-radius:6px;display:inline-block;"></div>'}
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
          <div style="font-size:13px;color:#888;">العميل</div>
          <div style="font-size:18px;font-weight:700;">${quote.customer_name}</div>
          ${quote.phone ? `<div style="font-size:13px;color:#555;direction:ltr;text-align:right;">${quote.phone}</div>` : ''}
        </div>
        <div style="width:1px;background:#ccc;"></div>
        <div style="flex:1;text-align:center;">
          <div style="font-size:13px;color:#888;">عرض سعر رقم</div>
          <div style="font-size:19px;font-weight:800;color:#2e7d32;">${quoteNum}</div>
        </div>
        <div style="width:1px;background:#ccc;"></div>
        <div style="flex:1;text-align:left;direction:ltr;">
          <div style="font-size:13px;color:#888;direction:rtl;text-align:right;">التاريخ</div>
          <div style="font-size:18px;font-weight:700;">${dateStr}</div>
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
            <th style="padding:8px 6px;text-align:center;">الحجم</th>
            <th style="padding:8px 6px;text-align:center;">الكمية</th>
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
        </div>` : (quote.shipping_method && quote.shipping_method !== 'delivery_plant' && quote.shipping_method !== 'plant_only' ? `
        <div style="flex:1;border:1px solid ${quote.shipping_method === 'pickup' ? '#2e7d32' : '#ddd'};border-radius:6px;padding:8px 12px;${quote.shipping_method === 'pickup' ? 'background:#f1f8f1;' : ''}">
          <div style="font-size:10px;color:#888;margin-bottom:2px;">${quote.shipping_method === 'pickup' ? 'طريقة التوصيل' : 'عنوان الشحن'}</div>
          <div style="font-size:13px;font-weight:700;${quote.shipping_method === 'pickup' ? 'color:#2e7d32;' : ''}">${quote.shipping_method === 'pickup' ? '🏪 استلام من المشتل' : (quote.shipping_address ?? '')}</div>
        </div>` : ''))}
        ${plantingFee > 0 ? `
        <div style="flex:1;border:1px solid #e65100;border-radius:6px;padding:8px 12px;background:#fff8f0;">
          <div style="font-size:10px;color:#888;margin-bottom:2px;">${quote.shipping_method === 'plant_only' ? '🌱 رسوم الزراعة' : `🌱 رسوم توصيل وزراعة${quote.shipping_address ? ` — ${quote.shipping_address}` : ''}`}</div>
          <div style="font-size:13px;font-weight:700;color:#e65100;">${fmt(plantingFee)} د.أ</div>
        </div>` : (quote.shipping_method === 'delivery_plant' && plantingFee === 0 ? `
        <div style="flex:1;border:1px solid #e65100;border-radius:6px;padding:8px 12px;background:#fff8f0;">
          <div style="font-size:10px;color:#888;margin-bottom:2px;">طريقة التوصيل${quote.shipping_address ? ` — ${quote.shipping_address}` : ''}</div>
          <div style="font-size:13px;font-weight:700;color:#e65100;">🚚🌱 توصيل وزراعة</div>
        </div>` : (quote.shipping_method === 'plant_only' && plantingFee === 0 ? `
        <div style="flex:1;border:1px solid #e65100;border-radius:6px;padding:8px 12px;background:#fff8f0;">
          <div style="font-size:10px;color:#888;margin-bottom:2px;">طريقة التوصيل</div>
          <div style="font-size:13px;font-weight:700;color:#e65100;">🌱 زراعة الأشجار</div>
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

      <!-- CLOSING + SIGNATURE -->
      <div style="margin-top:20px;text-align:center;">
        <div style="font-size:14px;color:#444;">واقبلوا فائق الاحترام،،،</div>
      </div>
      <div style="margin-top:10px;display:flex;justify-content:flex-end;padding:0 24px;align-items:flex-start;">
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
          <div style="font-size:13px;font-weight:700;color:#1e293b;text-align:center;">المدير العام/ ثامر احمد القادري</div>
          ${stampDataUrl ? `<img src="${stampDataUrl}" style="width:120px;height:110px;object-fit:contain;display:block;" />` : ''}
        </div>
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
  const canvas = await html2canvas(inner, {
    scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#fff', logging: false,
    width: inner.scrollWidth, height: inner.scrollHeight,
  });
  const safeName = quote.customer_name.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const dateTag = new Date(quote.created_at).toLocaleDateString('en-CA');
  const fileName = `${safeName}_${dateTag}.pdf`;
  return { canvas, inner, div, fileName };
}

export async function downloadQuotePDF(quote: QuoteRequest, siteData: QuoteSiteData): Promise<void> {
  const { canvas, inner, div, fileName } = await buildQuotePDF(quote, siteData);
  try {
    await sliceCanvasToPdf(canvas, inner, fileName, inner.scrollWidth);
  } finally {
    document.body.removeChild(div);
  }
}

/* ── Quote PDF — No Header (title only) ─────────────────── */
export async function downloadQuotePDFNoHeader(
  quote: QuoteRequest,
  customTitle?: string,
  _sections?: SiteData['sections'],
  accentColor = '#2e7d32',
  extraLine?: string,
  stampUrl?: string,
  signatoryName?: string,
  brandName?: string
): Promise<void> {
  const items = quote.items as QuoteItem[];

  const C     = accentColor;              // main accent
  const CSOFT = accentColor + '18';       // very light tint for alternating rows
  const CMID  = accentColor + '33';       // medium tint for borders

  // Pre-load stamp if provided
  const stampDataUrl = stampUrl ? await toDataUrl(stampUrl).catch(() => '') : '';

  const subtotal = items.reduce((s, it) => it.unavailable ? s : s + (it.price || 0) * it.quantity, 0);
  const discountAmt = subtotal * (Number(quote.discount) / 100);
  const afterDiscount = subtotal - discountAmt;
  const taxAmt = afterDiscount * (Number(quote.tax) / 100);
  const shippingFee = Number(quote.shipping_fee) || 0;
  const plantingFee = Number(quote.planting_fee) || 0;
  const grand = afterDiscount + taxAmt + shippingFee + plantingFee;

  const fmt = (n: number) => n.toLocaleString('ar', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const quoteNum = quote.id.replace('q-', '').split('-')[0];
  const dateStr = new Date(quote.created_at).toLocaleDateString('ar-JO');
  const title = customTitle || 'عرض سعر';

  // Columns left→right in DOM (html2canvas renders LTR regardless of direction:rtl on container)
  // Arabic text in cells uses text-align:right so it flows correctly
  const rowsHtml = items.map((it, i) => {
    const total = (it.price || 0) * it.quantity;
    const even = i % 2 === 0;
    const rowBg = it.unavailable ? '#f9f9f9' : even ? '#fff' : CSOFT;
    const sizeCell = it.availableSize
      ? `<span style="color:#ccc;font-size:9px;text-decoration:line-through;">${it.size || ''}</span><br/><span style="color:${C};font-weight:700;">${it.availableSize}</span>`
      : (it.size || '—');
    if (it.unavailable) {
      return `<tr style="background:${rowBg};border-bottom:1px solid #f0f0f0;opacity:0.65;">
        <td style="padding:9px 8px;text-align:center;color:#ccc;font-size:11px;width:30px;">${i + 1}</td>
        <td class="ar-right" style="padding:9px 12px;font-weight:700;font-size:13px;color:#bbb;">${it.plantNameAr}</td>
        <td class="ar-right" style="padding:9px 8px;color:#bbb;font-size:11px;">${it.plantNameEn || ''}</td>
        <td class="ar-right" style="padding:9px 8px;color:#bbb;font-size:11px;">${it.sectionNameAr}</td>
        <td style="padding:9px 8px;text-align:center;font-size:11px;color:#bbb;">${sizeCell}</td>
        <td style="padding:9px 8px;text-align:center;color:#bbb;font-weight:700;">${it.quantity}</td>
        <td class="ar" colspan="2" style="padding:9px 8px;text-align:center;color:#bbb;font-style:italic;font-size:11px;">غير متوفر</td>
      </tr>`;
    }
    return `<tr style="background:${rowBg};border-bottom:1px solid #f0f0f0;">
      <td style="padding:9px 8px;text-align:center;color:#ccc;font-size:11px;width:30px;">${i + 1}</td>
      <td class="ar-right" style="padding:9px 12px;font-weight:700;font-size:13px;color:#111;">${it.plantNameAr}</td>
      <td class="ar-right" style="padding:9px 8px;color:#888;font-size:11px;">${it.plantNameEn || ''}</td>
      <td class="ar-right" style="padding:9px 8px;color:#777;font-size:11px;">${it.sectionNameAr}</td>
      <td style="padding:9px 8px;text-align:center;font-size:11px;color:#666;">${sizeCell}</td>
      <td style="padding:9px 8px;text-align:center;font-weight:700;color:#111;">${it.quantity}</td>
      <td style="padding:9px 8px;text-align:center;color:#666;font-size:12px;">${fmt(it.price || 0)}</td>
      <td style="padding:9px 14px;text-align:center;font-weight:900;color:${C};font-size:14px;">${fmt(total)}</td>
    </tr>`;
  }).join('');

  const hasSummaryRows = Number(quote.discount) > 0 || Number(quote.tax) > 0 || shippingFee > 0 || plantingFee > 0;
  const summaryRows = [
    Number(quote.discount) > 0 ? `
      <tr><td style="padding:4px 0;text-align:right;color:#777;font-size:11px;">المجموع</td><td style="padding:4px 0;text-align:left;font-size:11px;">${fmt(subtotal)} د.أ</td></tr>
      <tr><td style="padding:4px 0;text-align:right;color:#aaa;font-size:11px;">خصم ${Number(quote.discount).toFixed(0)}%</td><td style="padding:4px 0;text-align:left;color:#aaa;font-size:11px;">− ${fmt(discountAmt)} د.أ</td></tr>` : '',
    Number(quote.tax) > 0 ? `<tr><td style="padding:4px 0;text-align:right;color:#777;font-size:11px;">ضريبة ${Number(quote.tax).toFixed(0)}%</td><td style="padding:4px 0;text-align:left;font-size:11px;">+ ${fmt(taxAmt)} د.أ</td></tr>` : '',
    shippingFee > 0 ? `<tr><td style="padding:4px 0;text-align:right;color:#777;font-size:11px;">رسوم الشحن</td><td style="padding:4px 0;text-align:left;font-size:11px;">+ ${fmt(shippingFee)} د.أ</td></tr>` : '',
    plantingFee > 0 ? `<tr><td style="padding:4px 0;text-align:right;color:#777;font-size:11px;">رسوم الزراعة</td><td style="padding:4px 0;text-align:left;font-size:11px;">+ ${fmt(plantingFee)} د.أ</td></tr>` : '',
  ].filter(Boolean).join('');

  // LAYOUT: html2canvas ignores direction:rtl for flex/table order and renders LTR.
  // Fix: use dir="rtl" HTML *attribute* + unicode-bidi:bidi-override on each Arabic text
  // node via the embedded <style> + class="ar". This is identical to how buildQuotePDF
  // achieves correct Arabic shaping — the class is meaningless without a stylesheet,
  // so we embed one here.
  // Left-side content goes FIRST in the DOM (html2canvas places it on the left).
  const html = `
    <style>
      .ar { direction: rtl; unicode-bidi: bidi-override; }
      .ar-right { direction: rtl; unicode-bidi: bidi-override; text-align: right; }
    </style>
    <div dir="rtl" style="font-family:'Cairo',sans-serif;background:#fff;width:860px;direction:rtl;color:#111;font-size:13px;">

      <!-- TOP ACCENT STRIPE -->
      <div style="height:7px;background:${C};"></div>

      <!-- HEADER: meta (LEFT) first in DOM, title+client (RIGHT) last in DOM -->
      <div style="padding:26px 32px 18px;display:flex;justify-content:space-between;align-items:center;">
        <!-- LEFT: quote # and date -->
        <div style="text-align:left;flex-shrink:0;">
          <div class="ar" style="font-size:9px;color:#bbb;margin-bottom:5px;">رقم العرض</div>
          <div style="font-size:38px;font-weight:900;color:${C};line-height:1;">#${quoteNum}</div>
          <div style="font-size:11px;color:#aaa;margin-top:6px;">${dateStr}</div>
        </div>
        <!-- RIGHT: title + client name stacked -->
        <div style="text-align:right;">
          ${extraLine ? `<div class="ar-right" style="font-size:12px;color:#aaa;margin-bottom:4px;">${extraLine}</div>` : ''}
          <div class="ar-right" style="font-size:38px;font-weight:900;color:#111;line-height:1.1;">${title}</div>
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid #eee;">
            <div class="ar-right" style="font-size:9px;color:#bbb;margin-bottom:3px;">العميل</div>
            <div class="ar-right" style="font-size:18px;font-weight:800;color:#333;">${quote.customer_name}</div>
            ${quote.phone ? `<div style="font-size:12px;color:#999;margin-top:2px;">${quote.phone}</div>` : ''}
          </div>
        </div>
      </div>

      <!-- THIN DIVIDER -->
      <div style="height:1px;background:${C};opacity:0.2;margin:0 32px;"></div>

      <!-- TABLE -->
      <table style="width:100%;border-collapse:collapse;margin-top:4px;">
        <thead>
          <tr style="background:${C};">
            <th style="padding:10px 8px;text-align:center;color:rgba(255,255,255,0.5);font-size:10px;width:30px;">#</th>
            <th class="ar-right" style="padding:10px 12px;color:#fff;font-size:11px;font-weight:700;">اسم النبتة</th>
            <th class="ar-right" style="padding:10px 8px;color:rgba(255,255,255,0.65);font-size:10px;font-weight:600;">الاسم الإنجليزي</th>
            <th class="ar-right" style="padding:10px 8px;color:rgba(255,255,255,0.65);font-size:10px;font-weight:600;">القسم</th>
            <th class="ar" style="padding:10px 8px;text-align:center;color:rgba(255,255,255,0.65);font-size:10px;font-weight:600;">الحجم</th>
            <th class="ar" style="padding:10px 8px;text-align:center;color:#fff;font-size:11px;font-weight:700;">الكمية</th>
            <th class="ar" style="padding:10px 8px;text-align:center;color:rgba(255,255,255,0.65);font-size:10px;font-weight:600;">السعر</th>
            <th class="ar" style="padding:10px 14px;text-align:center;color:#fff;font-size:11px;font-weight:800;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <!-- FOOTER: totals (LEFT) first, notes (RIGHT) last -->
      <div style="display:flex;justify-content:space-between;border-top:2px solid ${C};margin-top:1px;">

        <!-- LEFT: totals -->
        <div style="width:256px;padding:18px 24px;flex-shrink:0;">
          ${hasSummaryRows ? `
            <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">${summaryRows}</table>
            <div style="height:1px;background:#eee;margin-bottom:12px;"></div>
          ` : ''}
          <div style="background:${C};padding:14px 18px;">
            <div class="ar-right" style="font-size:10px;color:rgba(255,255,255,0.75);margin-bottom:4px;">الإجمالي الكلي</div>
            <div style="text-align:right;font-size:24px;font-weight:900;color:#fff;line-height:1;">${fmt(grand)} <span style="font-size:11px;opacity:0.8;">د.أ</span></div>
          </div>
        </div>

        <!-- RIGHT: notes -->
        <div style="flex:1;padding:18px 28px;text-align:right;border-right:1px solid #f0f0f0;">
          ${quote.notes ? `
            <div class="ar-right" style="font-size:9px;color:${C};font-weight:700;margin-bottom:6px;">ملاحظات</div>
            <div class="ar-right" style="font-size:12px;color:#555;line-height:2.2;">${quote.notes}</div>
          ` : ''}
        </div>

      </div>

      <!-- SIGNATURE BLOCK -->
      ${(stampDataUrl || signatoryName) ? `
      <div style="display:flex;justify-content:flex-start;padding:14px 32px 10px;border-top:1px solid #eee;">
        <div style="text-align:center;">
          ${signatoryName ? `<div style="font-size:13px;font-weight:700;color:#333;margin-bottom:6px;">${signatoryName}</div>` : ''}
          ${stampDataUrl ? `<img src="${stampDataUrl}" style="width:100px;height:100px;object-fit:contain;display:block;" />` : ''}
        </div>
      </div>` : ''}

      <!-- BOTTOM ACCENT STRIPE -->
      <div style="height:4px;background:${C};"></div>

    </div>`;

  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
  div.innerHTML = html;
  document.body.appendChild(div);

  // Explicitly load all needed Cairo weights before rendering
  await Promise.allSettled([
    document.fonts.load('400 13px Cairo'),
    document.fonts.load('700 13px Cairo'),
    document.fonts.load('800 13px Cairo'),
    document.fonts.load('900 13px Cairo'),
  ]);
  await document.fonts.ready;

  // inner is the <div dir="rtl"> (first element after the <style> tag)
  const inner = div.querySelector('[dir="rtl"]') as HTMLElement;
  const canvas = await html2canvas(inner, {
    scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#fff', logging: false,
    width: inner.scrollWidth, height: inner.scrollHeight,
  });
  const safeName = quote.customer_name.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const safeBrand = brandName ? brandName.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') + '_' : '';
  const dateTag = new Date(quote.created_at).toLocaleDateString('en-CA');
  const filename = `${safeBrand}عرض_${safeName}_${dateTag}.pdf`;
  try {
    await sliceCanvasToPdf(canvas, inner, filename, inner.scrollWidth);
  } finally {
    document.body.removeChild(div);
  }
}

export async function shareQuotePDFToWhatsApp(quote: QuoteRequest, siteData: QuoteSiteData): Promise<void> {
  const { canvas, div, fileName } = await buildQuotePDF(quote, siteData);
  document.body.removeChild(div);
  const PX_PER_MM = 3.7795275591;
  const pageW = canvas.width / PX_PER_MM;
  const pageH = canvas.height / PX_PER_MM;
  const pdf = new jsPDF({ orientation: pageW > pageH ? 'l' : 'p', unit: 'mm', format: [pageW, pageH] });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, pageH);
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
  const signatureDataUrl = await toDataUrl('/signature-thamer.png').catch(() => '');

  const items = invoice.items as InvoiceItem[];
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const discountAmt = Number(invoice.discount) || 0;
  const total = Math.max(0, subtotal - discountAmt);

  const toDinarsFilsHtml = (amount: number) => {
    const dinars = Math.floor(amount);
    const fils = Math.round((amount - dinars) * 1000);
    return `<td style="padding:5px 8px;text-align:center;border-left:1px solid #1a3a8a;">${dinars}</td><td style="padding:5px 8px;text-align:center;">${fils > 0 ? fils : '-'}</td>`;
  };

  const rowsHtml = items.map((it, i) => {
    const rowTotal = it.quantity * it.unitPrice;
    return `<tr data-row style="border-bottom:1px solid #c8d4f0;${i % 2 === 1 ? 'background:#f7f9ff;' : ''}">
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
          <tr data-row style="background:#1a3a8a;color:#fff;text-align:center;">
            <th colspan="2" style="padding:7px 6px;border-left:2px solid #fff;">السعر الاجمالي<br/><span style="font-size:10px;font-weight:400;">فلس &nbsp;|&nbsp; دينار</span></th>
            <th style="padding:7px 6px;border-left:2px solid #fff;">البيـان</th>
            <th style="padding:7px 6px;border-left:2px solid #fff;">الوحدة</th>
            <th colspan="2" style="padding:7px 6px;">السعر الافرادي<br/><span style="font-size:10px;font-weight:400;">فلس &nbsp;|&nbsp; دينار</span></th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          ${Array.from({ length: Math.max(0, 10 - items.length) }).map((_, i) =>
            `<tr data-row style="border-bottom:1px solid #c8d4f0;${(items.length + i) % 2 === 1 ? 'background:#f7f9ff;' : ''}">
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
          ${discountAmt > 0 ? (() => {
            const subDinars = Math.floor(subtotal);
            const subFils = Math.round((subtotal - subDinars) * 1000);
            const discDinars = Math.floor(discountAmt);
            const discFils = Math.round((discountAmt - discDinars) * 1000);
            return `<tr data-row style="background:#fff8f0;border-top:1px solid #1a3a8a;">
              <td colspan="2" style="padding:6px 12px;text-align:center;font-size:12px;border-left:1px solid #1a3a8a;color:#555;">
                ${subFils > 0 ? subFils : '-'} &nbsp;|&nbsp; ${subDinars}
              </td>
              <td colspan="4" style="padding:6px 12px;text-align:right;font-size:12px;color:#555;">
                المجموع قبل الخصم
              </td>
            </tr>
            <tr data-row style="background:#fff0ee;border-top:1px dashed #e57373;">
              <td colspan="2" style="padding:6px 12px;text-align:center;font-size:12px;border-left:1px solid #1a3a8a;color:#c62828;">
                −${discFils > 0 ? discFils : '-'} &nbsp;|&nbsp; −${discDinars}
              </td>
              <td colspan="4" style="padding:6px 12px;text-align:right;font-size:12px;color:#c62828;">
                خصم
              </td>
            </tr>`;
          })() : ''}
          <tr data-row style="background:#eef2ff;border-top:2px solid #1a3a8a;font-weight:800;">
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
          ${stampDataUrl ? `<img src="${stampDataUrl}" style="width:110px;height:auto;object-fit:contain;display:inline-block;opacity:0.85;" />` : ''}
          ${signatureDataUrl ? `<div><img src="${signatureDataUrl}" style="width:100px;height:auto;object-fit:contain;display:inline-block;margin-top:4px;" /></div>` : ''}
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
        <div style="width:1px;height:28px;background:#ddd;"></div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:22px;height:22px;border:2px solid #2563eb;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;background:${invoice.status === 'online' ? '#2563eb' : '#fff'};color:${invoice.status === 'online' ? '#fff' : '#2563eb'};">
            ${invoice.status === 'online' ? '✓' : ''}
          </div>
          <span style="font-size:13px;font-weight:700;color:#2563eb;">أونلاين</span>
        </div>
      </div>

    </div>`;

  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
  div.innerHTML = html;
  document.body.appendChild(div);
  await document.fonts.ready;

  const inner = div.firstElementChild as HTMLElement;

  // Measure row bottoms BEFORE html2canvas (see downloadCatalogPDF for the same
  // pattern) so a page break never lands in the middle of a table row.
  const innerTop = inner.getBoundingClientRect().top;
  const rows = Array.from(inner.querySelectorAll('[data-row]')) as HTMLElement[];
  const rowBottomsCssPx = rows.map(r => r.getBoundingClientRect().bottom - innerTop);

  const canvas = await html2canvas(inner, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#fff', logging: false });
  const innerCssPx = inner.offsetHeight;
  document.body.removeChild(div);

  // Fit onto standard A4 pages instead of one custom oversized page — a page wider
  // than A4/Letter (or an image taller than one A4 page) gets clipped by printers/
  // viewers that print at "actual size" instead of auto-scaling. If the invoice fits
  // on one page it's rendered centered as before; longer invoices now flow onto
  // additional pages instead of being cut off.
  const A4_W = 210;
  const A4_H = 297;
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const ratio = A4_W / canvas.width;
  const fullH = canvas.height * ratio;

  if (fullH <= A4_H) {
    const yOffset = (A4_H - fullH) / 2;
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, yOffset, A4_W, fullH);
  } else {
    const renderScale = innerCssPx > 0 ? canvas.height / innerCssPx : 2;
    const cssToMm = ratio * renderScale;
    const safeCutsMm = [...new Set(rowBottomsCssPx.map(b => Math.round(b * cssToMm)))].sort((a, b) => a - b);

    let drawn = 0; // mm
    let first = true;
    while (drawn < fullH) {
      if (!first) pdf.addPage();
      first = false;

      const idealCut = Math.min(drawn + A4_H, fullH);
      const suitable = safeCutsMm.filter(c => c > drawn && c <= idealCut);
      const cutAt = suitable.length > 0 ? Math.max(...suitable) : idealCut;

      const sliceH = cutAt - drawn;   // mm
      const srcY = drawn / ratio;     // canvas px
      const srcH = sliceH / ratio;    // canvas px

      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.ceil(srcH);
      slice.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, A4_W, sliceH);
      drawn = cutAt;
    }
  }

  const safeName = invoice.customer_name.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  pdf.save(`فاتورة_${invoice.number}_${safeName}.pdf`);
}

/* ── Receipt (سند قبض) PDF ──────────────────────────────── */
export interface ReceiptPDFData {
  number: string;
  receivedFrom: string;
  namePrefix?: string;
  amount: number;
  amountText: string;
  description: string;
  paymentMethod: 'cash' | 'check' | 'transfer';
  date: string;
  notes?: string;
  logoUrl?: string;
}

export async function downloadReceiptPDF(data: ReceiptPDFData): Promise<void> {
  const logoDataUrl = data.logoUrl ? await toDataUrl(data.logoUrl).catch(() => '') : '';
  const stampDataUrl = await toDataUrl('/stamp.jpeg').catch(() => '');

  const dinars = Math.floor(data.amount);
  const fils = Math.round((data.amount - dinars) * 1000);

  const paymentLabels = { cash: 'نقداً', check: 'شيك', transfer: 'تحويل بنكي' };
  const paymentMethodAr = paymentLabels[data.paymentMethod] || 'نقداً';

  const checkBox = (checked: boolean) =>
    `<span style="display:inline-block;width:14px;height:14px;border:2px solid #1a3a8a;border-radius:2px;text-align:center;line-height:11px;font-size:11px;color:#1a3a8a;vertical-align:middle;margin-left:4px;">${checked ? '✓' : ''}</span>`;

  const dateDisplay = data.date
    ? new Date(data.date).toLocaleDateString('ar-JO')
    : new Date().toLocaleDateString('ar-JO');

  const html = `
    <div style="font-family:'Cairo',sans-serif;background:#fff;width:700px;direction:rtl;color:#111;font-size:13px;padding:0;box-sizing:border-box;">

      <!-- HEADER -->
      <div style="background:#fff;padding:20px 24px 14px;border-bottom:3px solid #1a3a8a;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="text-align:right;vertical-align:middle;width:34%;">
            <div style="font-size:20px;font-weight:900;color:#1a3a8a;line-height:1.3;">مؤسسة القادري الزراعية</div>
            <div style="font-size:10px;color:#555;margin-top:2px;">جرش - الرشايدة · الأردن</div>
            <div style="font-size:10px;color:#1a3a8a;direction:ltr;text-align:right;margin-top:1px;">0777772211 · 0778111155</div>
          </td>
          <td style="text-align:center;vertical-align:middle;width:32%;">
            ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:68px;height:68px;object-fit:contain;" />` : ''}
          </td>
          <td style="text-align:left;vertical-align:middle;width:34%;direction:ltr;">
            <div style="font-size:12px;font-weight:700;color:#1a3a8a;">Al-Qadri Agricultural Foundation</div>
            <div style="font-size:10px;color:#555;margin-top:2px;">Jarash - Al-Rashaydeh · Jordan</div>
          </td>
        </tr></table>
      </div>

      <!-- TITLE + NUMBER + DATE -->
      <div style="padding:10px 24px;background:#f0f4ff;border-bottom:1px solid #c8d4f0;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="width:33%;text-align:right;direction:ltr;font-size:11px;color:#555;vertical-align:middle;">
            <span style="color:#888;">Date: </span><strong>${dateDisplay}</strong>
          </td>
          <td style="width:34%;text-align:center;vertical-align:middle;">
            <div style="font-size:18px;font-weight:900;color:#1a3a8a;border:2px solid #1a3a8a;display:inline-block;padding:4px 24px;border-radius:4px;background:#fff;">سـنـد قـبـض</div>
          </td>
          <td style="width:33%;text-align:left;direction:ltr;font-size:11px;color:#555;vertical-align:middle;">
            <span style="color:#888;">No. </span><strong style="font-size:14px;color:#1a3a8a;">${data.number.padStart(6, '0')}</strong>
          </td>
        </tr></table>
      </div>

      <!-- BODY -->
      <div style="padding:18px 24px;">

        <!-- Received from -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #c8d4f0;border-radius:6px;background:#fafbff;"><tr>
          <td style="padding:10px 14px;font-size:12px;color:#555;white-space:nowrap;vertical-align:middle;width:1%;">استلمنا من ${data.namePrefix ?? 'السيد / السيدة'}:</td>
          <td style="padding:10px 14px 6px;font-size:15px;font-weight:800;color:#1a1a1a;border-bottom:2px solid #1a3a8a;vertical-align:bottom;">${data.receivedFrom}</td>
        </tr></table>

        <!-- Amount row -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;"><tr>
          <td style="font-size:12px;color:#555;white-space:nowrap;vertical-align:middle;padding-left:8px;width:1%;">مبلغاً وقدره:</td>
          <td style="vertical-align:middle;width:30%;">
            <table style="width:100%;border-collapse:collapse;border:2px solid #1a3a8a;border-radius:6px;overflow:hidden;"><tr>
              <td style="padding:6px 10px;text-align:center;border-left:2px solid #1a3a8a;background:#fff;">
                <div style="font-size:8px;color:#888;margin-bottom:1px;">دينار</div>
                <div style="font-size:17px;font-weight:900;color:#1a3a8a;">${dinars}</div>
              </td>
              <td style="padding:6px 10px;text-align:center;background:#fff;width:70px;">
                <div style="font-size:8px;color:#888;margin-bottom:1px;">فلس</div>
                <div style="font-size:17px;font-weight:900;color:#1a3a8a;">${fils > 0 ? fils : '---'}</div>
              </td>
            </tr></table>
          </td>
          <td style="padding-right:8px;vertical-align:middle;">
            <div style="padding:8px 12px;border:1px solid #c8d4f0;border-radius:6px;background:#fafbff;">
              <div style="font-size:8px;color:#888;margin-bottom:2px;">المبلغ كتابةً</div>
              <div style="font-size:13px;font-weight:700;">${data.amountText || (dinars + ' دينار' + (fils > 0 ? ` و ${fils} فلس` : ''))}</div>
            </div>
          </td>
        </tr></table>

        <!-- Description -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #c8d4f0;border-radius:6px;background:#fafbff;"><tr>
          <td style="padding:10px 14px;font-size:12px;color:#555;white-space:nowrap;vertical-align:middle;width:1%;">وذلك عن:</td>
          <td style="padding:10px 14px;font-size:14px;font-weight:700;vertical-align:middle;">${data.description}</td>
        </tr></table>

        <!-- Payment method -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:${data.notes ? '12px' : '18px'};border:1px solid #e0e0e0;border-radius:6px;"><tr>
          <td style="padding:8px 14px;font-size:12px;color:#555;white-space:nowrap;vertical-align:middle;width:1%;">طريقة الدفع:</td>
          <td style="padding:8px 14px;vertical-align:middle;">
            <span style="margin-left:16px;">${checkBox(data.paymentMethod === 'cash')} <span style="font-size:12px;font-weight:${data.paymentMethod === 'cash' ? '700' : '400'};">نقداً</span></span>
            <span style="margin-left:16px;">${checkBox(data.paymentMethod === 'check')} <span style="font-size:12px;font-weight:${data.paymentMethod === 'check' ? '700' : '400'};">شيك</span></span>
            <span style="margin-left:16px;">${checkBox(data.paymentMethod === 'transfer')} <span style="font-size:12px;font-weight:${data.paymentMethod === 'transfer' ? '700' : '400'};">تحويل بنكي</span></span>
          </td>
          <td style="padding:8px 14px;font-size:12px;font-weight:700;color:#1a3a8a;text-align:left;vertical-align:middle;direction:ltr;">${paymentMethodAr}</td>
        </tr></table>

        ${data.notes ? `
        <div style="margin-bottom:18px;padding:8px 14px;border:1px solid #e0e0e0;border-radius:6px;background:#fffdf0;">
          <span style="font-size:10px;color:#888;">ملاحظات: </span>
          <span style="font-size:12px;">${data.notes}</span>
        </div>` : ''}

        <!-- Signatures -->
        <div style="border-top:2px solid #1a3a8a;margin-top:20px;padding-top:14px;">
          <table style="width:100%;border-collapse:collapse;"><tr>
            <td style="text-align:center;vertical-align:top;width:33%;">
              <div style="font-size:11px;color:#555;margin-bottom:32px;">توقيع الدافع</div>
              <div style="border-top:1px solid #999;padding-top:4px;font-size:10px;color:#aaa;">...........................</div>
            </td>
            <td style="text-align:center;vertical-align:middle;width:34%;">
              ${stampDataUrl ? `<img src="${stampDataUrl}" style="width:110px;height:auto;object-fit:contain;opacity:0.85;" />` : '<div style="width:110px;height:90px;border:1px dashed #ccc;border-radius:50%;margin:auto;"></div>'}
            </td>
            <td style="text-align:center;vertical-align:top;width:33%;">
              <div style="font-size:11px;color:#555;margin-bottom:8px;">توقيع المستلم</div>
              <div style="font-size:12px;font-weight:700;color:#1a3a8a;">م. ثامر القادري</div>
              <div style="border-top:1px solid #999;margin-top:8px;padding-top:4px;font-size:10px;color:#aaa;">...........................</div>
            </td>
          </tr></table>
        </div>

      </div>

      <!-- FOOTER -->
      <div style="padding:8px 24px;background:#f0f4ff;border-top:2px solid #1a3a8a;text-align:center;font-size:9px;color:#888;direction:ltr;">
        Al-Qadri Agricultural Foundation · Jarash - Al-Rashaydeh · Jordan · 0777772211
      </div>
    </div>`;

  // Use onclone to place the element at 0,0 in the cloned document — this is the only
  // reliable way to capture RTL content without clipping in html2canvas.
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;z-index:-1;';
  host.innerHTML = html;
  document.body.appendChild(host);
  await document.fonts.ready;

  const canvas = await html2canvas(host.firstElementChild as HTMLElement, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#fff',
    logging: false,
    onclone: (_doc: Document, el: HTMLElement) => {
      el.style.position = 'fixed';
      el.style.left = '0';
      el.style.top = '0';
    },
  });
  document.body.removeChild(host);

  const A4_W = 210;
  const A4_H = 297;
  const imgW = A4_W;
  const imgH = (canvas.height / canvas.width) * A4_W;
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const yOffset = imgH < A4_H ? (A4_H - imgH) / 2 : 0;
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, yOffset, imgW, imgH);
  const safeName = data.receivedFrom.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  pdf.save(`سند_قبض_${data.number}_${safeName}.pdf`);
}

/* ── Disbursement (سند صرف) PDF ─────────────────────────── */
export interface DisbursementPDFData {
  number: string;
  paidTo: string;
  namePrefix?: string;
  amount: number;
  amountText: string;
  description: string;
  paymentMethod: 'cash' | 'check' | 'transfer';
  date: string;
  notes?: string;
  logoUrl?: string;
}

export async function downloadDisbursementPDF(data: DisbursementPDFData): Promise<void> {
  const logoDataUrl = data.logoUrl ? await toDataUrl(data.logoUrl).catch(() => '') : '';
  const stampDataUrl = await toDataUrl('/stamp.jpeg').catch(() => '');

  const dinars = Math.floor(data.amount);
  const fils = Math.round((data.amount - dinars) * 1000);

  const paymentLabels = { cash: 'نقداً', check: 'شيك', transfer: 'تحويل بنكي' };
  const paymentMethodAr = paymentLabels[data.paymentMethod] || 'نقداً';

  const checkBox = (checked: boolean) =>
    `<span style="display:inline-block;width:14px;height:14px;border:2px solid #7c2d12;border-radius:2px;text-align:center;line-height:11px;font-size:11px;color:#7c2d12;vertical-align:middle;margin-left:4px;">${checked ? '✓' : ''}</span>`;

  const dateDisplay = data.date
    ? new Date(data.date).toLocaleDateString('ar-JO')
    : new Date().toLocaleDateString('ar-JO');

  const html = `
    <div style="font-family:'Cairo',sans-serif;background:#fff;width:700px;direction:rtl;color:#111;font-size:13px;padding:0;box-sizing:border-box;">

      <!-- HEADER -->
      <div style="background:#fff;padding:20px 24px 14px;border-bottom:3px solid #7c2d12;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="text-align:right;vertical-align:middle;width:34%;">
            <div style="font-size:20px;font-weight:900;color:#7c2d12;line-height:1.3;">مؤسسة القادري الزراعية</div>
            <div style="font-size:10px;color:#555;margin-top:2px;">جرش - الرشايدة · الأردن</div>
            <div style="font-size:10px;color:#7c2d12;direction:ltr;text-align:right;margin-top:1px;">0777772211 · 0778111155</div>
          </td>
          <td style="text-align:center;vertical-align:middle;width:32%;">
            ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:68px;height:68px;object-fit:contain;" />` : ''}
          </td>
          <td style="text-align:left;vertical-align:middle;width:34%;direction:ltr;">
            <div style="font-size:12px;font-weight:700;color:#7c2d12;">Al-Qadri Agricultural Foundation</div>
            <div style="font-size:10px;color:#555;margin-top:2px;">Jarash - Al-Rashaydeh · Jordan</div>
          </td>
        </tr></table>
      </div>

      <!-- TITLE + NUMBER + DATE -->
      <div style="padding:10px 24px;background:#fff7f5;border-bottom:1px solid #fcd5c8;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="width:33%;text-align:right;direction:ltr;font-size:11px;color:#555;vertical-align:middle;">
            <span style="color:#888;">Date: </span><strong>${dateDisplay}</strong>
          </td>
          <td style="width:34%;text-align:center;vertical-align:middle;">
            <div style="font-size:18px;font-weight:900;color:#7c2d12;border:2px solid #7c2d12;display:inline-block;padding:4px 24px;border-radius:4px;background:#fff;">سـنـد صـرف</div>
          </td>
          <td style="width:33%;text-align:left;direction:ltr;font-size:11px;color:#555;vertical-align:middle;">
            <span style="color:#888;">No. </span><strong style="font-size:14px;color:#7c2d12;">${data.number.padStart(6, '0')}</strong>
          </td>
        </tr></table>
      </div>

      <!-- BODY -->
      <div style="padding:18px 24px;">

        <!-- Paid to -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #fcd5c8;border-radius:6px;background:#fff7f5;"><tr>
          <td style="padding:10px 14px;font-size:12px;color:#555;white-space:nowrap;vertical-align:middle;width:1%;">صرفنا للـ ${data.namePrefix ?? 'السيد / السيدة'}:</td>
          <td style="padding:10px 14px 6px;font-size:15px;font-weight:800;color:#1a1a1a;border-bottom:2px solid #7c2d12;vertical-align:bottom;">${data.paidTo}</td>
        </tr></table>

        <!-- Amount row -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;"><tr>
          <td style="font-size:12px;color:#555;white-space:nowrap;vertical-align:middle;padding-left:8px;width:1%;">مبلغاً وقدره:</td>
          <td style="vertical-align:middle;width:30%;">
            <table style="width:100%;border-collapse:collapse;border:2px solid #7c2d12;border-radius:6px;overflow:hidden;"><tr>
              <td style="padding:6px 10px;text-align:center;border-left:2px solid #7c2d12;background:#fff;">
                <div style="font-size:8px;color:#888;margin-bottom:1px;">دينار</div>
                <div style="font-size:17px;font-weight:900;color:#7c2d12;">${dinars}</div>
              </td>
              <td style="padding:6px 10px;text-align:center;background:#fff;width:70px;">
                <div style="font-size:8px;color:#888;margin-bottom:1px;">فلس</div>
                <div style="font-size:17px;font-weight:900;color:#7c2d12;">${fils > 0 ? fils : '---'}</div>
              </td>
            </tr></table>
          </td>
          <td style="padding-right:8px;vertical-align:middle;">
            <div style="padding:8px 12px;border:1px solid #fcd5c8;border-radius:6px;background:#fff7f5;">
              <div style="font-size:8px;color:#888;margin-bottom:2px;">المبلغ كتابةً</div>
              <div style="font-size:13px;font-weight:700;">${data.amountText || (dinars + ' دينار' + (fils > 0 ? ` و ${fils} فلس` : ''))}</div>
            </div>
          </td>
        </tr></table>

        <!-- Description -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #fcd5c8;border-radius:6px;background:#fff7f5;"><tr>
          <td style="padding:10px 14px;font-size:12px;color:#555;white-space:nowrap;vertical-align:middle;width:1%;">وذلك عن:</td>
          <td style="padding:10px 14px;font-size:14px;font-weight:700;vertical-align:middle;">${data.description}</td>
        </tr></table>

        <!-- Payment method -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:${data.notes ? '12px' : '18px'};border:1px solid #e0e0e0;border-radius:6px;"><tr>
          <td style="padding:8px 14px;font-size:12px;color:#555;white-space:nowrap;vertical-align:middle;width:1%;">طريقة الدفع:</td>
          <td style="padding:8px 14px;vertical-align:middle;">
            <span style="margin-left:16px;">${checkBox(data.paymentMethod === 'cash')} <span style="font-size:12px;font-weight:${data.paymentMethod === 'cash' ? '700' : '400'};">نقداً</span></span>
            <span style="margin-left:16px;">${checkBox(data.paymentMethod === 'check')} <span style="font-size:12px;font-weight:${data.paymentMethod === 'check' ? '700' : '400'};">شيك</span></span>
            <span style="margin-left:16px;">${checkBox(data.paymentMethod === 'transfer')} <span style="font-size:12px;font-weight:${data.paymentMethod === 'transfer' ? '700' : '400'};">تحويل بنكي</span></span>
          </td>
          <td style="padding:8px 14px;font-size:12px;font-weight:700;color:#7c2d12;text-align:left;vertical-align:middle;direction:ltr;">${paymentMethodAr}</td>
        </tr></table>

        ${data.notes ? `
        <div style="margin-bottom:18px;padding:8px 14px;border:1px solid #e0e0e0;border-radius:6px;background:#fffdf0;">
          <span style="font-size:10px;color:#888;">ملاحظات: </span>
          <span style="font-size:12px;">${data.notes}</span>
        </div>` : ''}

        <!-- Signatures -->
        <div style="border-top:2px solid #7c2d12;margin-top:20px;padding-top:14px;">
          <table style="width:100%;border-collapse:collapse;"><tr>
            <td style="text-align:center;vertical-align:top;width:33%;">
              <div style="font-size:11px;color:#555;margin-bottom:32px;">توقيع المستلم</div>
              <div style="border-top:1px solid #999;padding-top:4px;font-size:10px;color:#aaa;">...........................</div>
            </td>
            <td style="text-align:center;vertical-align:middle;width:34%;">
              ${stampDataUrl ? `<img src="${stampDataUrl}" style="width:110px;height:auto;object-fit:contain;opacity:0.85;" />` : '<div style="width:110px;height:90px;border:1px dashed #ccc;border-radius:50%;margin:auto;"></div>'}
            </td>
            <td style="text-align:center;vertical-align:top;width:33%;">
              <div style="font-size:11px;color:#555;margin-bottom:8px;">توقيع الصارف</div>
              <div style="font-size:12px;font-weight:700;color:#7c2d12;">م. ثامر القادري</div>
              <div style="border-top:1px solid #999;margin-top:8px;padding-top:4px;font-size:10px;color:#aaa;">...........................</div>
            </td>
          </tr></table>
        </div>

      </div>

      <!-- FOOTER -->
      <div style="padding:8px 24px;background:#fff7f5;border-top:2px solid #7c2d12;text-align:center;font-size:9px;color:#888;direction:ltr;">
        Al-Qadri Agricultural Foundation · Jarash - Al-Rashaydeh · Jordan · 0777772211
      </div>
    </div>`;

  // Use onclone to position the element at 0,0 in the cloned document for clean capture
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;z-index:-1;';
  host.innerHTML = html;
  document.body.appendChild(host);
  await document.fonts.ready;

  const canvas = await html2canvas(host.firstElementChild as HTMLElement, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#fff',
    logging: false,
    onclone: (_doc: Document, el: HTMLElement) => {
      el.style.position = 'fixed';
      el.style.left = '0';
      el.style.top = '0';
    },
  });
  document.body.removeChild(host);

  const A4_W = 210;
  const A4_H = 297;
  const imgW = A4_W;
  const imgH = (canvas.height / canvas.width) * A4_W;
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const yOffset = imgH < A4_H ? (A4_H - imgH) / 2 : 0;
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, yOffset, imgW, imgH);
  const safeName = data.paidTo.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  pdf.save(`سند_صرف_${data.number}_${safeName}.pdf`);
}

/* ── Experience Certificate PDF ─────────────────────────── */
export interface CertificateData {
  employeeName: string;
  nationalId: string;
  jobTitle: string;
  startDate: string;
  endDate: string;
  issueDate: string;
  logoUrl?: string;
  stampUrl?: string;
  phone?: string;
}

export async function downloadCertificatePDF(data: CertificateData): Promise<void> {
  const logoDataUrl  = data.logoUrl  ? await toDataUrl(data.logoUrl).catch(() => '') : '';
  const stampDataUrl = await toDataUrl('/stamp.jpeg').catch(() => '');

  const html = `
    <div style="font-family:'Cairo',sans-serif;background:#fff;width:794px;min-height:1122px;direction:rtl;color:#111;font-size:14px;position:relative;box-sizing:border-box;">

      <!-- DECORATIVE BORDER -->
      <div style="position:absolute;inset:0;border:10px solid #1a3a8a;pointer-events:none;z-index:0;"></div>
      <div style="position:absolute;inset:14px;border:2px solid #b8922a;pointer-events:none;z-index:0;"></div>

      <!-- INNER CONTENT -->
      <div style="position:relative;z-index:1;padding:48px 56px;">

        <!-- HEADER ROW: logo + contact -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;border-bottom:3px double #1a3a8a;padding-bottom:20px;">
          <!-- logo + name center -->
          <div style="text-align:center;flex:1;">
            ${logoDataUrl ? `<img src="${logoDataUrl}" style="width:90px;height:90px;object-fit:contain;display:inline-block;" />` : ''}
            <div style="font-size:20px;font-weight:900;color:#1a3a8a;margin-top:4px;">مؤسسة القادري الزراعية</div>
          </div>
          <!-- contact block -->
          <div style="text-align:right;font-size:11px;color:#444;line-height:2;min-width:160px;">
            <div style="font-weight:700;color:#1a3a8a;font-size:12px;">Al-Qadri Agricultural Foundation</div>
            <div style="color:#666;margin-bottom:4px;">Jarash - Al-Rashaydeh</div>
            <div dir="ltr" style="font-weight:700;">${data.phone || '+962 777 772 211'}</div>
            <div dir="ltr">tamerqadri@gmail.com</div>
          </div>
        </div>

        <!-- TITLE -->
        <div style="text-align:center;margin-bottom:32px;">
          <div style="display:inline-block;border:2px solid #b8922a;border-radius:6px;padding:10px 56px;background:#fdf8ee;">
            <span style="font-size:24px;font-weight:900;color:#1a3a8a;letter-spacing:0;">شهادة خبرة</span>
          </div>
        </div>

        <!-- SALUTATION -->
        <p style="font-size:14px;font-weight:700;color:#333;margin-bottom:22px;text-align:center;">إلى من يهمه الأمر،،،</p>

        <!-- BODY TEXT -->
        <div style="font-size:15px;line-height:2.2;color:#222;text-align:justify;">
          <p style="margin-bottom:16px;">
            تشهد <strong>مؤسسة القادري الزراعية</strong> بأن الموظف
            <strong style="color:#1a3a8a;">&nbsp;${data.employeeName}&nbsp;</strong>${data.nationalId ? `،
            حامل الرقم الوطني
            <strong style="color:#1a3a8a;font-family:monospace;">&nbsp;${data.nationalId}&nbsp;</strong>` : ''}،
            قد عمل لدينا في وظيفة
            <strong style="color:#1a3a8a;">&nbsp;${data.jobTitle}&nbsp;</strong>
            خلال الفترة الممتدة من
            <strong>&nbsp;${data.startDate}&nbsp;</strong>
            إلى
            <strong>&nbsp;${data.endDate}&nbsp;</strong>،
            وقد كان أثناء فترة عمله مثالاً للالتزام والانضباط وحسن السيرة والسلوك.
          </p>
          <p style="margin-bottom:16px;">
            كما أظهر كفاءة عالية في أداء المهام الموكلة إليه، وكان يتمتع بروح العمل الجماعي والقدرة على تحمل ضغط العمل.
          </p>
          <p style="margin-bottom:28px;">
            وقد أعطيت له هذه الشهادة بناءً على طلبه دون أدنى مسؤولية على المؤسسة.
          </p>
          <p style="margin-bottom:32px;text-align:right;">
            وتفضلوا بقبول فائق الاحترام ،،،
          </p>
        </div>

        <!-- SIGNATURE + STAMP ROW -->
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:8px;">
          <!-- stamp right (RTL) -->
          <div style="text-align:center;width:160px;">
            <div style="font-size:12px;color:#555;margin-bottom:8px;">الختم</div>
            ${stampDataUrl ? `<img src="${stampDataUrl}" style="width:120px;height:120px;object-fit:contain;" />` : '<div style="width:120px;height:120px;border:1px dashed #ccc;border-radius:50%;margin:auto;"></div>'}
          </div>
          <!-- signature left (RTL) -->
          <div style="text-align:center;width:200px;">
            <div style="font-size:12px;color:#555;margin-bottom:6px;">التوقيع</div>
            <div style="border-top:1px solid #333;padding-top:6px;">
              <div style="font-size:14px;font-weight:700;color:#1a3a8a;">م. ثامر القادري</div>
              <div style="font-size:11px;color:#555;">صاحب المؤسسة</div>
            </div>
          </div>
        </div>

        <!-- ISSUE DATE -->
        <div style="margin-top:28px;text-align:center;font-size:12px;color:#666;border-top:1px solid #ddd;padding-top:12px;">
          <span style="font-weight:600;">التاريخ:</span> ${data.issueDate}
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
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [pageW, pageH] });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, pageH);
  const safeName = data.employeeName.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  pdf.save(`شهادة_خبرة_${safeName}.pdf`);
}
