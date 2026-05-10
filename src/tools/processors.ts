import {
  degrees,
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFImage,
  type PDFFont,
  type PDFPage
} from "pdf-lib";
import type { ToolOptions, ToolProcessor, ToolResult, ToolRunContext } from "../types";
import { fileToUint8Array, formatBytes, makeOutputName, normalizeFilename, resultFromBlob, resultFromBytes } from "../utils/file";
import { allPageIndexes, formatPageLabel, parsePageSelection, parseRangeGroups } from "../utils/pageRanges";
import { booleanOption, copySelectedPages, hexToRgb, loadPdf, numberOption, pageIndexesFor, stringOption } from "../utils/pdf";
import { dataUrlToBytes, parseSignaturePlacements, validateSignaturePlacements, type SignaturePlacement } from "../utils/signatures";

const PAGE_SIZES: Record<string, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  square: [720, 720]
};

export const mergePdf: ToolProcessor = async (files, options, context) => {
  if (files.length < 2) throw new Error("Add at least two PDFs to merge.");

  const output = await PDFDocument.create();
  let totalPages = 0;
  let separatorPages = 0;
  const fileSummaries: string[] = [];
  const addSeparators = booleanOption(options.separatorBlankPages);
  const requestedOutputName = stringOption(options.outputName, "docukind-merged").trim() || "docukind-merged";
  const outputName = `${normalizeFilename(requestedOutputName)}.pdf`;

  for (const [fileIndex, file] of files.entries()) {
    setProgress(context, `Reading ${file.name} (${fileIndex + 1} of ${files.length})`);
    const source = await loadPdf(file);
    const sourcePageCount = source.getPageCount();
    if (sourcePageCount < 1) throw new Error(`"${file.name}" does not contain any pages.`);
    totalPages += sourcePageCount;
    fileSummaries.push(`${file.name}: ${sourcePageCount} page${sourcePageCount === 1 ? "" : "s"}`);
    const pages = await output.copyPages(source, pageIndexesFor(source));
    for (const page of pages) output.addPage(page);

    if (addSeparators && fileIndex < files.length - 1) {
      const lastPage = pages.at(-1);
      const size = lastPage?.getSize() ?? { width: 612, height: 792 };
      output.addPage([size.width, size.height]);
      separatorPages += 1;
      totalPages += 1;
    }
  }

  setProgress(context, "Saving merged PDF");
  const separatorSummary = separatorPages > 0
    ? ` Inserted ${separatorPages} blank separator page${separatorPages === 1 ? "" : "s"}.`
    : "";
  return [
    resultFromBytes(
      outputName,
      await output.save({ useObjectStreams: true }),
      `Merged ${files.length} PDFs into ${totalPages} pages.${separatorSummary} ${fileSummaries.join(" | ")}.`
    )
  ];
};

export const splitPdf: ToolProcessor = async ([file], options, context) => {
  requireFile(file);

  setProgress(context, `Reading ${file.name}`);
  const source = await loadPdf(file);
  const totalPages = source.getPageCount();
  const mode = stringOption(options.splitMode, "every");
  const groups = mode === "ranges"
    ? parseRangeGroups(stringOption(options.ranges), totalPages)
    : allPageIndexes(totalPages).map((index) => [index]);

  const results: ToolResult[] = [];
  for (const [groupIndex, group] of groups.entries()) {
    setProgress(context, `Creating split ${groupIndex + 1} of ${groups.length}`);
    const output = await copySelectedPages(source, group);
    const label = mode === "ranges" ? `pages-${formatPageLabel(group)}` : `page-${group[0] + 1}`;
    const fallback = `part-${groupIndex + 1}`;
    results.push(
      resultFromBytes(
        makeOutputName(file.name, label || fallback),
        await output.save({ useObjectStreams: true }),
        `${group.length} page${group.length === 1 ? "" : "s"} from ${file.name}.`
      )
    );
  }

  return results;
};

export const organizePdf: ToolProcessor = async ([file], options, context) => {
  requireFile(file);

  setProgress(context, `Reading ${file.name}`);
  const source = await loadPdf(file);
  const totalPages = source.getPageCount();
  const reverse = booleanOption(options.reverseOrder);
  const rawOrder = stringOption(options.pageOrder);
  const order = reverse
    ? allPageIndexes(totalPages).reverse()
    : parsePageSelection(rawOrder || "all", totalPages);
  const output = await copySelectedPages(source, order);

  return [
    resultFromBytes(
      makeOutputName(file.name, "organized"),
      await output.save({ useObjectStreams: true }),
      `Created a ${order.length}-page PDF in the selected order.`
    )
  ];
};

