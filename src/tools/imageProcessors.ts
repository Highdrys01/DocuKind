import type { ToolOptions, ToolProcessor, ToolResult, ToolRunContext } from "../types";
import {
  IMAGE_ACCEPTS,
  blurOrRedactRegions,
  calculateResize,
  cropCanvas,
  drawMemeText,
  drawTextWatermark,
  encodeGifFromCanvases,
  exportCanvas,
  exportIndexedPngCanvas,
  flattenCanvas,
  hasTransparentPixels,
  imageFileToCanvas,
  outputFormatFromMime,
  parseRegion,
  parseRegionList,
  resizeCanvas,
  resultFromCanvas,
  supportsBrowserImage,
  transformCanvas
} from "../utils/image";
import { formatBytes, makeOutputName, resultFromBlob } from "../utils/file";
import { booleanOption, numberOption, stringOption } from "../utils/pdf";

const MAX_SAFE_CANVAS_PIXELS = 32_000_000;
const MIN_TARGET_DIMENSION = 96;
const JPEG_WEBP_MIN_QUALITY = 0.2;

export type CompressImageOutput = "auto" | "png" | "jpeg" | "webp";
export type CompressionPreset = "balanced" | "small" | "quality" | "custom";
export type CompressionAttempt = {
  blob: Blob;
  format: "png" | "jpeg" | "webp";
  width: number;
  height: number;
  quality?: number;
  targetMet?: boolean;
  notes: string[];
};

export type CompressionSummary = {
  originalBytes: number;
  outputBytes: number;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  format: "png" | "jpeg" | "webp";
  preset: CompressionPreset;
  targetBytes: number;
  targetMet?: boolean;
  quality?: number;
  skipped: boolean;
  attemptedBytes?: number;
  notes: string[];
};

type NormalizedCompressionOptions = {
  output: CompressImageOutput;
  preset: CompressionPreset;
  quality: number;
  minQuality: number;
  targetBytes: number;
  maxWidth: number;
  maxHeight: number;
  reduceDimensions: boolean;
  neverUpscale: boolean;
  backgroundColor: string;
  skipLarger: boolean;
};

export const compressImage: ToolProcessor = async (files, options, context) => {
  requireImages(files);

  const settings = resolveCompressionOptions(options);
  const results: ToolResult[] = [];
  const totals = { originalBytes: 0, outputBytes: 0 };

  for (const [index, file] of files.entries()) {
    setProgress(context, `Compressing image ${index + 1} of ${files.length}`);
    let canvas = await imageFileToCanvas(file);
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;
    const hasAlpha = hasTransparentPixels(canvas);
    const notes: string[] = [];
    assertCanvasSize(canvas.width, canvas.height);

    if (settings.maxWidth > 0 || settings.maxHeight > 0) {
      const resized = calculateResize(canvas.width, canvas.height, {
        mode: "pixels",
        width: settings.maxWidth || canvas.width,
        height: settings.maxHeight || canvas.height,
        fit: settings.neverUpscale ? "inside" : "contain"
      });
      if (resized.width !== canvas.width || resized.height !== canvas.height) {
        canvas = await resizeCanvas(canvas, resized.width, resized.height);
        notes.push(`Resized from ${originalWidth}x${originalHeight}.`);
      }
    }

    const format = resolveOutputFormat(file, settings.output);
    if (isGif(file)) {
      notes.push("GIF uploads are browser-decoded as one still frame; animation is not preserved.");
    }
    if (format === "jpeg" && hasAlpha) {
      notes.push(`Transparency flattened over ${settings.backgroundColor}.`);
    } else if (hasAlpha && (format === "png" || format === "webp")) {
      notes.push("Transparency preserved.");
    }

    const outputCanvas = format === "jpeg" ? flattenCanvas(canvas, settings.backgroundColor) : canvas;
    const attempt = await compressCanvas(outputCanvas, format, settings, context);
    const shouldSkip = settings.skipLarger && attempt.blob.size > file.size;
    const blob = shouldSkip ? file.slice(0, file.size, file.type || attempt.blob.type) : attempt.blob;
    const filename = shouldSkip
      ? compressionOutputName(file.name, format, true, extensionFromFile(file))
      : compressionOutputName(file.name, format);
    const summary = buildCompressionSummary({
      originalBytes: file.size,
      outputBytes: blob.size,
      originalWidth,
      originalHeight,
      outputWidth: shouldSkip ? originalWidth : attempt.width,
      outputHeight: shouldSkip ? originalHeight : attempt.height,
      format,
      preset: settings.preset,
      targetBytes: settings.targetBytes,
      targetMet: attempt.targetMet,
      quality: attempt.quality,
      skipped: shouldSkip,
      attemptedBytes: shouldSkip ? attempt.blob.size : undefined,
      notes: [...notes, ...attempt.notes]
    });

    totals.originalBytes += file.size;
    totals.outputBytes += blob.size;
    results.push(resultFromBlob(filename, blob, summary));
  }

  return addBatchSummary(results, totals);
};

