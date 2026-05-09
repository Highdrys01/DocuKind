import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  compressPdf,
  deletePagesPdf,
  extractPagesPdf,
  imagesToPdf,
  mergePdf,
  metadataPdf,
  pageNumbersPdf,
  rotatePdf,
  signPdf,
  splitPdf,
  watermarkPdf
} from "./processors";
import type { ToolResult } from "../types";
import { uint8ArrayToArrayBuffer } from "../utils/file";

describe("PDF processors", () => {
  it("merges PDFs", async () => {
    const one = await makePdf("one", 1);
    const two = await makePdf("two", 2);
    const [result] = await mergePdf([one, two], {});
    await expectPageCount(result, 3);
  });

  it("splits PDFs into one file per page", async () => {
    const file = await makePdf("split", 3);
    const results = await splitPdf([file], { splitMode: "every", ranges: "" });
    expect(results).toHaveLength(3);
    await expectPageCount(results[0], 1);
  });

  it("splits PDFs by range groups", async () => {
    const file = await makePdf("range", 4);
    const results = await splitPdf([file], { splitMode: "ranges", ranges: "1-2;4" });
    expect(results).toHaveLength(2);
    await expectPageCount(results[0], 2);
    await expectPageCount(results[1], 1);
  });

  it("rotates selected pages", async () => {
    const file = await makePdf("rotate", 2);
    const [result] = await rotatePdf([file], { angle: "90", pages: "1" });
    const doc = await loadResult(result);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
    expect(doc.getPage(1).getRotation().angle).toBe(0);
  });

  it("deletes pages", async () => {
    const file = await makePdf("delete", 4);
    const [result] = await deletePagesPdf([file], { pages: "2-3" });
    await expectPageCount(result, 2);
  });

  it("extracts pages", async () => {
    const file = await makePdf("extract", 4);
    const [result] = await extractPagesPdf([file], { pages: "2,4" });
    await expectPageCount(result, 2);
  });

  it("creates a PDF from images", async () => {
    const image = new File([uint8ArrayToArrayBuffer(pngBytes())], "pixel.png", { type: "image/png" });
    const [result] = await imagesToPdf([image], { pageSize: "auto", fit: "contain", margin: 0 });
    await expectPageCount(result, 1);
  });

  it("adds watermark, numbers, signature, and metadata without changing page count", async () => {
    const file = await makePdf("decorate", 2);
    await expectPageCount((await watermarkPdf([file], { text: "DRAFT", pages: "all", size: 20 }))[0], 2);
    await expectPageCount((await pageNumbersPdf([file], { pages: "all", startAt: 1 }))[0], 2);
    await expectPageCount((await signPdf([file], { signatureText: "Ada", pages: "2" }))[0], 2);
    await expectPageCount((await metadataPdf([file], { mode: "clear" }))[0], 2);
  });

  it("losslessly rebuilds for basic compression", async () => {
    const file = await makePdf("compress", 2);
    const [result] = await compressPdf([file], { mode: "lossless", removeMetadata: true });
    await expectPageCount(result, 2);
    expect(result.summary).toContain("Lossless rebuild");
  });
});

async function makePdf(name: string, pageCount: number): Promise<File> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let index = 0; index < pageCount; index += 1) {
    const page = doc.addPage([320, 220]);
    page.drawText(`${name} page ${index + 1}`, { x: 40, y: 120, size: 22, font });
  }

  return new File([uint8ArrayToArrayBuffer(await doc.save())], `${name}.pdf`, { type: "application/pdf" });
}

async function loadResult(result: ToolResult): Promise<PDFDocument> {
  return PDFDocument.load(new Uint8Array(await result.blob.arrayBuffer()));
}

async function expectPageCount(result: ToolResult, pages: number): Promise<void> {
  const doc = await loadResult(result);
  expect(doc.getPageCount()).toBe(pages);
}

function pngBytes(): Uint8Array {
  return Uint8Array.from(
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64")
  );
}
