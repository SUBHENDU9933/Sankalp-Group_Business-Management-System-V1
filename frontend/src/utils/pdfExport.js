import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_RATIO = A4_HEIGHT_MM / A4_WIDTH_MM;

function drawCanvasSlice(pdf, source, sx, sy, sw, sh, dx, dy, dw, dh) {
  const slice = document.createElement("canvas");
  slice.width = Math.max(1, Math.round(sw));
  slice.height = Math.max(1, Math.round(sh));
  const ctx = slice.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, slice.width, slice.height);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, slice.width, slice.height);
  const imgData = slice.toDataURL("image/jpeg", 0.96);
  pdf.addImage(imgData, "JPEG", dx, dy, dw, dh, undefined, "FAST");
}

function exportNormalPage(pdf, canvas) {
  const imgData = canvas.toDataURL("image/jpeg", 0.96);
  pdf.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, "FAST");
}

/**
 * Export the agreement as true A4 pages without shrinking an oversized DOM page.
 * Existing AgreementDocument pages already contain the Sankalp header/footer.
 * If a newly added clause makes one DOM page taller than A4, only its content
 * area is split across additional A4 sheets while the rendered header/footer
 * bands are repeated. This prevents the tiny-text failure caused by scaling an
 * oversized page into a single A4 image.
 */
export async function downloadAgreementPdf(containerEl, filename = "Agreement.pdf") {
  if (!containerEl) throw new Error("Nothing to export");
  const pageEls = Array.from(containerEl.querySelectorAll(".doc-page"));
  if (!pageEls.length) throw new Error("No pages found to export");

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  for (let pageIndex = 0; pageIndex < pageEls.length; pageIndex += 1) {
    const pageEl = pageEls[pageIndex];
    const rect = pageEl.getBoundingClientRect();
    if (!rect.width) throw new Error("Agreement page has no printable width");

    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: Math.max(document.documentElement.clientWidth, Math.ceil(rect.width)),
    });

    const targetHeightPx = canvas.width * A4_RATIO;
    const tolerance = targetHeightPx * 0.015;

    if (canvas.height <= targetHeightPx + tolerance) {
      if (pdf.getNumberOfPages() > 0) pdf.addPage();
      exportNormalPage(pdf, canvas);
      continue;
    }

    const headerEl = pageEl.querySelector(".doc-header-wrap");
    const footerEl = pageEl.querySelector(".doc-footer-wrap");

    if (!headerEl || !footerEl) {
      const slices = Math.ceil(canvas.height / targetHeightPx);
      for (let i = 0; i < slices; i += 1) {
        if (pdf.getNumberOfPages() > 0) pdf.addPage();
        const sy = i * targetHeightPx;
        const sh = Math.min(targetHeightPx, canvas.height - sy);
        drawCanvasSlice(
          pdf,
          canvas,
          0,
          sy,
          canvas.width,
          sh,
          0,
          0,
          A4_WIDTH_MM,
          (sh / canvas.width) * A4_WIDTH_MM,
        );
      }
      continue;
    }

    const pageRect = pageEl.getBoundingClientRect();
    const headerRect = headerEl.getBoundingClientRect();
    const footerRect = footerEl.getBoundingClientRect();
    const scaleX = canvas.width / pageRect.width;
    const headerHeight = Math.max(1, headerRect.height * scaleX);
    const footerHeight = Math.max(1, footerRect.height * scaleX);
    const contentStart = Math.max(0, (headerRect.bottom - pageRect.top) * scaleX);
    const contentEnd = Math.min(canvas.height, (footerRect.top - pageRect.top) * scaleX);
    const contentHeight = Math.max(0, contentEnd - contentStart);
    const availableContentHeight = Math.max(1, targetHeightPx - headerHeight - footerHeight);
    const contentSlices = Math.max(1, Math.ceil(contentHeight / availableContentHeight));

    for (let sliceIndex = 0; sliceIndex < contentSlices; sliceIndex += 1) {
      if (pdf.getNumberOfPages() > 0) pdf.addPage();

      const headerMmHeight = (headerHeight / canvas.width) * A4_WIDTH_MM;
      drawCanvasSlice(
        pdf,
        canvas,
        0,
        0,
        canvas.width,
        headerHeight,
        0,
        0,
        A4_WIDTH_MM,
        headerMmHeight,
      );

      const sy = contentStart + sliceIndex * availableContentHeight;
      const sh = Math.min(availableContentHeight, contentEnd - sy);
      const contentMmHeight = (sh / canvas.width) * A4_WIDTH_MM;
      drawCanvasSlice(
        pdf,
        canvas,
        0,
        sy,
        canvas.width,
        sh,
        0,
        headerMmHeight,
        A4_WIDTH_MM,
        contentMmHeight,
      );

      const footerMmHeight = (footerHeight / canvas.width) * A4_WIDTH_MM;
      const footerY = A4_HEIGHT_MM - footerMmHeight;
      drawCanvasSlice(
        pdf,
        canvas,
        0,
        canvas.height - footerHeight,
        canvas.width,
        footerHeight,
        0,
        footerY,
        A4_WIDTH_MM,
        footerMmHeight,
      );

      if (contentSlices > 1) {
        const physicalPageNumber = pdf.getNumberOfPages();
        pdf.setFillColor(255, 255, 255);
        pdf.rect(
          A4_WIDTH_MM * 0.70,
          footerY,
          A4_WIDTH_MM * 0.29,
          Math.max(8, footerMmHeight * 0.42),
          "F",
        );
        pdf.setTextColor(30, 63, 173);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(`Page : ${physicalPageNumber}`, A4_WIDTH_MM - 5, footerY + 6, { align: "right" });
      }
    }
  }

  pdf.save(filename);
}