export const resizeImage: ToolProcessor = async (files, options, context) => {
  requireImages(files);

  const mode = stringOption(options.resizeMode, "pixels") === "percent" ? "percent" : "pixels";
  const outputFormat = normalizeFormat(stringOption(options.outputFormat, "png"));
  const quality = numberOption(options.quality, 0.9);
  const results: ToolResult[] = [];

  for (const [index, file] of files.entries()) {
    setProgress(context, `Resizing image ${index + 1} of ${files.length}`);
    const canvas = await imageFileToCanvas(file, "#ffffff");
    assertCanvasSize(canvas.width, canvas.height);
    const dimensions = calculateResize(canvas.width, canvas.height, {
      mode,
      width: numberOption(options.width, canvas.width),
      height: numberOption(options.height, canvas.height),
      percent: numberOption(options.percent, 50),
      fit: normalizeFit(stringOption(options.fit, "inside"))
    });
    const resized = await resizeCanvas(canvas, dimensions.width, dimensions.height);
    results.push(
      await resultFromCanvas(
        file.name,
        `${dimensions.width}x${dimensions.height}`,
        resized,
        outputFormat,
        quality,
        `Resized from ${canvas.width}x${canvas.height} to ${dimensions.width}x${dimensions.height}.`
      )
    );
  }

  return results;
};

export const cropImage: ToolProcessor = async (files, options, context) => {
  requireImages(files);

  const outputFormat = normalizeFormat(stringOption(options.outputFormat, "png"));
  const quality = numberOption(options.quality, 0.92);
  const results: ToolResult[] = [];

  for (const [index, file] of files.entries()) {
    setProgress(context, `Cropping image ${index + 1} of ${files.length}`);
    const canvas = await imageFileToCanvas(file, "#ffffff");
    const region = regionFromOptions(canvas.width, canvas.height, options);
    const cropped = cropCanvas(canvas, region);
    results.push(
      await resultFromCanvas(
        file.name,
        `crop-${cropped.width}x${cropped.height}`,
        cropped,
        outputFormat,
        quality,
        `Cropped to ${cropped.width}x${cropped.height}.`
      )
    );
  }

  return results;
};

export const rotateFlipImage: ToolProcessor = async (files, options, context) => {
  requireImages(files);

  const outputFormat = normalizeFormat(stringOption(options.outputFormat, "png"));
  const quality = numberOption(options.quality, 0.9);
  const rotate = numberOption(options.rotate, 90);
  const flipX = booleanOption(options.flipX);
  const flipY = booleanOption(options.flipY);
  const results: ToolResult[] = [];

  for (const [index, file] of files.entries()) {
    setProgress(context, `Transforming image ${index + 1} of ${files.length}`);
    const canvas = await imageFileToCanvas(file, "#ffffff");
    const transformed = transformCanvas(canvas, { rotate, flipX, flipY });
    results.push(
      await resultFromCanvas(
        file.name,
        "transformed",
        transformed,
        outputFormat,
        quality,
        `Output dimensions: ${transformed.width}x${transformed.height}.`
      )
    );
  }

  return results;
};

export const convertToJpg: ToolProcessor = async (files, options, context) => {
  requireImages(files);

  const quality = numberOption(options.quality, 0.9);
  const background = stringOption(options.backgroundColor, "#ffffff");
  const results: ToolResult[] = [];

  for (const [index, file] of files.entries()) {
    setProgress(context, `Converting image ${index + 1} of ${files.length}`);
    const canvas = await imageFileToCanvas(file, background);
    results.push(await resultFromCanvas(file.name, "converted", canvas, "jpeg", quality, `Converted to JPG at ${canvas.width}x${canvas.height}.`));
  }

  return results;
};

