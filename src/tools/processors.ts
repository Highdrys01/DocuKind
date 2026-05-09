import {
  degrees,
  PDFDocument,
  StandardFonts,
  type PDFImage,
  type PDFFont,
  type PDFPage
} from "pdf-lib";
import type { ToolOptions, ToolProcessor, ToolResult } from "../types";
import { fileToUint8Array, formatBytes, makeOutputName, resultFromBlob, resultFromBytes } from "../utils/file";
import { allPageIndexes, formatPageLabel, parsePageSelection, parseRangeGroups } from "../utils/pageRanges";
import { booleanOption, copySelectedPages, hexToRgb, loadPdf, numberOption, pageIndexesFor, stringOption } from "../utils/pdf";

const PAGE_SIZES: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  square: [720, 720]
};

export const mergePdf: ToolProcessor = async (files) => {
  if (files.length < 2) throw new Error("Add at least two PDFs to merge.");

  const output = await PDFDocument.create();
  for (const file of files) {
    const source = await loadPdf(file);
    const pages = await output.copyPages(source, pageIndexesFor(source));
    for (const page of pages) output.addPage(page);
  }

  return [resultFromBytes("docukind-merged.pdf", await output.save({ useObjectStreams: true }))];
};

export const splitPdf: ToolProcessor = async ([file], options) => {
  requireFile(file);

  const source = await loadPdf(file);
  const totalPages = source.getPageCount();
  const mode = stringOption(options.splitMode, "every");
  const groups = mode === "ranges"
    ? parseRangeGroups(stringOption(options.ranges), totalPages)
    : allPageIndexes(totalPages).map((index) => [index]);

  const results: ToolResult[] = [];
  for (const [groupIndex, group] of groups.entries()) {
    const output = await copySelectedPages(source, group);
    const label = mode === "ranges" ? `pages-${formatPageLabel(group)}` : `page-${group[0] + 1}`;
    const fallback = `part-${groupIndex + 1}`;
    results.push(resultFromBytes(makeOutputName(file.name, label || fallback), await output.save({ useObjectStreams: true })));
  }

  return results;
};

export const organizePdf: ToolProcessor = async ([file], options) => {
  requireFile(file);

  const source = await loadPdf(file);
  const totalPages = source.getPageCount();
  const reverse = booleanOption(options.reverseOrder);
  const rawOrder = stringOption(options.pageOrder);
  const order = reverse
    ? allPageIndexes(totalPages).reverse()
    : parsePageSelection(rawOrder || "all", totalPages);
  const output = await copySelectedPages(source, order);

  return [resultFromBytes(makeOutputName(file.name, "organized"), await output.save({ useObjectStreams: true }))];
};

export const rotatePdf: ToolProcessor = async ([file], options) => {
  requireFile(file);

  const doc = await loadPdf(file);
  const angle = normalizeAngle(numberOption(options.angle, 90));
  const pages = parsePageSelection(stringOption(options.pages), doc.getPageCount());

  for (const index of pages) {
    const page = doc.getPage(index);
    page.setRotation(degrees(normalizeAngle(page.getRotation().angle + angle)));
  }

  return [resultFromBytes(makeOutputName(file.name, `rotated-${angle}`), await doc.save({ useObjectStreams: true }))];
};

export const deletePagesPdf: ToolProcessor = async ([file], options) => {
  requireFile(file);

  const source = await loadPdf(file);
  const deleteSet = new Set(parsePageSelection(stringOption(options.pages), source.getPageCount()));
  const keep = pageIndexesFor(source).filter((index) => !deleteSet.has(index));
  if (keep.length === 0) throw new Error("Deleting every page would create an empty PDF.");

  const output = await copySelectedPages(source, keep);
  return [resultFromBytes(makeOutputName(file.name, "pages-removed"), await output.save({ useObjectStreams: true }))];
};

