import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  excelToPdfLocalPack,
  pdfToWordLocalPack,
  powerpointToPdfLocalPack,
  wordToPdfLocalPack
} from "./localToolProcessors";

describe("local tool packs", () => {
  it("creates a PDF to Word pack with setup scripts and privacy notes", async () => {
    const [result] = await pdfToWordLocalPack([], {});
    expect(result.filename).toBe("docukind-pdf-to-word-local.zip");
    expect(result.blob.type).toBe("application/zip");

    const zip = await loadZip(result.blob);
    expect(zip.file("README.md")).toBeTruthy();
    expect(zip.file("requirements.txt")).toBeTruthy();
    expect(zip.file("convert_pdf_to_word.py")).toBeTruthy();
    expect(zip.file("run-mac-linux.sh")).toBeTruthy();
    expect(zip.file("run-windows.bat")).toBeTruthy();

    await expectFileContains(zip, "requirements.txt", "pdf2docx");
    await expectFileContains(zip, "README.md", "files stay on your machine");
  });

  it("creates LibreOffice-based Office to PDF packs for specific tools", async () => {
    const packs = await Promise.all([
      wordToPdfLocalPack([], {}),
      powerpointToPdfLocalPack([], {}),
      excelToPdfLocalPack([], {})
    ]);

    const filenames = packs.map(([result]) => result.filename);
    expect(filenames).toEqual([
      "docukind-word-to-pdf-local.zip",
      "docukind-powerpoint-to-pdf-local.zip",
      "docukind-excel-to-pdf-local.zip"
    ]);

    for (const [result] of packs) {
      const zip = await loadZip(result.blob);
      expect(zip.file("README.md")).toBeTruthy();
      expect(zip.file("convert_office_to_pdf.py")).toBeTruthy();
      expect(zip.file("run-mac-linux.sh")).toBeTruthy();
      expect(zip.file("run-windows.bat")).toBeTruthy();
      await expectFileContains(zip, "convert_office_to_pdf.py", "LibreOffice");
      await expectFileContains(zip, "README.md", "runs locally");
    }
  });
});

async function expectFileContains(zip: JSZip, path: string, expected: string): Promise<void> {
  const file = zip.file(path);
  expect(file).toBeTruthy();
  expect(await file!.async("text")).toContain(expected);
}

async function loadZip(blob: Blob): Promise<JSZip> {
  return JSZip.loadAsync(await blob.arrayBuffer());
}