export const convertFromJpg: ToolProcessor = async (files, options, context) => {
  if (files.length === 0) throw new Error("Add one or more JPG images.");
  for (const file of files) {
    if (!/image\/jpeg/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) {
      throw new Error("Convert from JPG accepts JPG/JPEG images only.");
    }
  }

  const format = normalizeFormat(stringOption(options.outputFormat, "png"));
  const quality = numberOption(options.quality, 0.9);
  const gifDelay = numberOption(options.gifDelay, 500);
  const results: ToolResult[] = [];

  if (format === "gif" && files.length > 1) {
    const canvases: HTMLCanvasElement[] = [];
    let targetWidth = 0;
    let targetHeight = 0;
    for (const [index, file] of files.entries()) {
      setProgress(context, `Preparing GIF frame ${index + 1} of ${files.length}`);
      const canvas = await imageFileToCanvas(file, "#ffffff");
      if (index === 0) {
        targetWidth = canvas.width;
        targetHeight = canvas.height;
      }
      canvases.push(index === 0 ? canvas : await resizeCanvas(canvas, targetWidth, targetHeight));
    }
    const blob = await encodeGifFromCanvases(canvases, { delay: gifDelay, repeat: 0 });
    return [resultFromBlob("docukind-animation.gif", blob, `Created animated GIF from ${files.length} JPG frames.`)];
  }

  for (const [index, file] of files.entries()) {
    setProgress(context, `Converting JPG ${index + 1} of ${files.length}`);
    const canvas = await imageFileToCanvas(file, "#ffffff");
    results.push(await resultFromCanvas(file.name, "converted", canvas, format, quality, `Converted from JPG to ${format.toUpperCase()}.`));
  }

  return results;
};

export const watermarkImage: ToolProcessor = async (files, options, context) => {
  requireImages(files);

  const text = stringOption(options.text, "").trim();
  if (!text) throw new Error("Enter watermark text.");

  const outputFormat = normalizeFormat(stringOption(options.outputFormat, "png"));
  const quality = numberOption(options.quality, 0.9);
  const results: ToolResult[] = [];

  for (const [index, file] of files.entries()) {
    setProgress(context, `Watermarking image ${index + 1} of ${files.length}`);
    const canvas = await imageFileToCanvas(file, "#ffffff");
    const watermarked = drawTextWatermark(canvas, {
      text,
      color: stringOption(options.color, "#ffffff"),
      opacity: numberOption(options.opacity, 0.65),
      size: numberOption(options.size, Math.max(24, Math.round(Math.min(canvas.width, canvas.height) * 0.09))),
      position: stringOption(options.position, "center"),
      angle: numberOption(options.angle, -22),
      repeat: booleanOption(options.repeat)
    });
    results.push(await resultFromCanvas(file.name, "watermarked", watermarked, outputFormat, quality, "Applied text watermark."));
  }

  return results;
};

export const memeGenerator: ToolProcessor = async (files, options, context) => {
  requireImages(files);

  const topText = stringOption(options.topText, "").trim();
  const bottomText = stringOption(options.bottomText, "").trim();
  if (!topText && !bottomText) throw new Error("Enter top text, bottom text, or both.");

  const outputFormat = normalizeFormat(stringOption(options.outputFormat, "png"));
  const quality = numberOption(options.quality, 0.92);
  const results: ToolResult[] = [];

  for (const [index, file] of files.entries()) {
    setProgress(context, `Creating meme ${index + 1} of ${files.length}`);
    const canvas = await imageFileToCanvas(file, "#ffffff");
    const meme = drawMemeText(canvas, {
      topText,
      bottomText,
      textColor: stringOption(options.textColor, "#ffffff"),
      strokeColor: stringOption(options.strokeColor, "#000000"),
      fontScale: numberOption(options.fontScale, 0.1)
    });
    results.push(await resultFromCanvas(file.name, "meme", meme, outputFormat, quality, "Added meme captions."));
  }

  return results;
};

