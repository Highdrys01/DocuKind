import { describe, expect, it } from "vitest";
import { tools } from "./registry";

describe("tool registry suites", () => {
  it("separates PDF and image suites", () => {
    const pdfTools = tools.filter((tool) => tool.suite === "pdf");
    const imageTools = tools.filter((tool) => tool.suite === "image");

    expect(pdfTools.map((tool) => tool.id)).toContain("sign-pdf");
    expect(pdfTools.map((tool) => tool.id)).toContain("certified-signature-local");
    expect(imageTools.map((tool) => tool.id)).toContain("compress-image");
    expect(imageTools.map((tool) => tool.id)).not.toContain("merge-pdf");
    expect(pdfTools.map((tool) => tool.id)).not.toContain("resize-image");
  });

  it("keeps local PDF conversion packs in the PDF suite", () => {
    const localPdfTools = tools.filter((tool) => tool.kind === "local" && tool.suite === "pdf").map((tool) => tool.id);
    expect(localPdfTools).toEqual(expect.arrayContaining([
      "pdf-to-word",
      "word-to-pdf",
      "powerpoint-to-pdf",
      "excel-to-pdf",
      "certified-signature-local"
    ]));
  });

  it("shows lossy quality controls only for JPG and WebP image outputs", () => {
    const resizeTool = tools.find((tool) => tool.id === "resize-image");
    const quality = resizeTool?.options.find((option) => option.name === "quality");

    expect(quality?.showWhen?.({ outputFormat: "png" })).toBe(false);
    expect(quality?.showWhen?.({ outputFormat: "jpeg" })).toBe(true);
    expect(quality?.showWhen?.({ outputFormat: "webp" })).toBe(true);

    const convertFromJpg = tools.find((tool) => tool.id === "convert-from-jpg");
    const convertQuality = convertFromJpg?.options.find((option) => option.name === "quality");
    expect(convertQuality?.showWhen?.({ outputFormat: "png" })).toBe(false);
    expect(convertQuality?.showWhen?.({ outputFormat: "gif" })).toBe(false);
    expect(convertQuality?.showWhen?.({ outputFormat: "jpeg" })).toBe(true);
  });

  it("defaults blur/redact image to redaction", () => {
    const blurRedact = tools.find((tool) => tool.id === "blur-redact-image");
    const mode = blurRedact?.options.find((option) => option.name === "mode");

    expect(mode?.defaultValue).toBe("redact");
    expect(mode && "choices" in mode ? mode.choices[0].value : undefined).toBe("redact");
  });
});