export const extractPagesPdf: ToolProcessor = async ([file], options) => {
  requireFile(file);

  const source = await loadPdf(file);
  const selected = parsePageSelection(stringOption(options.pages), source.getPageCount());
  const output = await copySelectedPages(source, selected);

  return [resultFromBytes(makeOutputName(file.name, `pages-${formatPageLabel(selected)}`), await output.save({ useObjectStreams: true }))];
};

export const imagesToPdf: ToolProcessor = async (files, options) => {
  if (files.length === 0) throw new Error("Add one or more images.");

  const pdf = await PDFDocument.create();
  const margin = numberOption(options.margin, 24);
  const pageSize = stringOption(options.pageSize, "auto");
  const fit = stringOption(options.fit, "contain");

  for (const file of files) {
    const image = await embedImage(pdf, file);
    const imageWidth = image.width;
    const imageHeight = image.height;
    const [pageWidth, pageHeight] = pageSize === "auto"
      ? [imageWidth + margin * 2, imageHeight + margin * 2]
      : PAGE_SIZES[pageSize] ?? PAGE_SIZES.a4;

    const page = pdf.addPage([pageWidth, pageHeight]);
    const boxWidth = Math.max(1, pageWidth - margin * 2);
    const boxHeight = Math.max(1, pageHeight - margin * 2);
    const fitted = fitImage(imageWidth, imageHeight, boxWidth, boxHeight, fit);

    page.drawImage(image, {
      x: margin + (boxWidth - fitted.width) / 2,
      y: margin + (boxHeight - fitted.height) / 2,
      width: fitted.width,
      height: fitted.height
    });
  }

  return [resultFromBytes("docukind-images.pdf", await pdf.save({ useObjectStreams: true }))];
};

export const pdfToImages: ToolProcessor = async ([file], options) => {
  requireFile(file);

  const source = await loadPdf(file);
  const selected = parsePageSelection(stringOption(options.pages), source.getPageCount());
  const format = stringOption(options.format, "png") === "jpeg" ? "jpeg" : "png";
  const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
  const scale = numberOption(options.scale, 1.5);
  const quality = numberOption(options.quality, 0.86);
  const results: ToolResult[] = [];
  const { renderPdfPageToBlob } = await import("../utils/renderPdf");

  for (const index of selected) {
    const blob = await renderPdfPageToBlob(file, index + 1, scale, mimeType, quality);
    results.push(resultFromBlob(makeOutputName(file.name, `page-${index + 1}`, format === "jpeg" ? "jpg" : "png"), blob));
  }

  return results;
};

export const watermarkPdf: ToolProcessor = async ([file], options) => {
  requireFile(file);

  const text = stringOption(options.text, "").trim();
  if (!text) throw new Error("Enter watermark text.");

  const doc = await loadPdf(file);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = parsePageSelection(stringOption(options.pages), doc.getPageCount());
  const size = numberOption(options.size, 42);
  const opacity = clamp(numberOption(options.opacity, 0.18), 0.03, 1);
  const angle = numberOption(options.angle, -32);
  const color = hexToRgb(stringOption(options.color, "#f05d5e"));
  const position = stringOption(options.position, "center");

  for (const index of pages) {
    drawPlacedText(doc.getPage(index), text, font, size, position, {
      color,
      angle,
      opacity
    });
  }

  return [resultFromBytes(makeOutputName(file.name, "watermarked"), await doc.save({ useObjectStreams: true }))];
};