export const photoEditor: ToolProcessor = async (files, options, context) => {
  requireImages(files);

  const outputFormat = normalizeFormat(stringOption(options.outputFormat, "png"));
  const quality = numberOption(options.quality, 0.9);
  const results: ToolResult[] = [];

  for (const [index, file] of files.entries()) {
    setProgress(context, `Editing image ${index + 1} of ${files.length}`);
    let canvas = await imageFileToCanvas(file, "#ffffff");
    const cropRegionValue = stringOption(options.cropRegion, "").trim();
    if (cropRegionValue) {
      canvas = cropCanvas(canvas, parseRegion(cropRegionValue, canvas.width, canvas.height));
    }
    canvas = transformCanvas(canvas, {
      rotate: numberOption(options.rotate, 0),
      flipX: booleanOption(options.flipX),
      flipY: booleanOption(options.flipY),
      brightness: numberOption(options.brightness, 100),
      contrast: numberOption(options.contrast, 100),
      saturation: numberOption(options.saturation, 100),
      blur: numberOption(options.blur, 0),
      grayscale: booleanOption(options.grayscale),
      sepia: booleanOption(options.sepia)
    });
    results.push(await resultFromCanvas(file.name, "edited", canvas, outputFormat, quality, "Applied editor adjustments."));
  }

  return results;
};

export const blurRedactImage: ToolProcessor = async (files, options, context) => {
  requireImages(files);

  const regionText = stringOption(options.regions, "").trim();
  if (!regionText) throw new Error("Select or enter at least one region to blur or redact.");

  const outputFormat = normalizeFormat(stringOption(options.outputFormat, "png"));
  const quality = numberOption(options.quality, 0.9);
  const mode = stringOption(options.mode, "blur") === "redact" ? "redact" : "blur";
  const results: ToolResult[] = [];

  for (const [index, file] of files.entries()) {
    setProgress(context, `${mode === "blur" ? "Blurring" : "Redacting"} image ${index + 1} of ${files.length}`);
    const canvas = await imageFileToCanvas(file, "#ffffff");
    const regions = parseRegionList(regionText, canvas.width, canvas.height);
    const output = blurOrRedactRegions(canvas, regions, {
      mode,
      blur: numberOption(options.blurAmount, 14),
      color: stringOption(options.redactColor, "#111111")
    });
    results.push(await resultFromCanvas(file.name, mode, output, outputFormat, quality, `${mode === "blur" ? "Blurred" : "Redacted"} ${regions.length} region${regions.length === 1 ? "" : "s"}.`));
  }

  return results;
};

export const imageToolAccepts = IMAGE_ACCEPTS;

function requireImages(files: File[]): void {
  if (files.length === 0) throw new Error("Add one or more images.");
  const unsupported = files.find((file) => !supportsBrowserImage(file));
  if (unsupported) {
    throw new Error(`"${unsupported.name}" is not a browser-supported image. Use JPG, PNG, WebP, or GIF.`);
  }
}

function regionFromOptions(width: number, height: number, options: ToolOptions) {
  const selected = stringOption(options.cropRegion, "").trim();
  if (selected) return parseRegion(selected, width, height);

  return parseRegion(
    [
      numberOption(options.x, 0),
      numberOption(options.y, 0),
      numberOption(options.cropWidth, Math.round(width / 2)),
      numberOption(options.cropHeight, Math.round(height / 2))
    ].join(","),
    width,
    height
  );
}

function normalizeFormat(value: string): "png" | "jpeg" | "webp" | "gif" {
  if (value === "jpg" || value === "jpeg") return "jpeg";
  if (value === "webp") return "webp";
  if (value === "gif") return "gif";
  return "png";
}

function normalizeFit(value: string) {
  if (value === "contain" || value === "cover" || value === "stretch" || value === "inside") return value;
  return "inside";
}

export function resolveCompressionOptions(options: ToolOptions): NormalizedCompressionOptions {
  const preset = normalizePreset(stringOption(options.preset, "balanced"));
  const targetSizeKb = Math.max(0, Math.round(numberOption(options.targetSizeKb, 0)));

  return {
    output: normalizeCompressionOutput(stringOption(options.format, "auto")),
    preset,
    quality: preset === "custom" ? clamp(numberOption(options.quality, 0.82), JPEG_WEBP_MIN_QUALITY, 0.98) : compressionPresetQuality(preset),
    minQuality: compressionPresetMinQuality(preset),
    targetBytes: targetSizeKb > 0 ? targetSizeKb * 1024 : 0,
    maxWidth: Math.max(0, Math.round(numberOption(options.maxWidth, 0))),
    maxHeight: Math.max(0, Math.round(numberOption(options.maxHeight, 0))),
    reduceDimensions: targetSizeKb > 0 && booleanOption(options.reduceDimensions, true),
    neverUpscale: booleanOption(options.neverUpscale, true),
    backgroundColor: normalizeColor(stringOption(options.backgroundColor, "#ffffff")),
    skipLarger: booleanOption(options.skipLarger, true)
  };
}

