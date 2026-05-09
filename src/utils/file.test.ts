import { describe, expect, it } from "vitest";
import { formatBytes, makeOutputName, normalizeFilename } from "./file";

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
});
