import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { SANKALP_LOGO } from "@/lib/brand.jsx";
import { formatDateTime, formatINR, numberToWords } from "@/utils/format";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// Builds the dynamic cover page from the agreement's actual structured data —
// NOT by scraping rendered text. The earlier version regex-parsed the printed
// paragraph text back out of the DOM, which broke whenever the surrounding
// sentence didn't happen to end at a comma/period exactly where a field did
// (e.g. "Estimate No." swallowed the rest of the sentence; "working days"
// matched greedily across two different figures in the same clause). Every
// value below comes straight from `agreement` / `agreement.merge_data`, the
// same source of truth the clause template placeholders themselves use.
function buildAgreementCover({ agreement, md = {} }) {
  const agreementRef = (agreement.id || "").slice(0, 8).toUpperCase() || "—";
  const generated = formatDateTime(agreement.created_at);
  const clientName = md.client_name || "—";
  const mobile = md.client_mobile || "—";
  const address = md.client_address || "—";
  const projectTitle = agreement.title || "Interior Work Agreement";
  const projectLocation = md.project_location || "—";
  const category = md.category || "Standard";
  const estimateNo = md.estimate_no || "—";
  const estimateDate = md.estimate_date || "—";
  const contractValueNum = Number(md.contract_value) || 0;
  const contractValueDisplay = contractValueNum ? contractValueNum.toLocaleString("en-IN") : (md.contract_value || "—");
  const contractValueWords = md.contract_value_words || (contractValueNum ? numberToWords(contractValueNum) : "");
  const timelineDays = md.timeline_days || "60";

  const schedule = (agreement.payment_schedule || []).map((r) => ({ stage: r.stage, percent: `${r.percent}%` }));
  const paymentRows = (schedule.length ? schedule : [
    { stage: "Advance / Booking", percent: "30%" },
    { stage: "On Material Dispatch", percent: "40%" },
    { stage: "On Site Installation Start", percent: "20%" },
    { stage: "On Final Handover", percent: "10%" },
  ]);
  const paymentHtml = paymentRows.map((r, i) => `<div style="flex:1;text-align:center;padding:0 7px;${i ? "border-left:1px solid #cbd5e1" : ""}"><div style="margin:auto;width:38px;height:38px;border-radius:50%;background:#f5a623;color:#0b2b55;font-size:16px;font-weight:800;line-height:38px">${i + 1}</div><div style="font-size:21px;font-weight:800;margin-top:6px">${r.percent}</div><div style="font-size:10px;font-weight:700;line-height:1.3">${r.stage}</div></div>`).join("");

  const cover = document.createElement("div");
  cover.style.cssText = "width:794px;height:1123px;box-sizing:border-box;position:fixed;left:-10000px;top:0;overflow:hidden;background:#fbfaf7;color:#0b2b55;font-family:Arial,Helvetica,sans-serif;padding:42px 42px 36px;opacity:1;pointer-events:none";
  const logoHtml = `<img src="${SANKALP_LOGO}" style="width:115px;height:auto;object-fit:contain" crossorigin="anonymous">`;

  cover.innerHTML = `
    <div style="position:absolute;left:0;right:0;top:0;height:9px;background:#183f9e"></div>
    <div style="position:absolute;left:0;right:0;top:9px;height:4px;background:#f28c18"></div>
    <div style="display:flex;align-items:center;gap:18px;padding-top:7px">${logoHtml}<div><div style="font-family:Georgia,serif;font-size:29px;font-weight:700;color:#153f8f">Sankalp Interior Solution</div><div style="font-family:Georgia,serif;font-size:13px;font-style:italic;color:#475569;margin-top:3px">"Innovation for a Better Tomorrow"</div></div></div>
    <div style="height:1px;background:#dbe2ea;margin:18px 0 20px"></div>
    <div style="font-size:10px;letter-spacing:3px;font-weight:700;color:#718096">PROFESSIONAL&nbsp;&nbsp;|&nbsp;&nbsp;TRUSTED&nbsp;&nbsp;|&nbsp;&nbsp;TRANSPARENT</div>
    <div style="font-size:41px;line-height:1.02;font-weight:800;letter-spacing:-1px;margin-top:12px;color:#123d82">INTERIOR WORK</div>
    <div style="font-size:41px;line-height:1.02;font-weight:800;letter-spacing:-1px;color:#e58b19">AGREEMENT</div>
    <div style="width:92px;height:4px;background:#e58b19;margin:12px 0 13px"></div>
    <div style="display:flex;gap:55px;font-size:12px;color:#334155"><div><b>Agreement Ref.</b><br><span style="font-size:14px;font-weight:800;color:#153f8f">${agreementRef}</span></div><div><b>Agreement Date</b><br><span style="font-size:14px;font-weight:800;color:#153f8f">${generated}</span></div></div>

    <div style="display:flex;gap:16px;margin-top:20px">
      <div style="flex:1">
        <div style="border:1px solid #e8c27b;border-radius:15px;background:#fffdf8;padding:14px 16px;margin-bottom:13px"><div style="font-size:11px;font-weight:800;letter-spacing:1px;color:#123d82;margin-bottom:10px">◉ &nbsp; CLIENT DETAILS</div><div style="font-size:11px;line-height:1.7"><b>Client Name</b> &nbsp; ${clientName}<br><b>Mobile No.</b> &nbsp; ${mobile}<br><b>Address</b> &nbsp; ${address}</div></div>
        <div style="border:1px solid #e8c27b;border-radius:15px;background:#fffdf8;padding:14px 16px"><div style="font-size:11px;font-weight:800;letter-spacing:1px;color:#123d82;margin-bottom:10px">⌂ &nbsp; PROJECT DETAILS</div><div style="font-size:11px;line-height:1.7"><b>Project</b> &nbsp; ${projectTitle}<br><b>Location</b> &nbsp; ${projectLocation}<br><b>Category</b> &nbsp; ${category}<br><b>Estimate No.</b> &nbsp; ${estimateNo}<br><b>Estimate Date</b> &nbsp; ${estimateDate}</div></div>
      </div>
      <div style="width:280px;border-radius:17px;background:#0d3c78;color:white;padding:18px;box-sizing:border-box;position:relative;overflow:hidden"><div style="font-size:11px;font-weight:800;letter-spacing:1px">₹ &nbsp; AGREED ESTIMATED VALUE</div><div style="font-size:32px;font-weight:800;margin-top:13px;white-space:nowrap">₹${contractValueDisplay}</div>${contractValueWords ? `<div style="font-size:9px;opacity:.85;margin-top:4px">(${contractValueWords})</div>` : ""}<div style="height:1px;background:#9fb5d0;margin:13px 0"></div><div style="font-size:10px;opacity:.9">Selected Category</div><div style="font-size:17px;font-weight:800;margin-top:3px">${category}</div><div style="position:absolute;right:-42px;bottom:-42px;width:125px;height:85px;background:#f5a623;transform:rotate(-15deg)"></div></div>
    </div>

    <div style="border:1px solid #cbd5e1;border-radius:15px;background:white;padding:13px 10px;margin-top:13px"><div style="font-size:11px;font-weight:800;letter-spacing:1px;color:#123d82;margin:0 0 11px 4px">▣ &nbsp; PAYMENT SCHEDULE</div><div style="display:flex">${paymentHtml}</div></div>
    <div style="border:1px solid #cbd5e1;border-radius:15px;background:#f8fafc;padding:13px 16px;margin-top:13px;display:flex;align-items:center;gap:16px"><div style="font-size:11px;font-weight:800;letter-spacing:1px;color:#123d82;width:140px">◷ &nbsp; PROJECT TIMELINE</div><div style="border-left:1px solid #e58b19;padding-left:16px;font-size:12px"><span style="font-weight:700">Estimated Execution</span><br><span style="font-size:19px;font-weight:800;color:#123d82">${timelineDays} Working Days</span></div></div>

    <div style="display:flex;gap:20px;margin-top:16px;padding:13px 4px 0;border-top:1px solid #dbe2ea"><div style="flex:1"><div style="font-size:10px;font-weight:800;letter-spacing:1px;color:#123d82">FOR SANKALP INTERIOR SOLUTION</div><div style="font-family:cursive;font-size:22px;margin-top:10px">Subhendu</div><div style="font-size:11px;font-weight:800;margin-top:3px">Subhendu Biswas</div><div style="font-size:9px;color:#64748b">Authorized Signatory · Director</div></div><div style="flex:1;border-left:1px solid #dbe2ea;padding-left:20px;font-size:9px;line-height:1.55;color:#334155"><b>CONTACT</b><br>+91 9748297025<br>info.sankalpgrp@gmail.com<br>www.sankalps.com<br>Office: GB, Oishi Tower-II, Rabindra Pally, Jyangra, P.S - Baguiati, Kolkata, West Bengal - 700059</div><div style="width:110px;text-align:center;font-size:9px;font-weight:800;letter-spacing:1px;color:#123d82;padding-top:13px">CONFIDENTIAL<br>CONTRACT<br>DOCUMENT</div></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:33px;background:#0b3268;color:white;display:flex;align-items:center;justify-content:center;font-size:8px;letter-spacing:3px">S A N K A L P &nbsp; I N T E R I O R &nbsp; S O L U T I O N &nbsp;&nbsp; • &nbsp;&nbsp; CONFIDENTIAL</div>
  `;
  return cover;
}

/** Export a premium dynamic cover (built from real agreement data) followed by the existing agreement pages. */
export async function downloadAgreementPdf(containerEl, filename = "Agreement.pdf", coverData = null) {
  if (!containerEl) throw new Error("Nothing to export");
  const pageEls = containerEl.querySelectorAll(".doc-page");
  if (!pageEls.length) throw new Error("No pages found to export");

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // coverData (the real agreement + merge_data) is now required for an accurate
  // cover page. If a caller doesn't pass it, skip the cover rather than render
  // one built from guessed/scraped text.
  if (coverData?.agreement) {
    const cover = buildAgreementCover(coverData);
    document.body.appendChild(cover);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const coverCanvas = await html2canvas(cover, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fbfaf7",
        logging: false,
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
        scrollX: 0,
        scrollY: 0,
      });
      pdf.addImage(coverCanvas.toDataURL("image/jpeg", 0.96), "JPEG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, "FAST");
    } finally {
      cover.remove();
    }
  }

  for (let i = 0; i < pageEls.length; i++) {
    const canvas = await html2canvas(pageEls[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    if (coverData?.agreement || i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM, undefined, "FAST");
  }

  pdf.save(filename);
}