export function compressionPresetQuality(preset: CompressionPreset): number {
  if (preset === "small") return 0.64;
  if (preset === "quality") return 0.92;
  return 0.82;
}

export function compressionOutputName(
  inputName: string,
  format: "png" | "jpeg" | "webp",
  skipped = false,
  originalExtension?: string
): string {
  const extension = skipped
    ? originalExtension || extensionFromName(inputName) || extensionForFormat(format)
    : extensionForFormat(format);
  return makeOutputName(inputName, skipped ? "kept-original" : "compressed", extension);
}

export function buildCompressionSummary(summary: CompressionSummary): string {
  if (summary.skipped) {
    const attempted = summary.attemptedBytes ? ` (${formatBytes(summary.attemptedBytes)})` : "";
    return [
      `Kept original ${formatBytes(summary.originalBytes)} file because the compressed output${attempted} would be larger.`,
      `Final ${summary.outputWidth}x${summary.outputHeight} original file.`,
      ...(summary.targetBytes > 0
        ? [summary.outputBytes <= summary.targetBytes ? `Target ${formatBytes(summary.targetBytes)} met by kept original.` : `Target ${formatBytes(summary.targetBytes)} not met by kept original.`]
        : []),
      "Turn off Skip larger output to export it anyway.",
      ...summary.notes
    ].join(" ");
  }

  const delta = summary.originalBytes - summary.outputBytes;
  const percent = summary.originalBytes > 0 ? Math.round((Math.abs(delta) / summary.originalBytes) * 100) : 0;
  const sizeText = delta >= 0
    ? `${formatBytes(summary.originalBytes)} -> ${formatBytes(summary.outputBytes)} (${percent}% smaller).`
    : `${formatBytes(summary.originalBytes)} -> ${formatBytes(summary.outputBytes)} (${percent}% larger).`;
  const parts = [
    sizeText,
    `Final ${summary.outputWidth}x${summary.outputHeight} ${formatLabel(summary.format)}.`
  ];

  if (summary.targetBytes > 0) {
    parts.push(summary.targetMet
      ? `Target ${formatBytes(summary.targetBytes)} met.`
      : `Target ${formatBytes(summary.targetBytes)} not met; closest honest output returned.`);
  }
  if (summary.quality && summary.format !== "png") {
    parts.push(`Quality ${summary.quality.toFixed(2)}.`);
  }
  parts.push(`Preset ${presetLabel(summary.preset)}.`);
  parts.push(...summary.notes);
  return parts.join(" ");
}

async function compressCanvas(
  canvas: HTMLCanvasElement,
  format: "png" | "jpeg" | "webp",
  options: NormalizedCompressionOptions,
  context?: ToolRunContext
): Promise<CompressionAttempt> {
  if (format === "png") return compressPng(canvas, options, context);
  return compressJpegOrWebp(canvas, format, options, context);
}

async function compressJpegOrWebp(
  canvas: HTMLCanvasElement,
  format: "jpeg" | "webp",
  options: NormalizedCompressionOptions,
  context?: ToolRunContext
): Promise<CompressionAttempt> {
  if (options.targetBytes <= 0) {
    return {
      blob: await exportCanvas(canvas, format, options.quality),
      format,
      width: canvas.width,
      height: canvas.height,
      quality: options.quality,
      notes: []
    };
  }

  let best = await exportQualitySearch(canvas, format, options.quality, options.minQuality, options.targetBytes);
  if (best.targetMet || !options.reduceDimensions) return best;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    context?.onProgress?.(`Trying smaller dimensions (${attempt}/8)`);
    const scaled = scaledDimensions(canvas.width, canvas.height, 0.86 ** attempt);
    if (scaled.width === best.width && scaled.height === best.height) break;

    const resized = await resizeCanvas(canvas, scaled.width, scaled.height);
    const candidate = await exportQualitySearch(resized, format, options.quality, options.minQuality, options.targetBytes);
    candidate.notes.unshift(`Reduced dimensions to ${candidate.width}x${candidate.height} for target size.`);
    best = pickTargetAttempt(best, candidate, options.targetBytes);
    if (best.targetMet) return best;

    if (scaled.width <= MIN_TARGET_DIMENSION || scaled.height <= MIN_TARGET_DIMENSION) break;
  }

  return best;
}

