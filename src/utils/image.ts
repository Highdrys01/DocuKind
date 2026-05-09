import picaFactory from "pica";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
import UPNG from "upng-js";
import { formatBytes, makeOutputName, resultFromBlob, uint8ArrayToArrayBuffer } from "./file";
import type { ToolResult } from "../types";

export const IMAGE_ACCEPTS = "image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif";

const pica = picaFactory({ features: ["js", "wasm", "ww"] });

export type ImageRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
  unit: "percent" | "pixel";
};

export type ImageFit = "contain" | "cover" | "stretch" | "inside";
export type ImageExportFormat = "png" | "jpeg" | "webp" | "gif";

export type ImageTransform = {
  rotate?: number;
  flipX?: boolean;
  flipY?: boolean;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  grayscale?: boolean;
  sepia?: boolean;
};

export async function loadImageFile(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error(`Could not decode "${file.name}" as an image.`));
        element.src = url;
      });
      return createImageBitmap(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export async function imageFileToCanvas(file: File, background?: string | null): Promise<HTMLCanvasElement> {
  const bitmap = await loadImageFile(file);
  const canvas = createCanvas(bitmap.width, bitmap.height);
  const context = get2d(canvas);
  if (background) fillBackground(context, canvas.width, canvas.height, background);
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

export async function resizeCanvas(source: HTMLCanvasElement, width: number, height: number): Promise<HTMLCanvasElement> {
  const target = createCanvas(width, height);
  await pica.resize(source, target, {
    filter: "mks2013",
    unsharpAmount: 120,
    unsharpRadius: 0.6,
    unsharpThreshold: 2
  });
  return target;
}

export async function exportCanvas(
  canvas: HTMLCanvasElement,
  format: ImageExportFormat,
  quality = 0.86
): Promise<Blob> {
  if (format === "gif") {
    return encodeGifFromCanvases([canvas], { delay: 400, repeat: -1 });
  }

  const mimeType = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
  if (format === "webp" && !canExportWebp()) {
    throw new Error("This browser cannot export WebP images. Choose PNG or JPG instead.");
  }

  return pica.toBlob(canvas, mimeType, quality);
}

export function flattenCanvas(canvas: HTMLCanvasElement, background: string): HTMLCanvasElement {
  const target = createCanvas(canvas.width, canvas.height);
  const context = get2d(target);
  fillBackground(context, target.width, target.height, background);
  context.drawImage(canvas, 0, 0);
  return target;
}

export function hasTransparentPixels(canvas: HTMLCanvasElement): boolean {
  const data = get2d(canvas).getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 255) return true;
  }
  return false;
}

export function exportIndexedPngCanvas(canvas: HTMLCanvasElement, colors = 256): Blob {
  const context = get2d(canvas);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const rgba = uint8ArrayToArrayBuffer(new Uint8Array(imageData.data));
  const encoded = UPNG.encode([rgba], canvas.width, canvas.height, clamp(Math.round(colors), 2, 256));
  return new Blob([encoded], { type: "image/png" });
}

export async function encodeGifFromCanvases(
  canvases: HTMLCanvasElement[],
  options: { delay: number; repeat: number }
): Promise<Blob> {
  if (canvases.length === 0) throw new Error("Add at least one frame for GIF output.");

  const gif = GIFEncoder();
  for (const [index, canvas] of canvases.entries()) {
    const imageData = get2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
    const palette = quantize(imageData.data, 256, { format: "rgb565" });
    const indexed = applyPalette(imageData.data, palette, "rgb565");
    gif.writeFrame(indexed, canvas.width, canvas.height, {
      palette,
      delay: Math.max(20, options.delay),
      repeat: index === 0 ? options.repeat : undefined
    });
  }
  gif.finish();
  return new Blob([uint8ArrayToArrayBuffer(gif.bytes())], { type: "image/gif" });
}

export function calculateResize(
  sourceWidth: number,
  sourceHeight: number,
  options: {
    mode: "pixels" | "percent";
    width?: number;
    height?: number;
    percent?: number;
    fit?: ImageFit;
  }
): { width: number; height: number } {
  if (options.mode === "percent") {
    const scale = clamp((options.percent ?? 100) / 100, 0.01, 10);
    return normalizeDimensions(sourceWidth * scale, sourceHeight * scale);
  }

  const targetWidth = Math.max(1, Math.round(options.width || sourceWidth));
  const targetHeight = Math.max(1, Math.round(options.height || sourceHeight));
  const fit = options.fit ?? "inside";

  if (fit === "stretch") return normalizeDimensions(targetWidth, targetHeight);

  const scale = fit === "cover"
    ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
    : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);

  if (fit === "inside" && scale >= 1) return normalizeDimensions(sourceWidth, sourceHeight);
  return normalizeDimensions(sourceWidth * scale, sourceHeight * scale);
}

