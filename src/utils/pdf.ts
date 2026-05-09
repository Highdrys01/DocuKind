import { PDFDocument, rgb, type RGB } from "pdf-lib";
import { fileToUint8Array } from "./file";

export async function loadPdf(file: File): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(await fileToUint8Array(file), {
      ignoreEncryption: false,
      updateMetadata: false
    });
  } catch (error) {
    if (error instanceof Error && /encrypted/i.test(error.message)) {
      throw new Error("This PDF appears to be encrypted. Browser-only unlock is not included in DocuKind v1.");
    }

    throw new Error(`Could not read "${file.name}" as a PDF.`);
  }
}

export async function copySelectedPages(source: PDFDocument, indexes: number[]): Promise<PDFDocument> {
  const output = await PDFDocument.create();
  const copiedPages = await output.copyPages(source, indexes);
  for (const page of copiedPages) {
    output.addPage(page);
  }
  return output;
}

export function pageIndexesFor(doc: PDFDocument): number[] {
  return Array.from({ length: doc.getPageCount() }, (_, index) => index);
}

export function hexToRgb(hex: string): RGB {
  const normalized = hex.trim().replace(/^#/, "");
  const full = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;

  if (!/^[0-9a-f]{6}$/i.test(full)) {
    return rgb(0.12, 0.16, 0.14);
  }

  return rgb(
    Number.parseInt(full.slice(0, 2), 16) / 255,
    Number.parseInt(full.slice(2, 4), 16) / 255,
    Number.parseInt(full.slice(4, 6), 16) / 255
  );
}

export function numberOption(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function stringOption(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function booleanOption(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}