async function exportQualitySearch(
  canvas: HTMLCanvasElement,
  format: "jpeg" | "webp",
  startQuality: number,
  minQuality: number,
  targetBytes: number
): Promise<CompressionAttempt> {
  const highQuality = clamp(startQuality, minQuality, 0.98);
  const lowQuality = clamp(minQuality, JPEG_WEBP_MIN_QUALITY, highQuality);
  let best: CompressionAttempt = {
    blob: await exportCanvas(canvas, format, highQuality),
    format,
    width: canvas.width,
    height: canvas.height,
    quality: highQuality,
    targetMet: false,
    notes: []
  };

  const lowBlob = await exportCanvas(canvas, format, lowQuality);
  if (lowBlob.size < best.blob.size || lowBlob.size <= targetBytes) {
    best = { ...best, blob: lowBlob, quality: lowQuality, targetMet: lowBlob.size <= targetBytes };
  }
  if (best.blob.size <= targetBytes && highQuality === lowQuality) return best;

  let low = lowQuality;
  let high = highQuality;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const quality = (low + high) / 2;
    const blob = await exportCanvas(canvas, format, quality);

    if (blob.size <= targetBytes) {
      best = { ...best, blob, quality, targetMet: true };
      low = quality;
    } else {
      if (!best.targetMet && blob.size < best.blob.size) best = { ...best, blob, quality, targetMet: false };
      high = quality;
    }
  }

  return best;
}

async function compressPng(
  canvas: HTMLCanvasElement,
  options: NormalizedCompressionOptions,
  context?: ToolRunContext
): Promise<CompressionAttempt> {
  let best = await exportPngAtSize(canvas, options);
  if (best.targetMet || options.targetBytes <= 0 || !options.reduceDimensions) return best;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    context?.onProgress?.(`Trying smaller PNG dimensions (${attempt}/8)`);
    const scaled = scaledDimensions(canvas.width, canvas.height, 0.86 ** attempt);
    if (scaled.width === best.width && scaled.height === best.height) break;

    const resized = await resizeCanvas(canvas, scaled.width, scaled.height);
    const candidate = await exportPngAtSize(resized, options);
    candidate.notes.unshift(`Reduced dimensions to ${candidate.width}x${candidate.height} for target size.`);
    best = pickTargetAttempt(best, candidate, options.targetBytes);
    if (best.targetMet) return best;

    if (scaled.width <= MIN_TARGET_DIMENSION || scaled.height <= MIN_TARGET_DIMENSION) break;
  }

  return best;
}

async function exportPngAtSize(canvas: HTMLCanvasElement, options: NormalizedCompressionOptions): Promise<CompressionAttempt> {
  const losslessBlob = await exportCanvas(canvas, "png", 1);
  let best: CompressionAttempt = {
    blob: losslessBlob,
    format: "png",
    width: canvas.width,
    height: canvas.height,
    targetMet: options.targetBytes > 0 ? losslessBlob.size <= options.targetBytes : undefined,
    notes: []
  };

  if (options.preset !== "small" && options.targetBytes <= 0) return best;

  const colors = pngColorPlan(options);
  for (const colorCount of colors) {
    const blob = exportIndexedPngCanvas(canvas, colorCount);
    const candidate: CompressionAttempt = {
      blob,
      format: "png",
      width: canvas.width,
      height: canvas.height,
      targetMet: options.targetBytes > 0 ? blob.size <= options.targetBytes : undefined,
      notes: [`PNG color quantization used (${colorCount} colors).`]
    };

    if (options.targetBytes > 0) {
      best = pickTargetAttempt(best, candidate, options.targetBytes);
      if (best.targetMet) return best;
    } else if (candidate.blob.size < best.blob.size) {
      best = candidate;
    }
  }

  return best;
}

