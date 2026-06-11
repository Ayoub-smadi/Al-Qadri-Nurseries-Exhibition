import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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

  // Set position:relative on inner so it becomes the offsetParent for all descendants.
  // Without this, grid/block children's offsetParent jumps over static ancestors straight
  // to the fixed container, making offsetTop traversal stop at the wrong element.
  inner.style.position = 'relative';

  // Collect all photo cards and compute each card's bottom edge in CSS pixels
  // relative to the top of `inner` — used to pick safe page-break points.
  const cards = Array.from(inner.querySelectorAll('[data-card]')) as HTMLElement[];

  function cardBottomCssPx(card: HTMLElement): number {
    let top = 0;
    let el: HTMLElement | null = card;
    // Walk offsetParent chain; with inner being position:relative it IS in the chain
    while (el && el !== inner) {
      top += el.offsetTop;
      el = el.offsetParent as HTMLElement | null;
    }
    return top + card.offsetHeight;
  }

  const canvas = await html2canvas(inner, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  // Read inner height BEFORE removeChild (position:relative doesn't change its height)
  const innerCssPx = inner.offsetHeight;

  document.body.removeChild(container);

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();   // 210
  const pageH = pdf.internal.pageSize.getHeight();  // 297

  // ratio: mm per canvas pixel
  const ratio = pageW / canvas.width;
  const fullH  = canvas.height * ratio;  // total content height in mm

  // renderScale ≈ 2 (html2canvas scale option);  cssToMm converts CSS px → mm
  const renderScale = innerCssPx > 0 ? canvas.height / innerCssPx : 2;
  const cssToMm = ratio * renderScale;

  // Safe cut points: bottom edge of every card row (in mm from content top)
  const safeCutsMm = cards
    .map(c => cardBottomCssPx(c) * cssToMm)
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
      <td style="padding:6px 8px;text-align:center;">${it.quantity}</td>
      <td style="padding:8px 8px;text-align:center;line-height:2;">
        ${it.availableSize
          ? `<span style="color:#e57373;font-size:10px;font-weight:900;">✕</span> <span style="color:#aaa;font-size:11px;">${it.size || '-'}</span><br/><span style="color:#2e7d32;font-weight:800;font-size:14px;">${it.availableSize}</span>`
          : (it.size || '-')
        }
      </td>
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

/* ── Quote PDF — No Header (title only) ─────────────────── */
export async function downloadQuotePDFNoHeader(
  quote: QuoteRequest,
  customTitle?: string,
  _sections?: SiteData['sections'],
  accentColor = '#2e7d32',
  extraLine?: string
): Promise<void> {
  const items = quote.items as QuoteItem[];

  const C     = accentColor;              // main accent
  const CSOFT = accentColor + '18';       // very light tint for alternating rows
  const CMID  = accentColor + '33';       // medium tint for borders

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

  // Column order (left→right, matching header): الإجمالي | السعر | الحجم | الكمية | القسم | English | اسم النبتة | #
  const rowsHtml = items.map((it, i) => {
    const total = (it.price || 0) * it.quantity;
    const rowBg = it.unavailable ? '#f9f9f9' : i % 2 === 0 ? '#fff' : CSOFT;
    const sizeCell = it.availableSize
      ? `<span style="color:#bbb;font-size:10px;text-decoration:line-through;">${it.size || ''}</span> <span style="color:${C};font-weight:700;">${it.availableSize}</span>`
      : (it.size || '—');
    if (it.unavailable) {
      return `<tr style="background:${rowBg};border-bottom:1px solid ${CMID};">
        <td colspan="2" style="padding:10px 8px;text-align:center;color:#bbb;font-size:11px;font-style:italic;">غير متوفر</td>
        <td style="padding:10px 8px;text-align:center;font-size:11px;color:#555;">${sizeCell}</td>
        <td style="padding:10px 8px;text-align:center;font-weight:700;color:#111;font-size:13px;">${it.quantity}</td>
        <td style="padding:10px 8px;text-align:right;color:#666;font-size:11px;direction:rtl;">${it.sectionNameAr}</td>
        <td style="padding:10px 8px;text-align:right;color:#777;font-size:11px;">${it.plantNameEn || '—'}</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;font-size:13px;color:#111;direction:rtl;">${it.plantNameAr}</td>
        <td style="padding:10px 8px;text-align:center;color:#bbb;font-size:11px;width:28px;">${i + 1}</td>
      </tr>`;
    }
    return `<tr style="background:${rowBg};border-bottom:1px solid ${CMID};">
      <td style="padding:10px 10px;text-align:center;font-weight:900;color:${C};font-size:14px;">${fmt(total)}</td>
      <td style="padding:10px 8px;text-align:center;color:#555;font-size:12px;">${fmt(it.price || 0)}</td>
      <td style="padding:10px 8px;text-align:center;font-size:11px;color:#555;">${sizeCell}</td>
      <td style="padding:10px 8px;text-align:center;font-weight:700;color:#111;font-size:13px;">${it.quantity}</td>
      <td style="padding:10px 8px;text-align:right;color:#666;font-size:11px;direction:rtl;">${it.sectionNameAr}</td>
      <td style="padding:10px 8px;text-align:right;color:#777;font-size:11px;">${it.plantNameEn || '—'}</td>
      <td style="padding:10px 12px;text-align:right;font-weight:700;font-size:13px;color:#111;direction:rtl;">${it.plantNameAr}</td>
      <td style="padding:10px 8px;text-align:center;color:#bbb;font-size:11px;width:28px;">${i + 1}</td>
    </tr>`;
  }).join('');

  const hasSummaryRows = Number(quote.discount) > 0 || Number(quote.tax) > 0 || shippingFee > 0 || plantingFee > 0;
  const summaryRows = [
    Number(quote.discount) > 0 ? `
      <tr><td style="padding:4px 16px;text-align:right;color:#666;font-size:11px;">المجموع</td><td style="padding:4px 16px;text-align:center;font-size:11px;">${fmt(subtotal)} د.أ</td></tr>
      <tr><td style="padding:4px 16px;text-align:right;color:#999;font-size:11px;">خصم ${Number(quote.discount).toFixed(0)}%</td><td style="padding:4px 16px;text-align:center;color:#999;font-size:11px;">− ${fmt(discountAmt)} د.أ</td></tr>` : '',
    Number(quote.tax) > 0 ? `<tr><td style="padding:4px 16px;text-align:right;color:#666;font-size:11px;">ضريبة ${Number(quote.tax).toFixed(0)}%</td><td style="padding:4px 16px;text-align:center;font-size:11px;">+ ${fmt(taxAmt)} د.أ</td></tr>` : '',
    shippingFee > 0 ? `<tr><td style="padding:4px 16px;text-align:right;color:#666;font-size:11px;">رسوم الشحن</td><td style="padding:4px 16px;text-align:center;font-size:11px;">+ ${fmt(shippingFee)} د.أ</td></tr>` : '',
    plantingFee > 0 ? `<tr><td style="padding:4px 16px;text-align:right;color:#666;font-size:11px;">رسوم الزراعة</td><td style="padding:4px 16px;text-align:center;font-size:11px;">+ ${fmt(plantingFee)} د.أ</td></tr>` : '',
  ].filter(Boolean).join('');

  // NOTE: direction:ltr is used on ALL layout containers (flex, table wrappers) because
  // html2canvas does not correctly apply direction:rtl to flex row-reversal or table column order.
  // Arabic text correctness is achieved via direction:rtl only on leaf text elements.
  const html = `
    <div style="font-family:'Cairo',sans-serif;background:#f4f4f4;padding:30px;width:860px;direction:ltr;color:#111;font-size:13px;">
      <div style="background:#fff;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,0.1);">

        <!-- HEADER: row-reverse so title appears on RIGHT, meta on LEFT -->
        <div style="display:flex;flex-direction:row-reverse;align-items:stretch;min-height:80px;background:${C};">
          <!-- Title block (RIGHT side — first in DOM with row-reverse) -->
          <div style="flex:1;padding:22px 30px;display:flex;flex-direction:column;justify-content:center;">
            ${extraLine ? `<div style="font-size:12px;color:rgba(255,255,255,0.65);margin-bottom:4px;direction:rtl;">${extraLine}</div>` : ''}
            <div style="font-size:30px;font-weight:900;color:#fff;line-height:1;direction:rtl;">${title}</div>
          </div>
          <!-- Divider -->
          <div style="width:1px;background:rgba(255,255,255,0.2);margin:16px 0;flex-shrink:0;"></div>
          <!-- Meta block (LEFT side — second in DOM with row-reverse) -->
          <div style="width:180px;padding:22px 24px;display:flex;flex-direction:column;justify-content:center;gap:4px;flex-shrink:0;">
            <div style="font-size:10px;color:rgba(255,255,255,0.55);letter-spacing:1.5px;text-transform:uppercase;">Quote</div>
            <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:1px;">#${quoteNum}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.7);">${dateStr}</div>
          </div>
        </div>

        <!-- CLIENT STRIP: row-reverse so name is on RIGHT -->
        <div style="display:flex;flex-direction:row-reverse;align-items:center;gap:14px;background:${CSOFT};border-bottom:1px solid ${CMID};padding:11px 24px;">
          <div style="width:3px;height:28px;background:${C};border-radius:2px;flex-shrink:0;"></div>
          <div style="direction:rtl;">
            <div style="font-size:10px;color:#999;margin-bottom:2px;">العميل</div>
            <div style="font-size:15px;font-weight:800;color:#111;">${quote.customer_name}</div>
          </div>
          ${quote.phone ? `<div style="margin-left:auto;font-size:12px;color:#666;">${quote.phone}</div>` : ''}
        </div>

        <!-- TABLE: columns ordered right-to-left in DOM using RTL table trick -->
        <!-- We keep LTR table but put Arabic-primary columns right-aligned -->
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:3px solid ${C};background:#fafafa;">
              <th style="padding:10px 10px;text-align:center;font-size:11px;color:${C};font-weight:800;direction:rtl;">الإجمالي</th>
              <th style="padding:10px 8px;text-align:center;font-size:10px;color:#666;font-weight:600;">السعر</th>
              <th style="padding:10px 8px;text-align:center;font-size:10px;color:#666;font-weight:600;">الحجم</th>
              <th style="padding:10px 8px;text-align:center;font-size:11px;color:#333;font-weight:700;direction:rtl;">الكمية</th>
              <th style="padding:10px 8px;text-align:right;font-size:10px;color:#666;font-weight:600;direction:rtl;">القسم</th>
              <th style="padding:10px 8px;text-align:right;font-size:10px;color:#666;font-weight:600;">الاسم الإنجليزي</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;color:#333;font-weight:700;direction:rtl;">اسم النبتة</th>
              <th style="padding:10px 8px;text-align:center;font-size:10px;color:#bbb;font-weight:500;width:28px;">#</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <!-- FOOTER: row-reverse so notes on RIGHT, totals on LEFT -->
        <div style="display:flex;flex-direction:row-reverse;border-top:1px solid ${CMID};">

          <!-- NOTES (RIGHT side) -->
          <div style="flex:1;padding:20px 24px;">
            ${quote.notes ? `
              <div style="display:flex;flex-direction:row-reverse;align-items:center;gap:8px;margin-bottom:6px;">
                <div style="width:12px;height:2px;background:${C};border-radius:1px;flex-shrink:0;"></div>
                <span style="font-size:10px;color:${C};font-weight:700;direction:rtl;">ملاحظات</span>
              </div>
              <div style="font-size:12px;color:#444;line-height:2.1;direction:rtl;">${quote.notes}</div>
            ` : '<div style="height:28px;"></div>'}
          </div>

          <!-- TOTALS (LEFT side) -->
          <div style="width:256px;border-right:1px solid ${CMID};padding:16px 0 0;flex-shrink:0;">
            ${hasSummaryRows ? `
              <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">${summaryRows}</table>
              <div style="height:1px;background:${CMID};margin:0 16px 12px;"></div>
            ` : ''}
            <div style="margin:0 16px 16px;background:${C};padding:14px 18px;">
              <div style="display:flex;flex-direction:row-reverse;align-items:center;justify-content:space-between;">
                <div style="font-size:11px;color:rgba(255,255,255,0.8);font-weight:600;direction:rtl;">الإجمالي الكلي</div>
                <div>
                  <span style="font-size:22px;font-weight:900;color:#fff;">${fmt(grand)}</span>
                  <span style="font-size:10px;color:rgba(255,255,255,0.7);margin-left:3px;">د.أ</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- ACCENT LINE at bottom -->
        <div style="height:4px;background:${C};"></div>

      </div>
    </div>`;

  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;left:-9999px;top:-9999px;z-index:-1;';
  div.innerHTML = html;
  document.body.appendChild(div);
  await document.fonts.ready;

  const inner = div.firstElementChild as HTMLElement;
  const canvas = await html2canvas(inner, {
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
  document.body.removeChild(div);

  const PX_PER_MM = 3.7795275591;
  const pageW = canvas.width / PX_PER_MM;
  const pageH = canvas.height / PX_PER_MM;
  const pdf = new jsPDF({ orientation: pageW > pageH ? 'l' : 'p', unit: 'mm', format: [pageW, pageH] });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, pageH);
  const safeName = quote.customer_name.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const dateTag = new Date(quote.created_at).toLocaleDateString('en-CA');
  pdf.save(`عرض_بدون_ترويسة_${safeName}_${dateTag}.pdf`);
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
          ${discountAmt > 0 ? (() => {
            const subDinars = Math.floor(subtotal);
            const subFils = Math.round((subtotal - subDinars) * 1000);
            const discDinars = Math.floor(discountAmt);
            const discFils = Math.round((discountAmt - discDinars) * 1000);
            return `<tr style="background:#fff8f0;border-top:1px solid #1a3a8a;">
              <td colspan="2" style="padding:6px 12px;text-align:center;font-size:12px;border-left:1px solid #1a3a8a;color:#555;">
                ${subFils > 0 ? subFils : '-'} &nbsp;|&nbsp; ${subDinars}
              </td>
              <td colspan="4" style="padding:6px 12px;text-align:right;font-size:12px;color:#555;">
                المجموع قبل الخصم
              </td>
            </tr>
            <tr style="background:#fff0ee;border-top:1px dashed #e57373;">
              <td colspan="2" style="padding:6px 12px;text-align:center;font-size:12px;border-left:1px solid #1a3a8a;color:#c62828;">
                −${discFils > 0 ? discFils : '-'} &nbsp;|&nbsp; −${discDinars}
              </td>
              <td colspan="4" style="padding:6px 12px;text-align:right;font-size:12px;color:#c62828;">
                خصم
              </td>
            </tr>`;
          })() : ''}
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

/* ── Receipt (سند قبض) PDF ──────────────────────────────── */
export interface ReceiptPDFData {
  number: string;
  receivedFrom: string;
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
          <td style="padding:10px 14px;font-size:12px;color:#555;white-space:nowrap;vertical-align:middle;width:1%;">استلمنا من السيد / السيدة:</td>
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
              ${stampDataUrl ? `<img src="${stampDataUrl}" style="width:70px;height:auto;object-fit:contain;opacity:0.85;" />` : '<div style="width:70px;height:60px;border:1px dashed #ccc;border-radius:50%;margin:auto;"></div>'}
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
          <td style="padding:10px 14px;font-size:12px;color:#555;white-space:nowrap;vertical-align:middle;width:1%;">صرفنا للسيد / السيدة:</td>
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
              ${stampDataUrl ? `<img src="${stampDataUrl}" style="width:70px;height:auto;object-fit:contain;opacity:0.85;" />` : '<div style="width:70px;height:60px;border:1px dashed #ccc;border-radius:50%;margin:auto;"></div>'}
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
            <div dir="ltr" style="font-weight:700;">+962 777 772 211</div>
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
            <strong style="color:#1a3a8a;border-bottom:1px solid #1a3a8a;padding-bottom:1px;">&nbsp;${data.employeeName}&nbsp;</strong>،
            حامل الرقم الوطني
            <strong style="color:#1a3a8a;font-family:monospace;">&nbsp;${data.nationalId}&nbsp;</strong>،
            قد عمل لدينا في وظيفة
            <strong style="color:#1a3a8a;border-bottom:1px solid #1a3a8a;padding-bottom:1px;">&nbsp;${data.jobTitle}&nbsp;</strong>
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
