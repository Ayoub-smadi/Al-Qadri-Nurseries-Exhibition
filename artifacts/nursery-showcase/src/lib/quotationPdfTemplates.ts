import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export type PdfTemplate = "modern" | "andalus";

export interface TemplateData {
  quotationNumber: string;
  date: string;
  customerName: string;
  companyNameAr: string;
  companyNameEn: string;
  companyLocationAr: string;
  phone: string;
  email: string;
  website: string;
  closingText: string;
  signerTitle: string;
  footerCompany: string;
  notes: string;
  items: Array<{
    name: string;
    description: string;
    category: string;
    quantity: number;
    price: number;
    total: number;
    imageUrl?: string;
  }>;
  discountValue: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  subtotal: number;
  grandTotal: number;
  stampUrl?: string;
}

function fmt(n: number) {
  return n.toLocaleString("ar-JO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function toDataUrl(src: string): Promise<string> {
  if (!src || src.startsWith("data:")) return src || "";
  try {
    const r = await fetch(src);
    const blob = await r.blob();
    return await new Promise(res => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch { return ""; }
}

async function captureAndSave(html: string, width: number, filename: string) {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `position:absolute;left:-9999px;top:0;width:${width}px;background:#fff;`;
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 200));

  try {
    const canvas = await html2canvas(wrapper.firstElementChild as HTMLElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: width,
      scrollX: 0,
      scrollY: 0,
    });
    const PX = 3.7795275591;
    const w = canvas.width / PX;
    const h = canvas.height / PX;
    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: [w, h] });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, w, h);
    pdf.save(filename);
  } finally {
    document.body.removeChild(wrapper);
  }
}

function buildRows(
  items: TemplateData["items"],
  evenBg: string,
  oddBg: string,
  totalBg: string,
  totalColor: string,
) {
  return items.map((item, i) => `
    <tr style="border-bottom:1px solid #e2e8f0;background:${i % 2 === 0 ? evenBg : oddBg};">
      <td style="padding:8px 6px;text-align:center;font-weight:700;color:#64748b;font-size:11px;">${i + 1}</td>
      <td style="padding:8px 6px;text-align:right;font-weight:700;color:#1e293b;font-size:12px;">${item.name}</td>
      <td style="padding:8px 6px;text-align:right;color:#475569;font-size:11px;">${item.description || ""}</td>
      <td style="padding:8px 6px;text-align:right;color:#64748b;font-size:11px;">${item.category || ""}</td>
      <td style="padding:8px 6px;text-align:center;font-weight:700;font-size:12px;">${item.quantity}</td>
      <td style="padding:8px 6px;text-align:center;font-weight:700;font-size:12px;">${fmt(item.price)}</td>
      <td style="padding:8px 6px;text-align:center;font-weight:800;font-size:12px;background:${totalBg};color:${totalColor};">${fmt(item.total)}</td>
      <td style="padding:4px;text-align:center;">
        ${item.imageUrl ? `<img src="${item.imageUrl}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;" />` : ""}
      </td>
    </tr>
  `).join("");
}

/* ════════════════════════════════════════════════════════════════
   Template 1 — Modern (dark slate, green accents, no company header)
   ════════════════════════════════════════════════════════════════ */
