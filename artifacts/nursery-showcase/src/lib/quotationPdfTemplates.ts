import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export type PdfTemplate = "modern" | "qadri-old" | "no-header";

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
   Template 2 — قادري قديم (green Al-Qadri style WITH company header)
   ════════════════════════════════════════════════════════════════ */
export async function downloadQadriOldPdf(data: TemplateData, filename: string) {
  const stamp = data.stampUrl ? await toDataUrl(data.stampUrl) : "";
  const rows = buildRows(data.items, "#f0fdf4", "#ffffff", "#dcfce7", "#14532d");

  const subtotalRows = (data.discountAmount > 0 || data.taxAmount > 0) ? `
    <tr style="background:#f0fdf4;border-top:2px solid #86efac;">
      <td colspan="6" style="padding:8px 12px;text-align:right;font-size:12px;color:#4b5563;font-weight:600;">المجموع الفرعي</td>
      <td style="padding:8px;text-align:center;font-weight:700;color:#374151;font-size:12px;">${fmt(data.subtotal)}</td>
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
  <div dir="rtl" style="font-family:Cairo,Arial,sans-serif;width:820px;background:#fff;padding:0;margin:0;border:2px solid #16a34a;">

    <!-- Top accent line -->
    <div style="height:6px;background:linear-gradient(90deg,#14532d,#16a34a,#4ade80,#16a34a,#14532d);"></div>

    <!-- Company letterhead -->
    <div style="background:#14532d;padding:20px 32px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:26px;font-weight:900;color:#f0fdf4;letter-spacing:1px;">مؤسسة ومشاتل القادري الزراعية</div>
        <div style="font-size:11px;color:#86efac;margin-top:3px;letter-spacing:3px;">AL-QADRI AGRICULTURAL ESTABLISHMENT</div>
        <div style="font-size:10px;color:#bbf7d0;margin-top:6px;display:flex;gap:16px;">
          ${data.phone ? `<span>&#9742; ${data.phone}</span>` : ""}
          ${data.email ? `<span>&#9993; ${data.email}</span>` : ""}
          ${data.website ? `<span>&#127760; ${data.website}</span>` : ""}
        </div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:36px;font-weight:900;color:#4ade80;">🌱</div>
        <div style="font-size:10px;color:#86efac;margin-top:2px;">جرش – الرشايدة</div>
      </div>
    </div>

    <!-- Divider stripe -->
    <div style="height:4px;background:repeating-linear-gradient(90deg,#16a34a 0,#16a34a 20px,#4ade80 20px,#4ade80 40px);"></div>

    <!-- Quotation title bar -->
    <div style="background:#f0fdf4;padding:12px 32px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #86efac;">
      <div>
        <div style="font-size:18px;font-weight:900;color:#14532d;">عرض سعر</div>
        <div style="font-size:10px;color:#16a34a;letter-spacing:2px;">QUOTATION</div>
      </div>
      <div style="text-align:left;">
        <div style="font-size:20px;font-weight:900;color:#16a34a;">#${data.quotationNumber}</div>
        <div style="font-size:11px;color:#4b5563;margin-top:2px;">${data.date}</div>
      </div>
    </div>

    <!-- Client ribbon -->
    <div style="background:#fff;padding:10px 32px;display:flex;gap:24px;align-items:center;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:11px;color:#16a34a;font-weight:700;">إلى حضرة / السيد</div>
      <div style="font-size:16px;font-weight:900;color:#111827;">${data.customerName}</div>
    </div>

    <!-- Table -->
    <div style="padding:16px 32px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #d1fae5;">
        <thead>
          <tr style="background:#14532d;color:#f0fdf4;">
            <th style="padding:10px 6px;text-align:center;width:28px;">#</th>
            <th style="padding:10px 8px;text-align:right;">الاسم</th>
            <th style="padding:10px 8px;text-align:right;">الوصف</th>
            <th style="padding:10px 8px;text-align:right;">القسم</th>
            <th style="padding:10px 6px;text-align:center;width:55px;">الكمية</th>
            <th style="padding:10px 6px;text-align:center;width:70px;">السعر</th>
            <th style="padding:10px 6px;text-align:center;width:80px;background:#16a34a;">الإجمالي</th>
            <th style="padding:10px 6px;text-align:center;width:68px;">الصورة</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          ${subtotalRows}
          <tr style="background:#14532d;color:#f0fdf4;">
            <td colspan="6" style="padding:14px 12px;text-align:right;font-weight:800;font-size:15px;">المجموع الكلي</td>
            <td style="padding:14px 8px;text-align:center;font-weight:900;font-size:16px;color:#4ade80;">${fmt(data.grandTotal)}</td>
            <td style="padding:14px 8px;text-align:center;font-size:11px;color:#86efac;">د.أ</td>
          </tr>
        </tfoot>
      </table>
    </div>

    ${data.notes.trim() ? `
    <div style="margin:16px 32px 0;padding:12px 16px;background:#f0fdf4;border-right:4px solid #16a34a;border-radius:6px;font-size:12px;color:#374151;white-space:pre-wrap;line-height:1.7;">${data.notes}</div>
    ` : ""}

    <!-- Closing / Signature -->
    <div style="margin:24px 32px 16px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="font-size:13px;color:#6b7280;font-weight:600;">${data.closingText}</div>
      <div style="text-align:center;">
        <div style="font-size:12px;font-weight:700;color:#14532d;margin-bottom:6px;">${data.signerTitle}</div>
        ${stamp ? `<img src="${stamp}" style="width:90px;height:auto;" />` : ""}
      </div>
    </div>

    <!-- Bottom stripe -->
    <div style="height:4px;background:repeating-linear-gradient(90deg,#16a34a 0,#16a34a 20px,#4ade80 20px,#4ade80 40px);"></div>

    <!-- Footer -->
    <div style="background:#14532d;padding:11px 32px;display:flex;justify-content:space-between;align-items:center;font-size:10px;">
      <span style="color:#bbf7d0;font-weight:800;">${data.footerCompany}</span>
      <div style="display:flex;gap:20px;color:#86efac;">
        ${data.phone ? `<span>&#9742; ${data.phone}</span>` : ""}
        ${data.email ? `<span>&#9993; ${data.email}</span>` : ""}
        ${data.website ? `<span>&#127760; ${data.website}</span>` : ""}
      </div>
    </div>

    <!-- Bottom accent -->
    <div style="height:6px;background:linear-gradient(90deg,#14532d,#16a34a,#4ade80,#16a34a,#14532d);"></div>
  </div>`;

  await captureAndSave(html, 820, filename);
}

/* ════════════════════════════════════════════════════════════════
   Template 3 — دون ترويسة (clean table, no company header)
   ════════════════════════════════════════════════════════════════ */
export async function downloadNoHeaderPdf(data: TemplateData, filename: string) {
  const stamp = data.stampUrl ? await toDataUrl(data.stampUrl) : "";
  const rows = buildRows(data.items, "#ffffff", "#f8fafc", "#f1f5f9", "#1e293b");

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
  <div dir="rtl" style="font-family:Cairo,Arial,sans-serif;width:820px;background:#fff;padding:32px 40px;margin:0;">

    <!-- Title + meta row -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #e2e8f0;">
      <div>
        <div style="font-size:28px;font-weight:900;color:#1e293b;">عرض سعر</div>
        <div style="font-size:11px;color:#94a3b8;letter-spacing:3px;margin-top:2px;">QUOTATION</div>
      </div>
      <div style="text-align:left;">
        <div style="font-size:13px;color:#64748b;font-weight:600;">رقم العرض: <span style="color:#1e293b;font-weight:800;">#${data.quotationNumber}</span></div>
        <div style="font-size:12px;color:#94a3b8;margin-top:4px;">التاريخ: ${data.date}</div>
      </div>
    </div>

    <!-- Client line -->
    <div style="margin-bottom:20px;display:flex;gap:12px;align-items:center;">
      <div style="font-size:12px;color:#64748b;font-weight:600;">إلى:</div>
      <div style="font-size:16px;font-weight:800;color:#1e293b;">${data.customerName}</div>
    </div>

    <!-- Table -->
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#1e293b;color:#f1f5f9;">
          <th style="padding:10px 6px;text-align:center;width:28px;">#</th>
          <th style="padding:10px 8px;text-align:right;">الاسم</th>
          <th style="padding:10px 8px;text-align:right;">الوصف</th>
          <th style="padding:10px 8px;text-align:right;">القسم</th>
          <th style="padding:10px 6px;text-align:center;width:55px;">الكمية</th>
          <th style="padding:10px 6px;text-align:center;width:70px;">السعر</th>
          <th style="padding:10px 6px;text-align:center;width:80px;">الإجمالي</th>
          <th style="padding:10px 6px;text-align:center;width:68px;">الصورة</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        ${subtotalRows}
        <tr style="background:#f1f5f9;border-top:2px solid #cbd5e1;">
          <td colspan="6" style="padding:14px 12px;text-align:right;font-weight:800;font-size:15px;color:#1e293b;">المجموع الكلي</td>
          <td style="padding:14px 8px;text-align:center;font-weight:900;font-size:16px;color:#1e293b;">${fmt(data.grandTotal)}</td>
          <td style="padding:14px 8px;text-align:center;font-size:11px;color:#64748b;">د.أ</td>
        </tr>
      </tfoot>
    </table>

    ${data.notes.trim() ? `
    <div style="margin:16px 0 0;padding:12px 16px;background:#f8fafc;border-right:4px solid #94a3b8;border-radius:6px;font-size:12px;color:#374151;white-space:pre-wrap;line-height:1.7;">${data.notes}</div>
    ` : ""}

    <!-- Closing / Signature -->
    <div style="margin-top:32px;display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #e2e8f0;padding-top:20px;">
      <div style="font-size:13px;color:#64748b;font-weight:600;">${data.closingText}</div>
      <div style="text-align:center;">
        <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:6px;">${data.signerTitle}</div>
        ${stamp ? `<img src="${stamp}" style="width:90px;height:auto;" />` : ""}
      </div>
    </div>
  </div>`;

  await captureAndSave(html, 820, filename);
}
