import type { ToolOptions, ToolProcessor, ToolResult, ToolRunContext } from "../types";
import {
  IMAGE_ACCEPTS,
  blurOrRedactRegions,
  calculateResize,
  compressionSummary,
  cropCanvas,
  drawMemeText,
  drawTextWatermark,
  encodeGifFromCanvases,
  exportCanvas,
  imageFileToCanvas,
  outputFormatFromMime,
  parseRegion,
  parseRegionList,
  resizeCanvas,
  resultFromCanvas,
  supportsBrowserImage,
  transformCanvas
} from "../utils/image";
import { makeOutputName, resultFromBlob } from "../utils/file";
import { booleanOption, numberOption, stringOption } from "../utils/pdf";

const MAX_SAFE_CANVAS_PIXELS = 32_000_000;

export const compressImage: ToolProcessor = async (files, options, context) => {
  requireImages(files);

  const formatSetting = stringOption(options.format, "auto");
  const quality = numberOption(options.quality, 0.82);
  const targetSizeKb = numberOption(options.targetSizeKb, 0);
  const maxWidth = numberOption(options.maxWidth, 0);
  const maxHeight = numberOption(options.maxHeight, 0);
  const results: ToolResult[] = [];

  for (const [index, file] of files.entries()) {
    setProgress(context, `Compressing image ${index + 1} of ${files.length}`);
    let canvas = await imageFileToCanvas(file, "#ffffff");
    assertCanvasSize(canvas.width, canvas.height);

    if (maxWidth > 0 || maxHeight > 0) {
      const resized = calculateResize(canvas.width, canvas.height, {
        mode: "pixels",
        width: maxWidth || canvas.width,
        height: maxHeight || canvas.height,
        fit: "inside"
      });
      canvas = await resizeCanvas(canvas, resized.width, resized.height);
    }

    const format = formatSetting === "auto" ? outputFormatFromMime(file.type) : normalizeFormat(formatSetting);
    const result = await compressedResult(file, canvas, format, quality, targetSizeKb);
    results.push(result);
  }

  return results;
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

async function compressedResult(
  file: File,
  canvas: HTMLCanvasElement,
  format: "png" | "jpeg" | "webp" | "gif",
  quality: number,
  targetSizeKb: number
): Promise<ToolResult> {
  const targetBytes = Math.max(0, targetSizeKb) * 1024;
  let blob = await exportCanvas(canvas, format, quality);
  let summary = compressionSummary(file.size, blob.size);

  if (targetBytes > 0 && (format === "jpeg" || format === "webp")) {
    const compressed = await exportToTargetSize(canvas, format, quality, targetBytes);
    blob = compressed.blob;
    const targetText = blob.size <= targetBytes
      ? ` Target met at quality ${compressed.quality.toFixed(2)}.`
      : ` Closest output is above target at quality ${compressed.quality.toFixed(2)}.`;
    summary = `${compressionSummary(file.size, blob.size)}${targetText}`;
  } else if (targetBytes > 0) {
    summary = `${summary} Target size is only applied to JPG or WebP output.`;
  }

  const extension = format === "jpeg" ? "jpg" : format;
  return resultFromBlob(makeOutputName(file.name, "compressed", extension), blob, summary);
}

async function exportToTargetSize(
  canvas: HTMLCanvasElement,
  format: "jpeg" | "webp",
  startQuality: number,
  targetBytes: number
): Promise<{ blob: Blob; quality: number }> {
  let low = 0.2;
  let high = Math.min(Math.max(startQuality, low), 0.98);
  let best = {
    blob: await exportCanvas(canvas, format, high),
    quality: high
  };
  if (best.blob.size <= targetBytes) return best;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const quality = (low + high) / 2;
    const blob = await exportCanvas(canvas, format, quality);

    if (blob.size <= targetBytes) {
      best = { blob, quality };
      low = quality;
    } else {
      high = quality;
      if (blob.size < best.blob.size) best = { blob, quality };
    }
  }

  return best;
}

function assertCanvasSize(width: number, height: number): void {
  if (width * height > MAX_SAFE_CANVAS_PIXELS) {
    throw new Error("This image is too large for safe in-browser processing on this device.");
  }
}

function setProgress(context: ToolRunContext | undefined, message: string): void {
  context?.onProgress?.(message);
}
