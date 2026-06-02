// Browser-only label PDF generation using bwip-js + jsPDF.
// All imports are dynamic to avoid SSR issues.

export type LabelType = "qr" | "barcode" | "both";
export type LabelSize = "small" | "medium" | "large";

export interface LabelObject {
  id: string;
  title: string;
  accession_number: string | null;
  object_name: string | null;
}

export interface LabelOptions {
  type: LabelType;
  size: LabelSize;
  copies: number;
  institutionName?: string;
}

// Label dimensions in mm
const SIZES: Record<LabelSize, { w: number; h: number }> = {
  small:  { w: 40, h: 20 },
  medium: { w: 70, h: 37 },
  large:  { w: 99, h: 57 },
};

const PAGE = { w: 210, h: 297 }; // A4 mm
const MARGIN = 5;
const GAP = 2;

function gridFor(size: LabelSize): { cols: number; rows: number } {
  const { w, h } = SIZES[size];
  const cols = Math.floor((PAGE.w - MARGIN * 2) / (w + GAP));
  const rows = Math.floor((PAGE.h - MARGIN * 2) / (h + GAP));
  return { cols, rows };
}

/** Draw a single label onto the jsPDF doc at position (x, y) in mm. */
async function drawLabel(
  doc: import("jspdf").jsPDF,
  bwipjs: typeof import("bwip-js/browser"),
  obj: LabelObject,
  x: number,
  y: number,
  size: LabelSize,
  type: LabelType,
  institutionName: string,
): Promise<void> {
  const { w, h } = SIZES[size];
  const codeText = obj.accession_number ?? obj.id.slice(0, 13).toUpperCase();
  const hasAccession = !!obj.accession_number;

  // Border
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);

  // Render barcode/QR to an offscreen canvas then embed as image
  const canvas = document.createElement("canvas");

  async function renderCode(bcid: string, text: string, opts: Record<string, unknown> = {}): Promise<string> {
    try {
      bwipjs.toCanvas(canvas, { bcid, text, scale: 3, ...opts });
      return canvas.toDataURL("image/png");
    } catch {
      return "";
    }
  }

  const pad = 1.5; // mm padding inside label

  if (size === "small") {
    // Small: barcode only + accession number text below
    const barImg = await renderCode("code128", codeText, { height: 8, includetext: false });
    if (barImg) {
      const barW = w - pad * 2;
      const barH = h - 7;
      doc.addImage(barImg, "PNG", x + pad, y + pad, barW, barH);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(hasAccession ? 30 : 140, 30, hasAccession ? 30 : 140);
    doc.text(codeText, x + w / 2, y + h - 2, { align: "center" });
  } else if (size === "medium") {
    // Medium: QR or barcode left + text right, or stacked
    if (type === "qr" || type === "both") {
      const qrImg = await renderCode("qrcode", codeText, { scale: 4 });
      if (qrImg) {
        const qrSize = h - pad * 2;
        doc.addImage(qrImg, "PNG", x + pad, y + pad, qrSize, qrSize);
      }
    }

    const textX = type === "barcode" ? x + pad : x + (h - pad) + 2;
    const textW = type === "barcode" ? w - pad * 2 : w - (h - pad) - 3;

    if (type === "barcode" || type === "both") {
      const barImg = await renderCode("code128", codeText, { height: 6, includetext: false });
      if (barImg) {
        const bx = type === "both" ? x + (h - pad) + 1 : x + pad;
        const bw = type === "both" ? textW : w - pad * 2;
        doc.addImage(barImg, "PNG", bx, y + h - 10, bw, 7);
      }
    }

    // Accession number
    doc.setFont("courier", "bold");
    doc.setFontSize(type === "both" ? 6 : 7);
    doc.setTextColor(hasAccession ? 10 : 100, 100, hasAccession ? 10 : 100);
    doc.text(codeText, textX, y + pad + 4, { maxWidth: textW });

    // Title (truncated)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(60, 60, 60);
    const titleLines = doc.splitTextToSize(obj.title, textW);
    doc.text(titleLines.slice(0, 2), textX, y + pad + 10);
  } else {
    // Large: full label — QR top-right, barcode across bottom, text left
    const qrSize = 25;
    if (type !== "barcode") {
      const qrImg = await renderCode("qrcode", codeText, { scale: 5 });
      if (qrImg) {
        doc.addImage(qrImg, "PNG", x + w - qrSize - pad, y + pad, qrSize, qrSize);
      }
    }

    // Accession number
    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    doc.setTextColor(hasAccession ? 10 : 100, 100, hasAccession ? 10 : 100);
    doc.text(codeText, x + pad, y + pad + 6);

    // Object name
    if (obj.object_name) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(15, 118, 110); // teal-700
      doc.text(obj.object_name, x + pad, y + pad + 12);
    }

    // Title
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    const titleLines = doc.splitTextToSize(obj.title, w - qrSize - pad * 3 - 2);
    doc.text(titleLines.slice(0, 3), x + pad, y + pad + 18);

    // Barcode across bottom
    if (type !== "qr") {
      const barImg = await renderCode("code128", codeText, { height: 8, includetext: false });
      if (barImg) {
        doc.addImage(barImg, "PNG", x + pad, y + h - 12, w - pad * 2, 9);
      }
    }

    // Institution name footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.setTextColor(150, 150, 150);
    doc.text(institutionName, x + pad, y + h - 1.5);
  }
}

export async function generateLabelPDF(
  objects: LabelObject[],
  options: LabelOptions,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const bwipjs = await import("bwip-js/browser");

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const { w, h } = SIZES[options.size];
  const { cols, rows } = gridFor(options.size);
  const institutionName = options.institutionName ?? "Cartlann Collection";

  // Expand objects by copies
  const expanded: LabelObject[] = [];
  for (const obj of objects) {
    for (let i = 0; i < options.copies; i++) expanded.push(obj);
  }

  let labelIndex = 0;
  let page = 0;

  for (const obj of expanded) {
    const posOnPage = labelIndex % (cols * rows);
    if (posOnPage === 0 && labelIndex > 0) {
      doc.addPage();
      page++;
    }
    const col = posOnPage % cols;
    const row = Math.floor(posOnPage / cols);
    const x = MARGIN + col * (w + GAP);
    const y = MARGIN + row * (h + GAP);
    await drawLabel(doc, bwipjs, obj, x, y, options.size, options.type, institutionName);
    labelIndex++;
  }

  // Footer on each page with page number
  const totalPages = page + 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.setTextColor(180, 180, 180);
    doc.text(`Generated by Cartlann · Page ${p} of ${totalPages}`, PAGE.w / 2, PAGE.h - 2, { align: "center" });
  }

  return doc.output("blob");
}

/** Generate a single preview label as a data URL (PNG) — used for the modal preview. */
export async function generatePreviewDataUrl(
  obj: LabelObject,
  options: Pick<LabelOptions, "type" | "size">,
): Promise<string> {
  const { jsPDF } = await import("jspdf");
  const bwipjs = await import("bwip-js/browser");
  const { w, h } = SIZES[options.size];
  // Render at 4× scale for a crisp preview
  const scale = 4;
  const doc = new jsPDF({ unit: "mm", format: [w + 4, h + 4], orientation: "portrait" });
  await drawLabel(doc, bwipjs, obj, 2, 2, options.size, options.type, "Cartlann Collection");
  return doc.output("datauristring");
}

export function labelsPerPage(size: LabelSize): number {
  const { cols, rows } = gridFor(size);
  return cols * rows;
}
