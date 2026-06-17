import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const FONT_URL = "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap";
let cachedFontCSS: string | null = null;

async function getCairoFontCSS(): Promise<string> {
  if (cachedFontCSS) return cachedFontCSS;
  try {
    const res = await fetch(FONT_URL);
    const css = await res.text();
    const fontFaceMatches = css.match(/@font-face\s*\{[^}]+\}/g) || [];
    const b64Promises = fontFaceMatches.map(async (face) => {
      const urlMatch = face.match(/url\(([^)]+)\)/);
      if (!urlMatch) return face;
      const fontUrl = urlMatch[1].replace(/['"]/g, "");
      try {
        const fontRes = await fetch(fontUrl);
        const buffer = await fontRes.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        return face.replace(urlMatch[0], `url('data:font/woff2;base64,${b64}')`);
      } catch {
        return face;
      }
    });
    const resolved = await Promise.all(b64Promises);
    cachedFontCSS = resolved.join("\n");
    return cachedFontCSS;
  } catch {
    return "";
  }
}

export const exportToPDF = async (
  elementId: string,
  filename: string,
  _items?: any[],
  details?: any,
  logoSrc?: string
) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    await getCairoFontCSS();

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const marginX = 2;
    const marginY = 2;
    const imgWidth = pdfWidth - marginX * 2;

    const fontCss = await getCairoFontCSS();

    const mainCanvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      allowTaint: true,
      imageTimeout: 15000,
      windowWidth: Math.round(210 * 96 / 25.4),
      onclone: async (doc: Document) => {
        doc.documentElement.setAttribute("dir", "rtl");
        doc.documentElement.style.direction = "rtl";
        const style = doc.createElement("style");
        style.textContent = fontCss + '\n* { font-family: "Cairo", Arial, sans-serif !important; }';
        doc.head.appendChild(style);
        try { await doc.fonts.ready; } catch {}
      },
    });

    const canvasPixelsPerMM = mainCanvas.width / imgWidth;
    const fullPageHeightPx = (pdfHeight - marginY * 2) * canvasPixelsPerMM;

    let sourceY = 0;
    let pageIndex = 0;

    while (sourceY < mainCanvas.height) {
      if (pageIndex > 0) pdf.addPage("a4");

      const remainingPx = mainCanvas.height - sourceY;
      if (remainingPx <= 0) break;

      const sliceHeightPx = Math.min(remainingPx, fullPageHeightPx);
      if (sliceHeightPx <= 0) break;

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = mainCanvas.width;
      pageCanvas.height = Math.round(sliceHeightPx);
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(
          mainCanvas,
          0, Math.round(sourceY),
          mainCanvas.width, Math.round(sliceHeightPx),
          0, 0,
          mainCanvas.width, Math.round(sliceHeightPx)
        );
      }

      const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.98);
      const pageHeightMM = sliceHeightPx / canvasPixelsPerMM;
      pdf.addImage(pageImgData, "JPEG", marginX, marginY, imgWidth, pageHeightMM);

      sourceY += sliceHeightPx;
      pageIndex++;
    }

    pdf.save(`${filename}.pdf`);
  } catch (error) {
    console.error("Failed to generate PDF:", error);
  }
};