export function parseRegionList(value: string, sourceWidth: number, sourceHeight: number): ImageRegion[] {
  return value
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => parseRegion(part, sourceWidth, sourceHeight));
}

export function parseRegion(value: string, sourceWidth: number, sourceHeight: number): ImageRegion {
  const tokens = value.split(",").map((token) => token.trim()).filter(Boolean);
  if (tokens.length !== 4) {
    throw new Error(`Region "${value}" is not valid. Use x,y,width,height.`);
  }

  const isPercent = tokens.some((token) => token.endsWith("%"));
  const values = tokens.map((token) => Number(token.replace("%", "")));
  if (values.some((number) => !Number.isFinite(number))) {
    throw new Error(`Region "${value}" contains invalid numbers.`);
  }

  const [x, y, width, height] = values;
  const region = isPercent
    ? { x: (x / 100) * sourceWidth, y: (y / 100) * sourceHeight, width: (width / 100) * sourceWidth, height: (height / 100) * sourceHeight }
    : { x, y, width, height };

  const normalized = clampRegion(region, sourceWidth, sourceHeight);
  return {
    ...normalized,
    unit: "pixel"
  };
}

export function formatPercentRegion(region: ImageRegion, sourceWidth = 100, sourceHeight = 100): string {
  const x = region.unit === "percent" ? region.x : (region.x / sourceWidth) * 100;
  const y = region.unit === "percent" ? region.y : (region.y / sourceHeight) * 100;
  const width = region.unit === "percent" ? region.width : (region.width / sourceWidth) * 100;
  const height = region.unit === "percent" ? region.height : (region.height / sourceHeight) * 100;
  return [x, y, width, height].map((value) => `${clamp(value, 0, 100).toFixed(1)}%`).join(",");
}

export function cropCanvas(source: HTMLCanvasElement, region: ImageRegion): HTMLCanvasElement {
  const normalized = clampRegion(region, source.width, source.height);
  const target = createCanvas(normalized.width, normalized.height);
  get2d(target).drawImage(
    source,
    normalized.x,
    normalized.y,
    normalized.width,
    normalized.height,
    0,
    0,
    normalized.width,
    normalized.height
  );
  return target;
}