export async function downloadModernPdf(data: TemplateData, filename: string) {
  const stamp = data.stampUrl ? await toDataUrl(data.stampUrl) : "";
  const rows = buildRows(data.items, "#ffffff", "#f8fafc", "#dcfce7", "#166534");

  const subtotalRows = (data.discountAmount > 0 || data.taxAmount > 0) ? `
    <tr style="background:#f8fafc;border-top:2px solid #e2e8f0;">
      <td colspan="6" style="padding:8px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;">المجموع الفرعي</td>
      <td style="padding:8px;text-align:center;font-weight:700;color:#475569;font-size:12px;">${fmt(data.subtotal)}</td>
      <td></td>
    </tr>
    ${data.discountAmount > 0 ? `
    <tr style="background:#f0fdf4;">
      <td colspan="6" style="padding:8px 12px;text-align:right;font-size:12px;color:#16a34a;font-weight:600;">خصم ${data.discountValue}%</td>
      <td style="padding:8px;text-align:center;font-weight:700;color:#16a34a;font-size:12px;">−${fmt(data.discountAmount)}</td>
      <td></td>
    </tr>` : ""}
    ${data.taxAmount > 0 ? `
    <tr style="background:#fff7ed;">
      <td colspan="6" style="padding:8px 12px;text-align:right;font-size:12px;color:#ea580c;font-weight:600;">ضريبة ${data.taxRate}%</td>
      <td style="padding:8px;text-align:center;font-weight:700;color:#ea580c;font-size:12px;">+${fmt(data.taxAmount)}</td>
      <td></td>
    </tr>` : ""}
  ` : "";

  const html = `
  <div dir="rtl" style="font-family:Cairo,Arial,sans-serif;width:820px;background:#fff;padding:0;margin:0;">

    <!-- Top accent line -->
    <div style="height:5px;background:linear-gradient(90deg,#16a34a,#4ade80,#16a34a);"></div>

    <!-- Title bar -->
    <div style="background:#0f172a;padding:20px 32px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:26px;font-weight:900;color:#ffffff;letter-spacing:1px;">عرض سعر</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:3px;letter-spacing:3px;">QUOTATION</div>
      </div>
      <div style="text-align:left;">
        <div style="font-size:20px;font-weight:900;color:#4ade80;">#${data.quotationNumber}</div>
        <div style="font-size:11px;color:#cbd5e1;margin-top:4px;">${data.date}</div>
      </div>
    </div>

    <!-- Client ribbon -->
    <div style="background:#1e293b;padding:10px 32px;display:flex;gap:32px;align-items:center;">
      <div style="font-size:11px;color:#94a3b8;font-weight:600;">العميل</div>
      <div style="font-size:15px;font-weight:800;color:#f1f5f9;">${data.customerName}</div>
    </div>

    <!-- Table -->
    <div style="padding:20px 32px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#1e293b;color:#f1f5f9;">
            <th style="padding:10px 6px;text-align:center;width:28px;border-radius:0;">#</th>
            <th style="padding:10px 8px;text-align:right;">الاسم</th>
            <th style="padding:10px 8px;text-align:right;">الوصف</th>
            <th style="padding:10px 8px;text-align:right;">القسم</th>
            <th style="padding:10px 6px;text-align:center;width:55px;">الكمية</th>
            <th style="padding:10px 6px;text-align:center;width:70px;">السعر</th>
            <th style="padding:10px 6px;text-align:center;width:80px;background:#166534;">الإجمالي</th>
            <th style="padding:10px 6px;text-align:center;width:68px;">الصورة</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          ${subtotalRows}
          <tr style="background:#0f172a;color:#fff;">
            <td colspan="6" style="padding:14px 12px;text-align:right;font-weight:800;font-size:15px;">المجموع الكلي</td>
            <td style="padding:14px 8px;text-align:center;font-weight:900;font-size:16px;color:#4ade80;">${fmt(data.grandTotal)}</td>
            <td style="padding:14px 8px;text-align:center;font-size:11px;color:#64748b;">د.أ</td>
          </tr>
        </tfoot>
      </table>
    </div>

    ${data.notes.trim() ? `
    <div style="margin:16px 32px 0;padding:12px 16px;background:#f0fdf4;border-right:4px solid #16a34a;border-radius:6px;font-size:12px;color:#374151;white-space:pre-wrap;line-height:1.7;">${data.notes}</div>
    ` : ""}

    <!-- Closing / Signature -->
    <div style="margin:24px 32px 16px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="font-size:13px;color:#64748b;font-weight:600;">${data.closingText}</div>
      <div style="text-align:center;">
        <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:6px;">${data.signerTitle}</div>
        ${stamp ? `<img src="${stamp}" style="width:90px;height:auto;" />` : ""}
      </div>
    </div>

    <!-- Bottom accent -->
    <div style="height:4px;background:linear-gradient(90deg,#16a34a,#4ade80,#16a34a);"></div>

    <!-- Footer -->
    <div style="background:#0f172a;padding:11px 32px;display:flex;justify-content:space-between;align-items:center;font-size:10px;">
      <span style="color:#cbd5e1;font-weight:700;">${data.footerCompany}</span>
      <div style="display:flex;gap:20px;color:#94a3b8;">
        ${data.phone ? `<span>&#9742; ${data.phone}</span>` : ""}
        ${data.email ? `<span>&#9993; ${data.email}</span>` : ""}
        ${data.website ? `<span>&#127760; ${data.website}</span>` : ""}
      </div>
    </div>
  </div>`;

  await captureAndSave(html, 820, filename);
}

/* ════════════════════════════════════════════════════════════════
   Template 2 — الأندلس (warm amber / gold Islamic-inspired theme)
   ════════════════════════════════════════════════════════════════ */
export async function downloadAndalusPdf(data: TemplateData, filename: string) {
  const stamp = data.stampUrl ? await toDataUrl(data.stampUrl) : "";
  const rows = buildRows(data.items, "#fffbeb", "#ffffff", "#fef3c7", "#92400e");

  const subtotalRows = (data.discountAmount > 0 || data.taxAmount > 0) ? `
    <tr style="background:#fffbeb;border-top:2px solid #fde68a;">
      <td colspan="6" style="padding:8px 12px;text-align:right;font-size:12px;color:#78716c;font-weight:600;">المجموع الفرعي</td>
      <td style="padding:8px;text-align:center;font-weight:700;color:#57534e;font-size:12px;">${fmt(data.subtotal)}</td>
      <td></td>
    </tr>
    ${data.discountAmount > 0 ? `
    <tr style="background:#ecfdf5;">
      <td colspan="6" style="padding:8px 12px;text-align:right;font-size:12px;color:#065f46;font-weight:600;">خصم ${data.discountValue}%</td>
      <td style="padding:8px;text-align:center;font-weight:700;color:#065f46;font-size:12px;">−${fmt(data.discountAmount)}</td>
      <td></td>
    </tr>` : ""}
    ${data.taxAmount > 0 ? `
    <tr style="background:#fff7ed;">
      <td colspan="6" style="padding:8px 12px;text-align:right;font-size:12px;color:#c2410c;font-weight:600;">ضريبة ${data.taxRate}%</td>
      <td style="padding:8px;text-align:center;font-weight:700;color:#c2410c;font-size:12px;">+${fmt(data.taxAmount)}</td>
      <td></td>
    </tr>` : ""}
  ` : "";

  const html = `
  <div dir="rtl" style="font-family:Cairo,Arial,sans-serif;width:820px;background:#fff;padding:0;margin:0;border:2px solid #d97706;">

    <!-- Decorative top stripe -->
    <div style="height:6px;background:repeating-linear-gradient(90deg,#92400e 0,#92400e 18px,#d97706 18px,#d97706 36px,#fde68a 36px,#fde68a 54px,#d97706 54px,#d97706 72px);"></div>

    <!-- Header -->
    <div style="background:#78350f;padding:22px 32px;display:flex;justify-content:space-between;align-items:center;position:relative;overflow:hidden;">
      <div style="position:absolute;inset:0;opacity:0.07;background:repeating-linear-gradient(45deg,transparent,transparent 15px,#fff 15px,#fff 16px);"></div>
      <div style="position:relative;">
        <div style="font-size:32px;font-weight:900;color:#fef3c7;letter-spacing:2px;">الأندلس</div>
        <div style="font-size:11px;color:#fde68a;margin-top:2px;letter-spacing:4px;">AL-ANDALUS</div>
      </div>
      <div style="position:relative;text-align:left;">
        <div style="font-size:11px;color:#fde68a;font-weight:600;letter-spacing:1px;">عرض سعر</div>
        <div style="font-size:22px;font-weight:900;color:#fff;">#${data.quotationNumber}</div>
        <div style="font-size:11px;color:#fde68a;margin-top:3px;">${data.date}</div>
      </div>
    </div>

    <!-- Decorative middle stripe -->
    <div style="height:4px;background:repeating-linear-gradient(90deg,#d97706 0,#d97706 18px,#fde68a 18px,#fde68a 36px);"></div>

    <!-- Client ribbon -->
    <div style="background:#fffbeb;padding:11px 32px;display:flex;gap:24px;align-items:center;border-bottom:1px solid #fde68a;">
      <div style="font-size:11px;color:#92400e;font-weight:700;">إلى حضرة / السيد</div>
      <div style="font-size:16px;font-weight:900;color:#1c1917;">${data.customerName}</div>
    </div>

    <!-- Table -->
    <div style="padding:18px 32px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #fde68a;">
        <thead>
          <tr style="background:#78350f;color:#fef3c7;">
            <th style="padding:10px 6px;text-align:center;width:28px;">#</th>
            <th style="padding:10px 8px;text-align:right;">الاسم</th>
            <th style="padding:10px 8px;text-align:right;">الوصف</th>
            <th style="padding:10px 8px;text-align:right;">القسم</th>
            <th style="padding:10px 6px;text-align:center;width:55px;">الكمية</th>
            <th style="padding:10px 6px;text-align:center;width:70px;">السعر</th>
            <th style="padding:10px 6px;text-align:center;width:80px;background:#d97706;">الإجمالي</th>
            <th style="padding:10px 6px;text-align:center;width:68px;">الصورة</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          ${subtotalRows}
          <tr style="background:#78350f;color:#fef3c7;">
            <td colspan="6" style="padding:14px 12px;text-align:right;font-weight:800;font-size:15px;">المجموع الكلي</td>
            <td style="padding:14px 8px;text-align:center;font-weight:900;font-size:16px;color:#fde68a;">${fmt(data.grandTotal)}</td>
            <td style="padding:14px 8px;text-align:center;font-size:11px;color:#fde68a;">د.أ</td>
          </tr>
        </tfoot>
      </table>
    </div>

    ${data.notes.trim() ? `
    <div style="margin:16px 32px 0;padding:12px 16px;background:#fffbeb;border-right:4px solid #d97706;border-radius:6px;font-size:12px;color:#374151;white-space:pre-wrap;line-height:1.7;">${data.notes}</div>
    ` : ""}

    <!-- Closing / Signature -->
    <div style="margin:24px 32px 16px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="font-size:13px;color:#78716c;font-weight:600;">${data.closingText}</div>
      <div style="text-align:center;">
        <div style="font-size:12px;font-weight:700;color:#1c1917;margin-bottom:6px;">${data.signerTitle}</div>
        ${stamp ? `<img src="${stamp}" style="width:90px;height:auto;" />` : ""}
      </div>
    </div>

    <!-- Bottom decorative stripe -->
    <div style="height:4px;background:repeating-linear-gradient(90deg,#d97706 0,#d97706 18px,#fde68a 18px,#fde68a 36px);"></div>

    <!-- Footer -->
    <div style="background:#78350f;padding:11px 32px;display:flex;justify-content:space-between;align-items:center;font-size:10px;">
      <span style="color:#fde68a;font-weight:800;">${data.footerCompany}</span>
      <div style="display:flex;gap:20px;color:#fcd34d;">
        ${data.phone ? `<span>&#9742; ${data.phone}</span>` : ""}
        ${data.email ? `<span>&#9993; ${data.email}</span>` : ""}
        ${data.website ? `<span>&#127760; ${data.website}</span>` : ""}
      </div>
    </div>
  </div>`;

  await captureAndSave(html, 820, filename);
}