export const pageNumbersPdf: ToolProcessor = async ([file], options) => {
  requireFile(file);

  const doc = await loadPdf(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const selected = parsePageSelection(stringOption(options.pages), doc.getPageCount());
  const startAt = Math.max(1, Math.round(numberOption(options.startAt, 1)));
  const size = numberOption(options.size, 11);
  const color = hexToRgb(stringOption(options.color, "#1f2a24"));
  const prefix = stringOption(options.prefix);
  const suffix = stringOption(options.suffix);
  const position = stringOption(options.position, "bottom-center");

  for (const [offset, index] of selected.entries()) {
    const text = `${prefix}${startAt + offset}${suffix}`;
    drawPlacedText(doc.getPage(index), text, font, size, position, { color, opacity: 1, angle: 0 });
  }

  return [resultFromBytes(makeOutputName(file.name, "numbered"), await doc.save({ useObjectStreams: true }))];
};

export const signPdf: ToolProcessor = async ([file], options) => {
  requireFile(file);

  const signature = stringOption(options.signatureText).trim();
  if (!signature) throw new Error("Enter a signature.");

  const doc = await loadPdf(file);
  const font = await doc.embedFont(StandardFonts.HelveticaOblique);
  const selected = parsePageSelection(stringOption(options.pages), doc.getPageCount());
  const size = numberOption(options.size, 28);
  const color = hexToRgb(stringOption(options.color, "#1f2a24"));
  const position = stringOption(options.position, "bottom-right");
  const includeDate = booleanOption(options.includeDate);
  const text = includeDate ? `${signature}  ${new Date().toLocaleDateString()}` : signature;

  for (const index of selected) {
    drawPlacedText(doc.getPage(index), text, font, size, position, { color, opacity: 1, angle: 0 });
  }

  return [resultFromBytes(makeOutputName(file.name, "signed"), await doc.save({ useObjectStreams: true }))];
};

export const metadataPdf: ToolProcessor = async ([file], options) => {
  requireFile(file);

  const doc = await loadPdf(file);
  const mode = stringOption(options.mode, "clear");

  if (mode === "clear") {
    doc.setTitle("");
    doc.setAuthor("");
    doc.setSubject("");
    doc.setKeywords([]);
    doc.setProducer("DocuKind");
    doc.setCreator("DocuKind");
    doc.setCreationDate(new Date(0));
    doc.setModificationDate(new Date(0));
  } else {
    doc.setTitle(stringOption(options.title));
    doc.setAuthor(stringOption(options.author));
    doc.setSubject(stringOption(options.subject));
    doc.setKeywords(splitKeywords(stringOption(options.keywords)));
    doc.setProducer("DocuKind");
    doc.setCreator("DocuKind");
    doc.setModificationDate(new Date());
  }

  return [resultFromBytes(makeOutputName(file.name, mode === "clear" ? "metadata-cleared" : "metadata-updated"), await doc.save({ useObjectStreams: true }))];
};

export const compressPdf: ToolProcessor = async ([file], options) => {
  requireFile(file);

  const mode = stringOption(options.mode, "lossless");
  if (mode === "raster") {
    return [await rasterCompress(file, options)];
  }

  const doc = await loadPdf(file);
  if (booleanOption(options.removeMetadata, true)) {
    doc.setTitle("");
    doc.setAuthor("");
    doc.setSubject("");
    doc.setKeywords([]);
    doc.setProducer("DocuKind");
    doc.setCreator("DocuKind");
  }

  const bytes = await doc.save({ useObjectStreams: true });
  return [resultFromBytes(makeOutputName(file.name, "compressed"), bytes, compressionSummary(file.size, bytes.length, "Lossless rebuild"))];
};

async function rasterCompress(file: File, options: ToolOptions): Promise<ToolResult> {
  const source = await loadPdf(file);
  const output = await PDFDocument.create();
  const scale = numberOption(options.rasterScale, 1.1);
  const quality = clamp(numberOption(options.jpegQuality, 0.68), 0.2, 0.95);
  const { renderPdfPageToBlob } = await import("../utils/renderPdf");

  for (let index = 0; index < source.getPageCount(); index += 1) {
    const blob = await renderPdfPageToBlob(file, index + 1, scale, "image/jpeg", quality);
    const image = await output.embedJpg(await fileToUint8Array(blob));
    const page = output.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }

  const bytes = await output.save({ useObjectStreams: true });
  return resultFromBytes(
    makeOutputName(file.name, "raster-compressed"),
    bytes,
    `${compressionSummary(file.size, bytes.length, "Raster rebuild")} Selectable text is not preserved.`
  );
}

function drawPlacedText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  position: string,
  options: {
    color: ReturnType<typeof hexToRgb>;
    opacity: number;
    angle: number;
  }
): void {
  const { width, height } = page.getSize();
  const textWidth = font.widthOfTextAtSize(text, size);
  const margin = Math.max(18, size * 1.3);
  const xByPosition: Record<string, number> = {
    "top-left": margin,
    "top-center": (width - textWidth) / 2,
    "top-right": width - textWidth - margin,
    center: (width - textWidth) / 2,
    "bottom-left": margin,
    "bottom-center": (width - textWidth) / 2,
    "bottom-right": width - textWidth - margin
  };
  const yByPosition: Record<string, number> = {
    "top-left": height - margin,
    "top-center": height - margin,
    "top-right": height - margin,
    center: height / 2,
    "bottom-left": margin,
    "bottom-center": margin,
    "bottom-right": margin
  };

  page.drawText(text, {
    x: xByPosition[position] ?? xByPosition.center,
    y: yByPosition[position] ?? yByPosition.center,
    size,
    font,
    color: options.color,
    rotate: degrees(options.angle),
    opacity: options.opacity
  });
}

