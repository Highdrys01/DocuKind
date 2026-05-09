import { describe, expect, it } from "vitest";
import { acceptsFile, dedupeFiles, formatBytes, makeOutputName, normalizeFilename } from "./file";

describe("file helpers", () => {
  it("normalizes filenames", () => {
    expect(normalizeFilename(" My Invoice (Final).pdf ")).toBe("My-Invoice-Final");
  });

  it("creates output names", () => {
    expect(makeOutputName("contract.v2.pdf", "signed")).toBe("contract.v2-signed.pdf");
  });

  it("formats byte counts", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("checks accepted file types by extension and MIME", () => {
    const pdf = new File(["x"], "report.pdf", { type: "application/pdf" });
    const png = new File(["x"], "image.png", { type: "image/png" });

    expect(acceptsFile(pdf, "application/pdf,.pdf")).toBe(true);
    expect(acceptsFile(png, "application/pdf,.pdf")).toBe(false);
    expect(acceptsFile(png, "image/*")).toBe(true);
  });

  it("deduplicates repeated selected files", () => {
    const first = new File(["x"], "same.pdf", { type: "application/pdf", lastModified: 1 });
    const second = new File(["x"], "same.pdf", { type: "application/pdf", lastModified: 1 });

    expect(dedupeFiles([first, second])).toHaveLength(1);
  });
});
