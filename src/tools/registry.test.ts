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
});