async function embedImage(pdf: PDFDocument, file: File): Promise<PDFImage> {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const bytes = await fileToUint8Array(file);

  if (type === "image/jpeg" || type === "image/jpg" || /\.jpe?g$/.test(name)) {
    return pdf.embedJpg(bytes);
  }

  if (type === "image/png" || /\.png$/.test(name)) {
    return pdf.embedPng(bytes);
  }

  return pdf.embedPng(await convertImageToPngBytes(file));
}

async function convertImageToPngBytes(file: File): Promise<Uint8Array> {
  const bitmap = await imageBitmapFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is not available in this browser.");

  context.drawImage(bitmap, 0, 0);
  if ("close" in bitmap) bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not convert image to PNG.")), "image/png");
  });
  return fileToUint8Array(blob);
}

async function imageBitmapFromFile(file: File): Promise<ImageBitmap> {
  if ("createImageBitmap" in window) {
    return window.createImageBitmap(file);
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const element = new Image();
    element.onload = () => {
      URL.revokeObjectURL(url);
      resolve(element);
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image."));
    };
    element.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is not available in this browser.");
  context.drawImage(image, 0, 0);
  return createImageBitmap(canvas);
}

function fitImage(
  imageWidth: number,
  imageHeight: number,
  boxWidth: number,
  boxHeight: number,
  fit: string
): { width: number; height: number } {
  if (fit === "stretch") return { width: boxWidth, height: boxHeight };

  const scale = fit === "cover"
    ? Math.max(boxWidth / imageWidth, boxHeight / imageHeight)
    : Math.min(boxWidth / imageWidth, boxHeight / imageHeight);

  return {
    width: imageWidth * scale,
    height: imageHeight * scale
  };
}

function requireFile(file: File | undefined): asserts file is File {
  if (!file) throw new Error("Add a file first.");
}

function normalizeAngle(value: number): number {
  return ((Math.round(value / 90) * 90) % 360 + 360) % 360;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function splitKeywords(value: string): string[] {
  return value.split(",").map((keyword) => keyword.trim()).filter(Boolean);
}

function compressionSummary(inputBytes: number, outputBytes: number, label: string): string {
  const delta = inputBytes - outputBytes;
  if (delta > 0) {
    const percent = Math.round((delta / inputBytes) * 100);
    return `${label}: ${formatBytes(delta)} smaller (${percent}% reduction).`;
  }

  return `${label}: output is ${formatBytes(outputBytes)}. Some PDFs are already optimized.`;
}
