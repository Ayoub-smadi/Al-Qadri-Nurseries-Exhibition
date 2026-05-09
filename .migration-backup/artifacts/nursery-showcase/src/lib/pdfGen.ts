import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Section, Photo } from '@/lib/storage';

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
