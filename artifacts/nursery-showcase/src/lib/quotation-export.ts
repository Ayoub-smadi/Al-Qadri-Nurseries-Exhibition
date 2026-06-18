import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export const exportToPDF = async (
  elementId: string,
  filename: string,
  _items?: any[],
  _details?: any,
  _logoSrc?: string
) => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found: " + elementId);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const marginX = 3;
  const marginY = 3;
  const imgWidth = pdfWidth - marginX * 2;

  const mainCanvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: "#ffffff",
    imageTimeout: 10000,
    windowWidth: Math.round(210 * 96 / 25.4),
    onclone: (doc: Document) => {
      doc.documentElement.setAttribute("dir", "rtl");
      doc.documentElement.style.direction = "rtl";

      const noPrintStyle = doc.createElement("style");
      noPrintStyle.textContent = `.no-print { display: none !important; }`;
      doc.head.appendChild(noPrintStyle);

      doc.querySelectorAll<HTMLInputElement>(
        "input[type='text'], input:not([type]), input[type='number'], input[type='date']"
      ).forEach(input => {
        if (input.closest(".no-print")) return;
        const span = doc.createElement("span");
        span.textContent = input.value;
        const cs = window.getComputedStyle(input);
        span.style.cssText = cs.cssText;
        span.style.display = "inline-block";
        span.style.minWidth = "20px";
        input.parentNode?.replaceChild(span, input);
      });

      doc.querySelectorAll<HTMLTextAreaElement>("textarea").forEach(ta => {
        if (ta.closest(".no-print")) return;
        const div = doc.createElement("div");
        div.textContent = ta.value;
        const cs = window.getComputedStyle(ta);
        div.style.cssText = cs.cssText;
        div.style.whiteSpace = "pre-wrap";
        ta.parentNode?.replaceChild(div, ta);
      });

      doc.querySelectorAll<HTMLImageElement>("img").forEach(img => {
        if (img.src.startsWith("data:")) return;
        img.crossOrigin = "anonymous";
      });
    },
  });

  const canvasPixelsPerMM = mainCanvas.width / imgWidth;
  const fullPageHeightPx = (pdfHeight - marginY * 2) * canvasPixelsPerMM;

  let sourceY = 0;
  let pageIndex = 0;

  while (sourceY < mainCanvas.height) {
    if (pageIndex > 0) pdf.addPage("a4");
    const remaining = mainCanvas.height - sourceY;
    if (remaining <= 0) break;
    const sliceH = Math.min(remaining, fullPageHeightPx);
    if (sliceH <= 0) break;

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = mainCanvas.width;
    pageCanvas.height = Math.ceil(sliceH);
    const ctx = pageCanvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(
        mainCanvas,
        0, Math.round(sourceY), mainCanvas.width, Math.ceil(sliceH),
        0, 0, mainCanvas.width, Math.ceil(sliceH)
      );
    }

    const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.92);
    const pageHeightMM = Math.ceil(sliceH) / canvasPixelsPerMM;
    pdf.addImage(pageImgData, "JPEG", marginX, marginY, imgWidth, pageHeightMM);

    sourceY += sliceH;
    pageIndex++;
  }

  pdf.save(`${filename}.pdf`);
};