function pickTargetAttempt(current: CompressionAttempt, candidate: CompressionAttempt, targetBytes: number): CompressionAttempt {
  const currentMet = current.blob.size <= targetBytes;
  const candidateMet = candidate.blob.size <= targetBytes;

  if (candidateMet && !currentMet) return { ...candidate, targetMet: true };
  if (candidateMet && currentMet) {
    const currentPixels = current.width * current.height;
    const candidatePixels = candidate.width * candidate.height;
    if (candidatePixels > currentPixels) return { ...candidate, targetMet: true };
    if (candidatePixels === currentPixels && candidate.blob.size > current.blob.size) return { ...candidate, targetMet: true };
    return { ...current, targetMet: true };
  }
  if (!currentMet && candidate.blob.size < current.blob.size) return { ...candidate, targetMet: false };
  return { ...current, targetMet: currentMet };
}

function addBatchSummary(results: ToolResult[], totals: { originalBytes: number; outputBytes: number }): ToolResult[] {
  if (results.length < 2) return results;

  const delta = totals.originalBytes - totals.outputBytes;
  const percent = totals.originalBytes > 0 ? Math.round((Math.abs(delta) / totals.originalBytes) * 100) : 0;
  const batch = delta >= 0
    ? `Batch total: ${formatBytes(totals.originalBytes)} -> ${formatBytes(totals.outputBytes)} (${percent}% saved).`
    : `Batch total: ${formatBytes(totals.originalBytes)} -> ${formatBytes(totals.outputBytes)} (${percent}% larger after requested settings).`;

  return results.map((result, index) => index === 0
    ? { ...result, summary: `${result.summary ?? ""} ${batch}`.trim() }
    : result
  );
}

function pngColorPlan(options: NormalizedCompressionOptions): number[] {
  if (options.preset === "small") return [160, 96, 64, 32];
  if (options.targetBytes > 0) return [256, 192, 128, 96, 64, 32];
  return [];
}

function scaledDimensions(width: number, height: number, scale: number): { width: number; height: number } {
  const minScale = Math.min(1, Math.max(
    Math.min(width, MIN_TARGET_DIMENSION) / width,
    Math.min(height, MIN_TARGET_DIMENSION) / height
  ));
  const safeScale = Math.max(scale, minScale);

  return {
    width: Math.max(1, Math.round(width * safeScale)),
    height: Math.max(1, Math.round(height * safeScale))
  };
}

function resolveOutputFormat(file: File, setting: CompressImageOutput): "png" | "jpeg" | "webp" {
  if (setting !== "auto") return setting;
  if (/\.jpe?g$/i.test(file.name)) return "jpeg";
  if (/\.webp$/i.test(file.name)) return "webp";
  if (/\.png$/i.test(file.name) || /\.gif$/i.test(file.name)) return "png";
  return outputFormatFromMime(file.type);
}

function normalizeCompressionOutput(value: string): CompressImageOutput {
  if (value === "jpg" || value === "jpeg") return "jpeg";
  if (value === "png" || value === "webp") return value;
  return "auto";
}

function normalizePreset(value: string): CompressionPreset {
  if (value === "small" || value === "quality" || value === "custom") return value;
  return "balanced";
}

function compressionPresetMinQuality(preset: CompressionPreset): number {
  if (preset === "small") return 0.28;
  if (preset === "quality") return 0.68;
  return JPEG_WEBP_MIN_QUALITY;
}

function normalizeColor(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff";
}

function extensionForFormat(format: "png" | "jpeg" | "webp"): string {
  return format === "jpeg" ? "jpg" : format;
}

function extensionFromFile(file: File): string {
  const extension = extensionFromName(file.name);
  if (extension) return extension;
  return extensionForFormat(resolveOutputFormat(file, "auto"));
}

function extensionFromName(name: string): string | undefined {
  const match = name.match(/\.([a-z0-9]+)$/i);
  if (!match?.[1]) return undefined;
  return match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase();
}

function formatLabel(format: "png" | "jpeg" | "webp"): string {
  return format === "jpeg" ? "JPG" : format.toUpperCase();
}

function presetLabel(preset: CompressionPreset): string {
  if (preset === "small") return "Small file";
  if (preset === "quality") return "High quality";
  if (preset === "custom") return "Custom";
  return "Balanced";
}

function isGif(file: File): boolean {
  return /image\/gif/i.test(file.type) || /\.gif$/i.test(file.name);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function assertCanvasSize(width: number, height: number): void {
  if (width * height > MAX_SAFE_CANVAS_PIXELS) {
    throw new Error("This image is too large for safe in-browser processing on this device.");
  }
}

function setProgress(context: ToolRunContext | undefined, message: string): void {
  context?.onProgress?.(message);
}