export function transformCanvas(source: HTMLCanvasElement, transform: ImageTransform): HTMLCanvasElement {
  const rotation = normalizeRotation(transform.rotate ?? 0);
  const swapsDimensions = rotation === 90 || rotation === 270;
  const target = createCanvas(swapsDimensions ? source.height : source.width, swapsDimensions ? source.width : source.height);
  const context = get2d(target);
  context.save();
  context.translate(target.width / 2, target.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(transform.flipX ? -1 : 1, transform.flipY ? -1 : 1);
  context.filter = filterString(transform);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  context.restore();
  return target;
}

export function drawTextWatermark(
  canvas: HTMLCanvasElement,
  options: {
    text: string;
    color: string;
    opacity: number;
    size: number;
    position: string;
    angle: number;
    repeat: boolean;
  }
): HTMLCanvasElement {
  const target = cloneCanvas(canvas);
  const context = get2d(target);
  const text = options.text.trim();
  if (!text) throw new Error("Enter watermark text.");

  context.save();
  context.globalAlpha = clamp(options.opacity, 0.03, 1);
  context.fillStyle = options.color;
  context.font = `700 ${Math.round(options.size)}px system-ui, -apple-system, Segoe UI, sans-serif`;
  context.textBaseline = "middle";
  context.textAlign = "center";

  if (options.repeat) {
    const metrics = context.measureText(text);
    const stepX = Math.max(metrics.width * 1.9, options.size * 6);
    const stepY = Math.max(options.size * 4.2, 100);
    for (let y = -stepY; y < target.height + stepY; y += stepY) {
      for (let x = -stepX; x < target.width + stepX; x += stepX) {
        drawAngledText(context, text, x, y, options.angle);
      }
    }
  } else {
    const point = pointForPosition(options.position, target.width, target.height, options.size);
    drawAngledText(context, text, point.x, point.y, options.angle);
  }

  context.restore();
  return target;
}

export function drawMemeText(
  canvas: HTMLCanvasElement,
  options: {
    topText: string;
    bottomText: string;
    textColor: string;
    strokeColor: string;
    fontScale: number;
  }
): HTMLCanvasElement {
  const target = cloneCanvas(canvas);
  const context = get2d(target);
  const fontSize = Math.max(18, Math.round(Math.min(target.width, target.height) * options.fontScale));
  context.textAlign = "center";
  context.lineJoin = "round";
  context.fillStyle = options.textColor;
  context.strokeStyle = options.strokeColor;
  context.lineWidth = Math.max(3, fontSize * 0.12);
  context.font = `900 ${fontSize}px Impact, Arial Black, system-ui, sans-serif`;

  drawWrappedCaption(context, options.topText.toUpperCase(), target.width / 2, fontSize * 0.9, target.width * 0.9, fontSize, "top");
  drawWrappedCaption(context, options.bottomText.toUpperCase(), target.width / 2, target.height - fontSize * 0.35, target.width * 0.9, fontSize, "bottom");
  return target;
}

export function blurOrRedactRegions(
  canvas: HTMLCanvasElement,
  regions: ImageRegion[],
  options: { mode: "blur" | "redact"; blur: number; color: string }
): HTMLCanvasElement {
  const target = cloneCanvas(canvas);
  const context = get2d(target);

  for (const region of regions.map((item) => clampRegion(item, target.width, target.height))) {
    if (options.mode === "redact") {
      context.fillStyle = options.color;
      context.fillRect(region.x, region.y, region.width, region.height);
      continue;
    }

    const temporary = createCanvas(region.width, region.height);
    const tempContext = get2d(temporary);
    tempContext.filter = `blur(${Math.max(1, options.blur)}px)`;
    tempContext.drawImage(target, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
    context.drawImage(temporary, region.x, region.y);
  }

  return target;
}

export async function resultFromCanvas(
  inputName: string,
  suffix: string,
  canvas: HTMLCanvasElement,
  format: ImageExportFormat,
  quality: number,
  summary: string
): Promise<ToolResult> {
  const blob = await exportCanvas(canvas, format, quality);
  const extension = format === "jpeg" ? "jpg" : format;
  return resultFromBlob(makeOutputName(inputName, suffix, extension), blob, summary);
}

export function compressionSummary(inputBytes: number, outputBytes: number): string {
  const delta = inputBytes - outputBytes;
  if (delta > 0) {
    const percent = Math.round((delta / inputBytes) * 100);
    return `${formatBytes(delta)} smaller (${percent}% reduction).`;
  }

  return `Output is ${formatBytes(outputBytes)}. Some images are already optimized.`;
}

export function outputFormatFromMime(type: string): "png" | "jpeg" | "webp" {
  if (type === "image/jpeg") return "jpeg";
  if (type === "image/webp") return "webp";
  return "png";
}

export function supportsBrowserImage(file: File): boolean {
  return /image\/(png|jpeg|webp|gif)/i.test(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const target = createCanvas(source.width, source.height);
  get2d(target).drawImage(source, 0, 0);
  return target;
}

function fillBackground(context: CanvasRenderingContext2D, width: number, height: number, color: string): void {
  context.fillStyle = color;
  context.fillRect(0, 0, width, height);
}

function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is not available in this browser.");
  return context;
}

function clampRegion(region: Omit<ImageRegion, "unit"> | ImageRegion, sourceWidth: number, sourceHeight: number): ImageRegion {
  const x = clamp(Math.round(region.x), 0, sourceWidth - 1);
  const y = clamp(Math.round(region.y), 0, sourceHeight - 1);
  const width = clamp(Math.round(region.width), 1, sourceWidth - x);
  const height = clamp(Math.round(region.height), 1, sourceHeight - y);
  return { x, y, width, height, unit: "pixel" };
}

function normalizeDimensions(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height))
  };
}

function normalizeRotation(value: number): number {
  return ((Math.round(value / 90) * 90) % 360 + 360) % 360;
}

function filterString(transform: ImageTransform): string {
  const filters = [
    `brightness(${clamp(transform.brightness ?? 100, 0, 300)}%)`,
    `contrast(${clamp(transform.contrast ?? 100, 0, 300)}%)`,
    `saturate(${clamp(transform.saturation ?? 100, 0, 300)}%)`
  ];
  if ((transform.blur ?? 0) > 0) filters.push(`blur(${clamp(transform.blur ?? 0, 0, 40)}px)`);
  if (transform.grayscale) filters.push("grayscale(100%)");
  if (transform.sepia) filters.push("sepia(100%)");
  return filters.join(" ");
}

function drawAngledText(context: CanvasRenderingContext2D, text: string, x: number, y: number, angle: number): void {
  context.save();
  context.translate(x, y);
  context.rotate((angle * Math.PI) / 180);
  context.fillText(text, 0, 0);
  context.restore();
}

function pointForPosition(position: string, width: number, height: number, size: number): { x: number; y: number } {
  const margin = Math.max(20, size * 1.4);
  const horizontal = position.includes("left") ? margin : position.includes("right") ? width - margin : width / 2;
  const vertical = position.includes("top") ? margin : position.includes("bottom") ? height - margin : height / 2;
  return { x: horizontal, y: vertical };
}

function drawWrappedCaption(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  anchor: "top" | "bottom"
): void {
  if (!text.trim()) return;

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || current === "") {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  const startY = anchor === "top" ? y : y - (lines.length - 1) * lineHeight;
  for (const [index, line] of lines.entries()) {
    const lineY = startY + index * lineHeight;
    context.strokeText(line, x, lineY);
    context.fillText(line, x, lineY);
  }
}

function canExportWebp(): boolean {
  const canvas = createCanvas(1, 1);
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
