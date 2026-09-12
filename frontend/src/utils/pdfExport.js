import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Renders every ".doc-page" element inside `containerEl` to a high-res canvas
// and stitches them into a single downloadable multi-page A4 PDF. This
// replaces relying on the browser's own "Print > Save as PDF" dialog — the
// person gets a real .pdf file with one click, no print dialog involved.
export async function downloadAgreementPdf(containerEl, filename = "Agreement.pdf") {
  if (!containerEl) throw new Error("Nothing to export");
  const pageEls = containerEl.querySelectorAll(".doc-page");
  if (!pageEls.length) throw new Error("No pages found to export");

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidthMm = 210;
  const pageHeightMm = 297;

  for (let i = 0; i < pageEls.length; i++) {
    const canvas = await html2canvas(pageEls[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, 0, pageWidthMm, pageHeightMm, undefined, "FAST");
  }

  pdf.save(filename);
}
