/**
 * Smart multi-page PDF slicer.
 *
 * Takes a fully-captured html2canvas result and the source element,
 * measures tbody row boundaries (so rows are never split across pages),
 * and produces an A4 multi-page jsPDF document.
 *
 * Supports an optional runHeaderCanvas that is stamped at the top of
 * every continuation page (page 2, 3, …).  When provided, the available
 * content height on continuation pages is reduced by the header height so
 * content is never hidden behind the header.
 *
 * Usage:
 *   const canvas = await html2canvas(el, { scale: 2, ... });
 *   await sliceCanvasToPdf(canvas, el, "output.pdf", el.scrollWidth, runHeaderCanvas);
 */

import jsPDF from "jspdf";

const A4_W_MM = 210;
const A4_H_MM = 297;
const SCALE   = 2; // must match the scale used in html2canvas

/**
 * @param canvas          - html2canvas output (scale=2)
 * @param el              - the DOM element that was captured
 * @param filename        - PDF filename to save
 * @param elWidthPx       - the rendered pixel width of `el` at 1× (i.e. el.scrollWidth)
 * @param runHeaderCanvas - optional canvas (scale=2) to stamp on pages 2+
 */
export async function sliceCanvasToPdf(
  canvas: HTMLCanvasElement,
  el: HTMLElement,
  filename: string,
  elWidthPx?: number,
  runHeaderCanvas?: HTMLCanvasElement,
): Promise<void> {
  const docW      = elWidthPx ?? el.scrollWidth;
  const pxPerMm   = docW / A4_W_MM;           // 1× pixels per mm
  const A4Hpx     = A4_H_MM * pxPerMm;        // A4 height in 1× px
  const A4Hcvs    = A4Hpx * SCALE;            // A4 height in canvas px (scale=2)
  /* Clamp header height — must leave at least 30 % of a page for content */
  const rawHeaderH  = runHeaderCanvas ? runHeaderCanvas.height : 0;
  const headerHcvs  = Math.min(rawHeaderH, Math.floor(A4Hcvs * 0.7));
  const totalH      = canvas.height;

  /* ── Single-page fast path ─────────────────────────────── */
  if (totalH <= A4Hcvs + 4) {
    const imgH_mm = (totalH / SCALE) / pxPerMm;
    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, A4_W_MM, Math.min(imgH_mm, A4_H_MM));
    pdf.save(filename);
    return;
  }

  /* ── Measure table row positions (relative to `el` top) ── */
  const elTop  = el.getBoundingClientRect().top;
  const rows   = Array.from(el.querySelectorAll("tbody tr"));
  const bounds = rows.map(r => {
    const rect = r.getBoundingClientRect();
    return {
      top:    (rect.top    - elTop) * SCALE,
      bottom: (rect.bottom - elTop) * SCALE,
    };
  });

  /* ── Compute page cut-points ──────────────────────────── */
  // Page 1 has full A4 height; pages 2+ lose some height to the running header.
  const cuts: number[] = [];
  let pageStart   = 0;
  let isFirstPage = true;

  while (pageStart < totalH) {
    const contentH = isFirstPage
      ? A4Hcvs
      : A4Hcvs - headerHcvs;
    const pageEnd = pageStart + contentH;
    if (pageEnd >= totalH) break; // last page — no cut needed

    // Last row whose bottom fits entirely before pageEnd
    let cutAt = pageEnd;
    for (let i = bounds.length - 1; i >= 0; i--) {
      if (bounds[i].bottom <= pageEnd && bounds[i].bottom > pageStart) {
        cutAt = bounds[i].bottom;
        break;
      }
    }

    cuts.push(cutAt);
    pageStart   = cutAt;
    isFirstPage = false;
  }

  /* ── Slice canvas and build PDF ─────────────────────────── */
  const slices = [0, ...cuts, totalH];
  const pdf    = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  for (let i = 0; i < slices.length - 1; i++) {
    const y = Math.floor(slices[i]);
    const h = Math.ceil(slices[i + 1] - y);

    if (i > 0) pdf.addPage("a4", "p");

    if (i === 0 || !runHeaderCanvas) {
      /* ── Page 1 (or no running header): plain slice ── */
      const pg = document.createElement("canvas");
      pg.width  = canvas.width;
      pg.height = h;
      const ctx = pg.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, h);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);

      const imgH_mm = (h / SCALE) / pxPerMm;
      pdf.addImage(pg.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, A4_W_MM, imgH_mm);
    } else {
      /* ── Pages 2+: running header + content ── */
      const totalPgH = headerHcvs + h;
      const pg = document.createElement("canvas");
      pg.width  = canvas.width;
      pg.height = totalPgH;
      const ctx = pg.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, totalPgH);

      // Stamp running header at top (scale the header width to match canvas width)
      ctx.drawImage(
        runHeaderCanvas,
        0, 0, runHeaderCanvas.width, headerHcvs,
        0, 0, canvas.width, headerHcvs,
      );

      // Place content slice below the header
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, headerHcvs, canvas.width, h);

      const totalH_mm = Math.min((totalPgH / SCALE) / pxPerMm, A4_H_MM);
      pdf.addImage(pg.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, A4_W_MM, totalH_mm);
    }
  }

  pdf.save(filename);
}
