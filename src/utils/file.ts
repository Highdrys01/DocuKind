import type { ToolResult } from "../types";

export const PDF_MIME = "application/pdf";

export async function fileToUint8Array(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export function normalizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return cleaned || "document";
}

export function makeOutputName(inputName: string, suffix: string, extension = "pdf"): string {
  return `${normalizeFilename(inputName)}-${suffix}.${extension.replace(/^\./, "")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function acceptsFile(file: File, accepts: string): boolean {
  const tokens = accepts
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) return true;

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  return tokens.some((token) => {
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

export function dedupeFiles(files: File[]): File[] {
  const seen = new Set<string>();
  const unique: File[] = [];

  for (const file of files) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(file);
    }
  }

  return unique;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function resultFromBytes(filename: string, bytes: Uint8Array, summary?: string): ToolResult {
  return {
    filename,
    blob: new Blob([uint8ArrayToArrayBuffer(bytes)], { type: PDF_MIME }),
    summary
  };
}

export function resultFromBlob(filename: string, blob: Blob, summary?: string): ToolResult {
  return { filename, blob, summary };
}

export function uint8ArrayToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