export const rotatePdf: ToolProcessor = async ([file], options, context) => {
  requireFile(file);

  setProgress(context, `Reading ${file.name}`);
  const doc = await loadPdf(file);
  const angle = normalizeAngle(numberOption(options.angle, 90));
  const pages = parsePageSelection(stringOption(options.pages), doc.getPageCount());

  for (const index of pages) {
    const page = doc.getPage(index);
    page.setRotation(degrees(normalizeAngle(page.getRotation().angle + angle)));
  }

  return [
    resultFromBytes(
      makeOutputName(file.name, `rotated-${angle}`),
      await doc.save({ useObjectStreams: true }),
      `Rotated ${pages.length} page${pages.length === 1 ? "" : "s"} by ${angle} degrees.`
    )
  ];
};

export const deletePagesPdf: ToolProcessor = async ([file], options, context) => {
  requireFile(file);

  setProgress(context, `Reading ${file.name}`);
  const source = await loadPdf(file);
  const deleteSet = new Set(parsePageSelection(stringOption(options.pages), source.getPageCount()));
  const keep = pageIndexesFor(source).filter((index) => !deleteSet.has(index));
  if (keep.length === 0) throw new Error("Deleting every page would create an empty PDF.");

  const output = await copySelectedPages(source, keep);
  return [
    resultFromBytes(
      makeOutputName(file.name, "pages-removed"),
      await output.save({ useObjectStreams: true }),
      `Removed ${deleteSet.size} page${deleteSet.size === 1 ? "" : "s"} and kept ${keep.length}.`
    )
  ];
};

export const extractPagesPdf: ToolProcessor = async ([file], options, context) => {
  requireFile(file);

  setProgress(context, `Reading ${file.name}`);
  const source = await loadPdf(file);
  const selected = parsePageSelection(stringOption(options.pages), source.getPageCount());
  const output = await copySelectedPages(source, selected);

  return [
    resultFromBytes(
      makeOutputName(file.name, `pages-${formatPageLabel(selected)}`),
      await output.save({ useObjectStreams: true }),
      `Extracted ${selected.length} page${selected.length === 1 ? "" : "s"}.`
    )
  ];
};

export const imagesToPdf: ToolProcessor = async (files, options, context) => {
  if (files.length === 0) throw new Error("Add one or more images.");

  const pdf = await PDFDocument.create();
  const margin = numberOption(options.margin, 24);
  const pageSize = stringOption(options.pageSize, "auto");
  const fit = stringOption(options.fit, "contain");
  const backgroundColor = hexToRgb(stringOption(options.backgroundColor, "#ffffff"));

  for (const [index, file] of files.entries()) {
    setProgress(context, `Adding image ${index + 1} of ${files.length}`);
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

    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: backgroundColor });
    page.drawImage(image, {
      x: margin + (boxWidth - fitted.width) / 2,
      y: margin + (boxHeight - fitted.height) / 2,
      width: fitted.width,
      height: fitted.height
    });
  }

  return [
    resultFromBytes(
      "docukind-images.pdf",
      await pdf.save({ useObjectStreams: true }),
      `Created ${files.length} PDF page${files.length === 1 ? "" : "s"} from images.`
    )
  ];
};

export const pdfToImages: ToolProcessor = async ([file], options, context) => {
  requireFile(file);

  setProgress(context, `Reading ${file.name}`);
  const source = await loadPdf(file);
  const selected = parsePageSelection(stringOption(options.pages), source.getPageCount());
  const format = stringOption(options.format, "png") === "jpeg" ? "jpeg" : "png";
  const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
  const scale = numberOption(options.scale, 1.5);
  const quality = numberOption(options.quality, 0.86);
  const results: ToolResult[] = [];
  const { renderPdfPageToBlob } = await import("../utils/renderPdf");

  for (const [offset, index] of selected.entries()) {
    setProgress(context, `Rendering page ${offset + 1} of ${selected.length}`);
    const blob = await renderPdfPageToBlob(file, index + 1, scale, mimeType, quality);
    results.push(
      resultFromBlob(
        makeOutputName(file.name, `page-${index + 1}`, format === "jpeg" ? "jpg" : "png"),
        blob,
        `Page ${index + 1} exported as ${format.toUpperCase()}.`
      )
    );
  }

  return results;
};

