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

function splitIntoBalancedGroups(items, groupCount) {
  const groups = [];
  const size = Math.ceil(items.length / groupCount);
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

/**
 * The agreement template can contain one very long Annexure A1 clause with
 * many internal A1.1, A1.2 ... sub-sections. The normal agreement renderer
 * correctly treats that as one clause, but doing so makes a single A4 page
 * unreadably dense. For PDF export only, split that one clause into balanced
 * sub-annexure pages while keeping the original database/template unchanged.
 */
function createAnnexureExportPages(pageEl) {
  const content = pageEl.querySelector(".doc-page-content");
  if (!content) return [pageEl];

  const children = Array.from(content.children);
  const annexureIndex = children.findIndex((el) => {
    const text = el.textContent || "";
    return /A1\.\d+\b/.test(text) && text.length > 1800;
  });

  if (annexureIndex === -1) return [pageEl];

  const annexure = children[annexureIndex];
  const paragraph = annexure.querySelector("p");
  if (!paragraph) return [pageEl];

  const body = paragraph.textContent || "";
  const sections = body
    .split(/\n(?=A1\.\d+\b)/)
    .map((part) => part.trim())
    .filter(Boolean);

  const numberedSections = sections.filter((part) => /^A1\.\d+\b/.test(part));
  if (numberedSections.length < 6) return [pageEl];

  // Three balanced sub-annexures gives substantially better readability than
  // trying to squeeze all A1 sections into one sheet. For unusually short A1
  // content, two groups are enough; long A1 content remains three groups.
  const groupCount = numberedSections.length >= 9 ? 3 : 2;
  const groups = splitIntoBalancedGroups(numberedSections, groupCount);
  const prefix = sections.find((part) => !/^A1\.\d+\b/.test(part)) || "";
  if (prefix) groups[0].unshift(prefix);

  const originalTitle = annexure.querySelector("h3")?.textContent?.trim() || "ANNEXURE A1";

  return groups.map((group, partIndex) => {
    const clone = pageEl.cloneNode(true);
    const cloneContent = clone.querySelector(".doc-page-content");
    const cloneChildren = Array.from(cloneContent.children);
    const cloneAnnexure = cloneChildren[annexureIndex];

    cloneChildren.forEach((child, index) => {
      if (index !== annexureIndex && index > annexureIndex && partIndex < groups.length - 1) {
        child.remove();
      } else if (index !== annexureIndex && index < annexureIndex && partIndex > 0) {
        child.remove();
      }
    });

    const heading = cloneAnnexure.querySelector("h3");
    if (heading) {
      heading.textContent = `${originalTitle} — Part ${partIndex + 1} of ${groups.length}`;
    }

    const p = cloneAnnexure.querySelector("p");
    if (p) p.textContent = group.join("\n\n");

    return clone;
  });
}

function setPhysicalPageNumber(pageEl, pageNumber, totalPages) {
  const pageNumberEl = pageEl.querySelector(".doc-page-number");
  if (pageNumberEl) pageNumberEl.textContent = `Page : ${pageNumber} of ${totalPages}`;
}

/**
 * Export the agreement as true A4 pages without shrinking dense content.
 * Long Annexure A1 clauses are split at their own A1.1/A1.2/... boundaries
 * into readable sub-annexures before rendering. Existing headers, footers,
 * signatures and agreement data are preserved; this is presentation-only.
 */
export async function downloadAgreementPdf(containerEl, filename = "Agreement.pdf") {
  if (!containerEl) throw new Error("Nothing to export");
  const sourcePages = Array.from(containerEl.querySelectorAll(".doc-page"));
  if (!sourcePages.length) throw new Error("No pages found to export");

  const exportPages = sourcePages.flatMap(createAnnexureExportPages);
  const totalPages = exportPages.length;
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  exportPages.forEach((pageEl, index) => setPhysicalPageNumber(pageEl, index + 1, totalPages));

  // Render detached export clones only when a page was split. Normal pages are
  // rendered directly. Clones are appended invisibly so browser layout/fonts
  // are identical to the live agreement document.
  const originalParent = containerEl.parentElement;
  const staging = document.createElement("div");
  staging.style.position = "fixed";
  staging.style.left = "-100000px";
  staging.style.top = "0";
  staging.style.width = `${sourcePages[0].getBoundingClientRect().width || 794}px`;
  staging.style.background = "#fff";
  staging.style.zIndex = "-1";
  document.body.appendChild(staging);

  try {
    for (let pageIndex = 0; pageIndex < exportPages.length; pageIndex += 1) {
      const pageEl = exportPages[pageIndex];
      const sourceIsLivePage = sourcePages.includes(pageEl);
      if (!sourceIsLivePage) staging.appendChild(pageEl);

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

      // Safety fallback: if an unexpectedly large page still remains, split
      // its content area into A4-height slices rather than shrinking it.
      const headerEl = pageEl.querySelector(".doc-header-wrap");
      const footerEl = pageEl.querySelector(".doc-footer-wrap");

      if (!headerEl || !footerEl) {
        const slices = Math.ceil(canvas.height / targetHeightPx);
        for (let i = 0; i < slices; i += 1) {
          if (pdf.getNumberOfPages() > 0) pdf.addPage();
          const sy = i * targetHeightPx;
          const sh = Math.min(targetHeightPx, canvas.height - sy);
          drawCanvasSlice(pdf, canvas, 0, sy, canvas.width, sh, 0, 0, A4_WIDTH_MM, (sh / canvas.width) * A4_WIDTH_MM);
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
        drawCanvasSlice(pdf, canvas, 0, 0, canvas.width, headerHeight, 0, 0, A4_WIDTH_MM, headerMmHeight);

        const sy = contentStart + sliceIndex * availableContentHeight;
        const sh = Math.min(availableContentHeight, contentEnd - sy);
        const contentMmHeight = (sh / canvas.width) * A4_WIDTH_MM;
        drawCanvasSlice(pdf, canvas, 0, sy, canvas.width, sh, 0, headerMmHeight, A4_WIDTH_MM, contentMmHeight);

        const footerMmHeight = (footerHeight / canvas.width) * A4_WIDTH_MM;
        const footerY = A4_HEIGHT_MM - footerMmHeight;
        drawCanvasSlice(pdf, canvas, 0, canvas.height - footerHeight, canvas.width, footerHeight, 0, footerY, A4_WIDTH_MM, footerMmHeight);
      }
    }
  } finally {
    if (originalParent && staging.parentElement === document.body) staging.remove();
  }

  pdf.save(filename);
}
