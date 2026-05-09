import { describe, expect, it } from "vitest";
import {
  buildCompressionSummary,
  compressionOutputName,
  compressionPresetQuality,
  resolveCompressionOptions
} from "./imageProcessors";

describe("compress image option normalization", () => {
  it("uses production defaults", () => {
    const options = resolveCompressionOptions({});

    expect(options.output).toBe("auto");
    expect(options.preset).toBe("balanced");
    expect(options.quality).toBeCloseTo(0.82);
    expect(options.targetBytes).toBe(0);
    expect(options.reduceDimensions).toBe(false);
    expect(options.neverUpscale).toBe(true);
    expect(options.skipLarger).toBe(true);
  });

  it("enables dimension reduction only when a target is set", () => {
    const options = resolveCompressionOptions({ targetSizeKb: 24 });

    expect(options.targetBytes).toBe(24 * 1024);
    expect(options.reduceDimensions).toBe(true);
  });

  it("clamps custom quality and validates color values", () => {
    const options = resolveCompressionOptions({
      format: "jpg",
      preset: "custom",
      quality: 1.4,
      backgroundColor: "white",
      skipLarger: false
    });

    expect(options.output).toBe("jpeg");
    expect(options.quality).toBe(0.98);
    expect(options.backgroundColor).toBe("#ffffff");
    expect(options.skipLarger).toBe(false);
  });
});

describe("compress image labels and summaries", () => {
  it("uses preset quality defaults", () => {
    expect(compressionPresetQuality("small")).toBeCloseTo(0.64);
    expect(compressionPresetQuality("balanced")).toBeCloseTo(0.82);
    expect(compressionPresetQuality("quality")).toBeCloseTo(0.92);
  });

  it("generates safe output filenames", () => {
    expect(compressionOutputName("My File.PNG", "jpeg")).toBe("My-File-compressed.jpg");
    expect(compressionOutputName("scan.jpeg", "png", true)).toBe("scan-kept-original.jpg");
  });

  it("describes target success with dimensions and format", () => {
    const summary = buildCompressionSummary({
      originalBytes: 20 * 1024,
      outputBytes: 8 * 1024,
      originalWidth: 1200,
      originalHeight: 800,
      outputWidth: 900,
      outputHeight: 600,
      format: "webp",
      preset: "balanced",
      targetBytes: 10 * 1024,
      targetMet: true,
      quality: 0.74,
      skipped: false,
      notes: ["Transparency preserved."]
    });

    expect(summary).toContain("20 KB -> 8.0 KB");
    expect(summary).toContain("Final 900x600 WEBP");
    expect(summary).toContain("Target 10 KB met");
    expect(summary).toContain("Quality 0.74");
    expect(summary).toContain("Transparency preserved");
  });

  it("explains skipped larger outputs", () => {
    const summary = buildCompressionSummary({
      originalBytes: 4 * 1024,
      outputBytes: 4 * 1024,
      originalWidth: 300,
      originalHeight: 200,
      outputWidth: 300,
      outputHeight: 200,
      format: "jpeg",
      preset: "quality",
      targetBytes: 0,
      skipped: true,
      attemptedBytes: 6 * 1024,
      notes: []
    });

    expect(summary).toContain("Kept original 4.0 KB");
    expect(summary).toContain("compressed output (6.0 KB) would be larger");
    expect(summary).toContain("Skip larger output");
  });
});