export const watermarkPdf: ToolProcessor = async ([file], options, context) => {
  requireFile(file);

  const text = stringOption(options.text, "").trim();
  if (!text) throw new Error("Enter watermark text.");

  setProgress(context, `Reading ${file.name}`);
  const doc = await loadPdf(file);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = parsePageSelection(stringOption(options.pages), doc.getPageCount());
  const size = numberOption(options.size, 42);
  const opacity = clamp(numberOption(options.opacity, 0.18), 0.03, 1);
  const angle = numberOption(options.angle, -32);
  const color = hexToRgb(stringOption(options.color, "#f05d5e"));
  const position = stringOption(options.position, "center");
  const tile = booleanOption(options.tile);

  for (const index of pages) {
    const page = doc.getPage(index);
    if (tile) {
      drawTiledText(page, text, font, size, {
        color,
        angle,
        opacity
      });
      continue;
    }

    drawPlacedText(page, text, font, size, position, {
      color,
      angle,
      opacity
    });
  }

  return [
    resultFromBytes(
      makeOutputName(file.name, "watermarked"),
      await doc.save({ useObjectStreams: true }),
      `Applied watermark to ${pages.length} page${pages.length === 1 ? "" : "s"}.`
    )
  ];
};

export const pageNumbersPdf: ToolProcessor = async ([file], options, context) => {
  requireFile(file);

  setProgress(context, `Reading ${file.name}`);
  const doc = await loadPdf(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const selected = parsePageSelection(stringOption(options.pages), doc.getPageCount());
  const startAt = Math.max(1, Math.round(numberOption(options.startAt, 1)));
  const size = numberOption(options.size, 11);
  const color = hexToRgb(stringOption(options.color, "#1f2a24"));
  const prefix = stringOption(options.prefix);
  const suffix = stringOption(options.suffix);
  const position = stringOption(options.position, "bottom-center");
  const includeTotal = booleanOption(options.includeTotal);

  for (const [offset, index] of selected.entries()) {
    const pageNumber = startAt + offset;
    const text = includeTotal
      ? `${prefix}${pageNumber} / ${doc.getPageCount()}${suffix}`
      : `${prefix}${pageNumber}${suffix}`;
    drawPlacedText(doc.getPage(index), text, font, size, position, { color, opacity: 1, angle: 0 });
  }

  return [
    resultFromBytes(
      makeOutputName(file.name, "numbered"),
      await doc.save({ useObjectStreams: true }),
      `Numbered ${selected.length} page${selected.length === 1 ? "" : "s"} starting at ${startAt}.`
    )
  ];
};

export const signPdf: ToolProcessor = async ([file], options, context) => {
  requireFile(file);

  setProgress(context, `Reading ${file.name}`);
  const doc = await loadPdf(file);
  const placements = parseSignaturePlacements(options.placements);
  const pageSizes = doc.getPages().map((page) => page.getSize());
  const validPlacements = validateSignaturePlacements(placements, pageSizes);
  const fonts = {
    script: await doc.embedFont(StandardFonts.TimesRomanItalic),
    formal: await doc.embedFont(StandardFonts.HelveticaOblique),
    classic: await doc.embedFont(StandardFonts.CourierOblique),
    plain: await doc.embedFont(StandardFonts.Helvetica)
  };

  for (const placement of validPlacements) {
    setProgress(context, `Applying field ${validPlacements.indexOf(placement) + 1} of ${validPlacements.length}`);
    const page = doc.getPage(placement.pageIndex);
    if (placement.imageData) {
      const image = await embedSignatureImage(doc, placement);
      page.drawImage(image, {
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
        rotate: degrees(placement.rotation ?? 0),
        opacity: placement.opacity ?? 1
      });
      continue;
    }

    drawSignatureText(page, placement, fonts[placement.fontStyle ?? "script"]);
  }

  return [
    resultFromBytes(
      makeOutputName(file.name, "signed"),
      await doc.save({ useObjectStreams: true }),
      `Added ${validPlacements.length} visual signing field${validPlacements.length === 1 ? "" : "s"} locally.`
    )
  ];
};

export const metadataPdf: ToolProcessor = async ([file], options, context) => {
  requireFile(file);

  setProgress(context, `Reading ${file.name}`);
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

  return [
    resultFromBytes(
      makeOutputName(file.name, mode === "clear" ? "metadata-cleared" : "metadata-updated"),
      await doc.save({ useObjectStreams: true }),
      mode === "clear" ? "Cleared editable document metadata." : "Updated document metadata."
    )
  ];
};

export const compressPdf: ToolProcessor = async ([file], options, context) => {
  requireFile(file);

  const mode = stringOption(options.mode, "lossless");
  if (mode === "raster") {
    return [await rasterCompress(file, options, context)];
  }

  setProgress(context, `Reading ${file.name}`);
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

async function rasterCompress(file: File, options: ToolOptions, context?: ToolRunContext): Promise<ToolResult> {
  setProgress(context, `Reading ${file.name}`);
  const source = await loadPdf(file);
  const output = await PDFDocument.create();
  const scale = numberOption(options.rasterScale, 1.1);
  const quality = clamp(numberOption(options.jpegQuality, 0.68), 0.2, 0.95);
  const { renderPdfPageToBlob } = await import("../utils/renderPdf");

  for (let index = 0; index < source.getPageCount(); index += 1) {
    setProgress(context, `Rasterizing page ${index + 1} of ${source.getPageCount()}`);
    const blob = await renderPdfPageToBlob(file, index + 1, scale, "image/jpeg", quality);
    const image = await output.embedJpg(await fileToUint8Array(blob));
    const { width, height } = source.getPage(index).getSize();
    const page = output.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
    page.drawImage(image, { x: 0, y: 0, width, height });
  }

  const bytes = await output.save({ useObjectStreams: true });
  return resultFromBytes(
    makeOutputName(file.name, "raster-compressed"),
    bytes,
    `${compressionSummary(file.size, bytes.length, "Raster rebuild")} Selectable text is not preserved.`
  );
}

function setProgress(context: ToolRunContext | undefined, message: string): void {
  context?.onProgress?.(message);
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

function drawTiledText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  options: {
    color: ReturnType<typeof hexToRgb>;
    opacity: number;
    angle: number;
  }
): void {
  const { width, height } = page.getSize();
  const textWidth = font.widthOfTextAtSize(text, size);
  const horizontalStep = Math.max(textWidth * 1.9, 180);
  const verticalStep = Math.max(size * 5, 120);

  for (let y = -verticalStep; y < height + verticalStep; y += verticalStep) {
    for (let x = -horizontalStep; x < width + horizontalStep; x += horizontalStep) {
      page.drawText(text, {
        x,
        y,
        size,
        font,
        color: options.color,
        rotate: degrees(options.angle),
        opacity: options.opacity
      });
    }
  }
}

async function embedSignatureImage(pdf: PDFDocument, placement: SignaturePlacement): Promise<PDFImage> {
  if (!placement.imageData) throw new Error("Signature image is missing.");
  const { bytes, mimeType } = dataUrlToBytes(placement.imageData);

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return pdf.embedJpg(bytes);
  }

  if (mimeType === "image/png") {
    return pdf.embedPng(bytes);
  }

  throw new Error("Signature images must be PNG or JPG.");
}

function drawSignatureText(page: PDFPage, placement: SignaturePlacement, font: PDFFont): void {
  const text = placement.value.trim();
  const padding = Math.min(8, placement.width * 0.08);
  const maxWidth = Math.max(1, placement.width - padding * 2);
  const maxHeight = Math.max(1, placement.height - padding * 2);
  const size = fitTextSize(font, text, maxWidth, maxHeight, placement.kind === "signature" ? 30 : 15);
  const y = placement.y + Math.max(padding, (placement.height - size) / 2);

  page.drawText(text, {
    x: placement.x + padding,
    y,
    size,
    font,
    color: hexToRgb(placement.color ?? "#1f2a24"),
    rotate: degrees(placement.rotation ?? 0),
    opacity: placement.opacity ?? 1,
    maxWidth
  });
}

function fitTextSize(font: PDFFont, text: string, maxWidth: number, maxHeight: number, preferred: number): number {
  let size = Math.min(preferred, maxHeight);
  while (size > 6 && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 1;
  }
  return Math.max(6, size);
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
