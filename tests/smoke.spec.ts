import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";

test("renders the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /PDF tools/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Merge PDF/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Resize Image/ })).toHaveCount(0);
  const pdfAccent = await page.locator(".suite-link.active").evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.getByRole("button", { name: /Image Tools/ }).click();
  await expect(page.getByRole("heading", { name: /Image tools/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Resize Image/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Merge PDF/ })).toHaveCount(0);
  const imageAccent = await page.locator(".suite-link.active").evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(imageAccent).not.toBe(pdfAccent);
});

test("prepares local converter packs without upload inputs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /PDF to Word/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Word to PDF/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Certified Digital Signature/ })).toBeVisible();

  await page.getByRole("button", { name: /PDF to Word/ }).click();
  await expect(page.getByRole("heading", { name: "PDF to Word" })).toBeVisible();
  await expect(page.getByTestId("file-input")).toHaveCount(0);
  await expect(page.getByText(/Download a local tool pack/)).toBeVisible();
  await page.getByRole("button", { name: /Prepare PDF to Word Pack/ }).click();
  await expect(page.getByText("docukind-pdf-to-word-local.zip")).toBeVisible();

  const pdfToWordZip = await JSZip.loadAsync(await readFile(await downloadFirst(page)));
  expect(pdfToWordZip.file("convert_pdf_to_word.py")).toBeTruthy();
  expect(await pdfToWordZip.file("requirements.txt")!.async("text")).toContain("pdf2docx==0.5.12");

  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: /Word to PDF/ }).click();
  await page.getByRole("button", { name: /Prepare Word to PDF Pack/ }).click();
  await expect(page.getByText("docukind-word-to-pdf-local.zip")).toBeVisible();

  const wordToPdfZip = await JSZip.loadAsync(await readFile(await downloadFirst(page)));
  expect(wordToPdfZip.file("convert_office_to_pdf.py")).toBeTruthy();
  expect(await wordToPdfZip.file("README.md")!.async("text")).toContain("LibreOffice");

  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await clickTool(page, /Certified Digital Signature/);
  await page.getByRole("button", { name: /Prepare Certified Digital Signature/ }).click();
  await expect(page.getByText("docukind-certified-signature-local.zip")).toBeVisible();
  const certZip = await JSZip.loadAsync(await readFile(await downloadFirst(page)));
  expect(certZip.file("certify_sign_pdf.py")).toBeTruthy();
  expect(await certZip.file("README.md")!.async("text")).toContain("DocuKind does not claim");
});

test("renders uploaded PDF thumbnails and runs merge", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Merge PDF/ }).click();
  await expect(page.getByRole("heading", { name: "Merge PDF" })).toBeVisible();

  const first = await makePdf("first", [360, 240]);
  const second = await makePdf("second", [240, 360]);
  await page.getByTestId("file-input").setInputFiles([
    { name: "first.pdf", mimeType: "application/pdf", buffer: Buffer.from(first) },
    { name: "second.pdf", mimeType: "application/pdf", buffer: Buffer.from(second) }
  ]);

  const canvas = page.locator("canvas.merge-thumbnail-canvas").first();
  await expect(canvas).toBeVisible();
  await expect.poll(async () => {
    return canvas.evaluate((element) => {
      const target = element as HTMLCanvasElement;
      const context = target.getContext("2d");
      if (!context) return false;
      const data = context.getImageData(0, 0, target.width, target.height).data;
      for (let index = 0; index < data.length; index += 4) {
        if (data[index] < 245 || data[index + 1] < 245 || data[index + 2] < 245) return true;
      }
      return false;
    });
  }).toBe(true);

  await page.getByRole("button", { name: /Move second.pdf up/ }).click();
  await page.getByLabel("Filename").fill("merged smoke");
  await page.getByLabel("Add blank page between PDFs").check();
  await page.getByRole("button", { name: /^Merge PDFs$/ }).click();
  await expect(page.getByText("merged-smoke.pdf")).toBeVisible();

  const mergedPdf = await PDFDocument.load(await readFile(await downloadFirst(page)));
  expect(mergedPdf.getPageCount()).toBe(3);
  expect(mergedPdf.getPage(0).getSize()).toMatchObject({ width: 240, height: 360 });
  expect(mergedPdf.getPage(1).getSize()).toMatchObject({ width: 240, height: 360 });
  expect(mergedPdf.getPage(2).getSize()).toMatchObject({ width: 360, height: 240 });
});

test("uses visual page workspace for extract, delete, organize, and rotate", async ({ page }) => {
  test.setTimeout(70_000);
  await page.goto("/");
  const source = await makeMultiPagePdf([
    ["one", [300, 220]],
    ["two", [340, 260]],
    ["three", [380, 300]]
  ]);

  await clickTool(page, /Extract Pages/);
  await page.getByTestId("file-input").setInputFiles({ name: "pages.pdf", mimeType: "application/pdf", buffer: Buffer.from(source) });
  await waitForPageThumbnail(page);
  await expect.poll(async () => page.locator("canvas.page-thumbnail-canvas").first().evaluate(isCanvasNonBlank)).toBe(true);
  await page.getByLabel("Select pages by range").fill("2-3");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("2-3").first()).toBeVisible();
  await page.getByRole("button", { name: /Extract Selected Pages/ }).click();
  await expect(page.getByText("pages-pages-2-3.pdf")).toBeVisible();
  const extracted = await PDFDocument.load(await readFile(await downloadFirst(page)));
  expect(extracted.getPageCount()).toBe(2);
  expect(extracted.getPage(0).getSize()).toMatchObject({ width: 340, height: 260 });
  expect(extracted.getPage(1).getSize()).toMatchObject({ width: 380, height: 300 });

  await page.goto("/");
  await clickTool(page, /Delete Pages/);
  await page.getByTestId("file-input").setInputFiles({ name: "pages.pdf", mimeType: "application/pdf", buffer: Buffer.from(source) });
  await waitForPageThumbnail(page);
  await page.getByLabel("Select pages by range").fill("2");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator(".page-delete-overlay")).toHaveCount(1);
  await page.getByRole("button", { name: /Remove Selected Pages/ }).click();
  await expect(page.getByText("pages-pages-removed.pdf")).toBeVisible();
  const deleted = await PDFDocument.load(await readFile(await downloadFirst(page)));
  expect(deleted.getPageCount()).toBe(2);
  expect(deleted.getPage(1).getSize()).toMatchObject({ width: 380, height: 300 });

  await page.goto("/");
  await clickTool(page, /Organize Pages/);
  await page.getByTestId("file-input").setInputFiles({ name: "pages.pdf", mimeType: "application/pdf", buffer: Buffer.from(source) });
  await waitForPageThumbnail(page);
  await page.getByRole("button", { name: /Page 2/ }).click();
  await page.getByRole("button", { name: /Remove selected/ }).click();
  await expect(page.locator(".page-delete-overlay")).toHaveCount(1);
  await page.getByRole("button", { name: /Page 2/ }).click();
  await page.getByRole("button", { name: /Restore selected/ }).click();
  await expect(page.locator(".page-delete-overlay")).toHaveCount(0);
  await page.getByRole("button", { name: /Page 3/ }).click();
  await page.getByRole("button", { name: /Move up/ }).click();
  await page.getByRole("button", { name: /Move up/ }).click();
  await page.getByRole("button", { name: /Rotate right/ }).click();
  await page.getByRole("button", { name: /^Organize PDF$/ }).click();
  await expect(page.getByText("pages-organized.pdf")).toBeVisible();
  const organized = await PDFDocument.load(await readFile(await downloadFirst(page)));
  expect(organized.getPageCount()).toBe(3);
  expect(organized.getPage(0).getSize()).toMatchObject({ width: 380, height: 300 });
  expect(organized.getPage(0).getRotation().angle).toBe(90);

  await page.goto("/");
  await clickTool(page, /Rotate PDF/);
  await page.getByTestId("file-input").setInputFiles({ name: "pages.pdf", mimeType: "application/pdf", buffer: Buffer.from(source) });
  await waitForPageThumbnail(page);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.getByRole("button", { name: /Page 1/ }).click();
  await page.getByRole("button", { name: /Rotate Selected Pages/ }).click();
  await expect(page.getByText("pages-rotated-90.pdf")).toBeVisible();
  const rotated = await PDFDocument.load(await readFile(await downloadFirst(page)));
  expect(rotated.getPage(0).getRotation().angle).toBe(90);
  expect(rotated.getPage(1).getRotation().angle).toBe(0);
});

test("compresses PDFs honestly when rebuilds would be larger", async ({ page }) => {
  await page.goto("/");
  await clickTool(page, /Compress PDF/);
  await expect(page.getByRole("heading", { name: "Compress PDF" })).toBeVisible();

  const tiny = Buffer.from(minimalPdfBytes());
  await page.getByTestId("file-input").setInputFiles({ name: "tiny.pdf", mimeType: "application/pdf", buffer: tiny });
  await page.getByRole("button", { name: /Run Compress PDF/ }).click();
  await expect(page.getByText("tiny-kept-original.pdf")).toBeVisible();
  await expect(page.getByText(/kept original/)).toBeVisible();
  const kept = await readFile(await downloadFirst(page));
  expect(kept.byteLength).toBe(tiny.byteLength);

  await page.getByLabel("Skip larger output").uncheck();
  await page.getByRole("button", { name: /Run Compress PDF/ }).click();
  await expect(page.getByText("tiny-compressed.pdf")).toBeVisible();
  const forced = await readFile(await downloadFirst(page));
  expect(forced.byteLength).toBeGreaterThan(tiny.byteLength);
});

test("places and exports a visual PDF signature", async ({ page, isMobile }) => {
  await page.goto("/");
  await clickTool(page, /Sign PDF/);
  await expect(page.getByRole("heading", { name: "Sign PDF" })).toBeVisible();

  const source = await makeMultiPagePdf([
    ["sign-source-one", [360, 240]],
    ["sign-source-two", [220, 160]]
  ]);
  await page.getByTestId("file-input").setInputFiles({ name: "sign-source.pdf", mimeType: "application/pdf", buffer: Buffer.from(source) });
  const canvas = page.locator("canvas.signature-page-canvas").first();
  await expect(canvas).toBeVisible();
  await expect.poll(async () => canvas.evaluate(isCanvasNonBlank)).toBe(true);
  await expect(page.getByText(/Click the document to place it/)).toBeVisible();
  const pageJump = page.getByLabel("Go to page");
  await pageJump.fill("2");
  await expect(pageJump).toHaveValue("2");
  await expect.poll(async () => canvas.evaluate(isCanvasNonBlank)).toBe(true);
  await pageJump.fill("1");
  await expect(pageJump).toHaveValue("1");
  await expect.poll(async () => canvas.evaluate(isCanvasNonBlank)).toBe(true);

  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Initials").fill("AL");
  await page.getByLabel("Custom text").fill("Approved locally");
  await page.getByRole("button", { name: "Draw" }).click();
  const drawCanvas = page.locator(".draw-pad canvas");
  const drawBox = await drawCanvas.boundingBox();
  if (!drawBox) throw new Error("Draw pad did not have a bounding box.");
  await page.mouse.move(drawBox.x + 12, drawBox.y + drawBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(drawBox.x + drawBox.width - 12, drawBox.y + drawBox.height / 2);
  await page.mouse.up();
  await expect.poll(async () => drawCanvas.evaluate(canvasHasInk)).toBe(true);
  await page.getByRole("button", { name: "Use color #e23a3a" }).click();
  await expect.poll(async () => drawCanvas.evaluate(canvasHasInk)).toBe(true);
  await page.getByRole("button", { name: "Upload" }).click();
  await page.locator(".upload-inline input").setInputFiles({
    name: "signature.png",
    mimeType: "application/octet-stream",
    buffer: await makePngFixture(page, 64, 24)
  });
  await expect(page.getByText("Signature image ready")).toBeVisible();
  if (isMobile) {
    await chooseAndPlaceField(page, "signature", 0.32, 0.72);
    await page.getByRole("button", { name: "Type" }).click();
    await chooseAndPlaceField(page, "name", 0.58, 0.72);
    await chooseAndPlaceField(page, "date", 0.58, 0.84);
    await chooseAndPlaceField(page, "text", 0.36, 0.84);
  } else {
    await dragPaletteFieldToPreview(page, "signature", 0.32, 0.72);
    await page.getByRole("button", { name: "Type" }).click();
    await dragPaletteFieldToPreview(page, "name", 0.58, 0.72);
    await dragPaletteFieldToPreview(page, "date", 0.58, 0.84);
    await dragPaletteFieldToPreview(page, "text", 0.36, 0.84);
  }
  await page.getByTestId("palette-initials").click();
  await expect(page.locator(".signature-placement-help")).toContainText("Initials");
  await placeFieldOnPreview(page, 0.72, 0.72);
  await expect(page.locator(".signature-field-box")).toHaveCount(5);
  const dateLabelBox = await page.locator('.signature-field-box[data-kind="date"] .signature-field-label').first().boundingBox();
  const dateContentBox = await page.locator('.signature-field-box[data-kind="date"] .signature-field-content').first().boundingBox();
  if (!dateLabelBox || !dateContentBox) throw new Error("Date field label/content did not render.");
  expect(dateLabelBox.y + dateLabelBox.height).toBeLessThanOrEqual(dateContentBox.y + 1);
  await page.locator('.signature-field-box[data-kind="initials"]').click();
  await page.getByRole("button", { name: "Duplicate Initials field" }).click();
  await expect(page.locator(".signature-field-box")).toHaveCount(6);
  await page.getByRole("button", { name: "Delete Initials field" }).click();
  await expect(page.locator(".signature-field-box")).toHaveCount(5);

  const field = page.locator(".signature-field-box").first();
  const fieldBox = await field.boundingBox();
  if (!fieldBox) throw new Error("Signature field did not have a bounding box.");
  await page.mouse.move(fieldBox.x + fieldBox.width / 2, fieldBox.y + fieldBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(fieldBox.x + fieldBox.width / 2 + 42, fieldBox.y + fieldBox.height / 2 - 18);
  await page.mouse.up();
  const movedBox = await field.boundingBox();
  if (!movedBox) throw new Error("Moved signature field did not have a bounding box.");
  await page.mouse.move(movedBox.x + movedBox.width - 2, movedBox.y + movedBox.height - 2);
  await page.mouse.down();
  await page.mouse.move(movedBox.x + movedBox.width + 24, movedBox.y + movedBox.height + 12);
  await page.mouse.up();
  await page.getByRole("heading", { name: "Selected Field" }).scrollIntoViewIfNeeded();
  await clickCenterVerifiedButton(page, "Copy");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator(".signature-field-box")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Selected Field" })).toBeHidden();

  await page.getByRole("button", { name: /^Sign PDF$/ }).click();
  await expect(page.getByText("sign-source-signed.pdf")).toBeVisible();

  const signedPdf = await readFile(await downloadFirst(page));
  const signedDoc = await PDFDocument.load(signedPdf);
  expect(signedDoc.getPageCount()).toBe(2);
});

test("resizes and crops images with downloadable outputs", async ({ page }) => {
  await page.goto("/");
  const image = await makePngFixture(page, 160, 100);

  await page.getByRole("button", { name: /Image Tools/ }).click();
  await page.getByRole("button", { name: /Resize Image/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await page.getByLabel("Width").fill("80");
  await page.getByLabel("Height").fill("40");
  await page.getByLabel("Fit").selectOption("stretch");
  await page.getByRole("button", { name: /Run Resize Image/ }).click();
  await expect(page.getByText("fixture-80x40.png")).toBeVisible();

  const resized = await downloadFirst(page);
  expect(readPngSize(await readFile(resized))).toEqual({ width: 80, height: 40 });

  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: /Image Tools/ }).click();
  await page.getByRole("button", { name: /Crop Image/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "fixture.png", mimeType: "application/octet-stream", buffer: image });
  await expect(page.locator(".region-box").first()).toBeVisible();
  await page.locator(".region-canvas").scrollIntoViewIfNeeded();
  const regionInputs = page.locator(".region-details input");
  const defaultCrop = await regionInputs.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value).join(","));
  const cropBox = await page.locator(".region-box").first().boundingBox();
  if (!cropBox) throw new Error("Crop region did not render.");
  await page.mouse.move(cropBox.x + cropBox.width / 2, cropBox.y + cropBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(cropBox.x + cropBox.width / 2 + 14, cropBox.y + cropBox.height / 2 + 8);
  await page.mouse.up();
  await expect.poll(async () => regionInputs.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value).join(","))).not.toBe(defaultCrop);
  await regionInputs.nth(0).fill("25");
  await regionInputs.nth(1).fill("20");
  await regionInputs.nth(2).fill("50");
  await regionInputs.nth(3).fill("50");
  await page.getByRole("button", { name: /Run Crop Image/ }).click();
  await expect(page.getByText("fixture-crop-80x50.png")).toBeVisible();

  const cropped = await downloadFirst(page);
  expect(readPngSize(await readFile(cropped))).toEqual({ width: 80, height: 50 });
  await page.getByLabel("Aspect").selectOption("1:1");
  await regionInputs.nth(3).fill("49");
  await expect.poll(async () => Number(await regionInputs.nth(2).inputValue())).toBeLessThan(40);
  await regionInputs.nth(3).fill("50");
  await expect.poll(async () => Number(await regionInputs.nth(3).inputValue())).toBe(50);
  await expect.poll(async () => Number(await regionInputs.nth(2).inputValue())).toBeGreaterThan(31);
  await expect.poll(async () => Number(await regionInputs.nth(2).inputValue())).toBeLessThan(33);
  await page.getByRole("button", { name: /Run Crop Image/ }).click();
  await expect(page.getByText("fixture-crop-50x50.png")).toBeVisible();
  const squareCropped = await downloadFirst(page);
  expect(readPngSize(await readFile(squareCropped))).toEqual({ width: 50, height: 50 });

  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: /Image Tools/ }).click();
  await page.getByRole("button", { name: /Compress Image/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await page.getByLabel("Output", { exact: true }).selectOption("jpeg");
  await page.getByLabel("Target KB").fill("5");
  await page.getByLabel("Skip larger output").uncheck();
  await page.getByRole("button", { name: /Run Compress Image/ }).click();
  await expect(page.getByText("fixture-compressed.jpg")).toBeVisible();

  const compressed = await readFile(await downloadFirst(page));
  expect(compressed[0]).toBe(0xff);
  expect(compressed[1]).toBe(0xd8);
  expect(compressed.byteLength).toBeLessThanOrEqual(5 * 1024);
});

test("compresses images with transparency, targets, resize bounds, and batch ZIP", async ({ page }) => {
  await page.goto("/");
  const transparent = await makeTransparentPngFixture(page, 120, 80);

  await page.getByRole("button", { name: /Image Tools/ }).click();
  await page.getByRole("button", { name: /Compress Image/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "transparent.png", mimeType: "image/png", buffer: transparent });
  await page.getByLabel("Output", { exact: true }).selectOption("png");
  await page.getByLabel("Skip larger output").uncheck();
  await page.getByRole("button", { name: /Run Compress Image/ }).click();
  await expect(page.getByText("transparent-compressed.png")).toBeVisible();
  await expect(page.getByText(/Transparency preserved/)).toBeVisible();

  const png = await readFile(await downloadFirst(page));
  const transparentPixel = await sampleImagePixel(page, png, 4, 4);
  expect(transparentPixel.a).toBe(0);

  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: /Image Tools/ }).click();
  await page.getByRole("button", { name: /Resize Image/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "transparent.png", mimeType: "image/png", buffer: transparent });
  await page.getByLabel("Width").fill("60");
  await page.getByLabel("Height").fill("40");
  await page.getByRole("button", { name: /Run Resize Image/ }).click();
  await expect(page.getByText("transparent-60x40.png")).toBeVisible();
  const resizedTransparent = await readFile(await downloadFirst(page));
  const resizedTransparentPixel = await sampleImagePixel(page, resizedTransparent, 2, 2);
  expect(resizedTransparentPixel.a).toBe(0);

  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: /Image Tools/ }).click();
  await page.getByRole("button", { name: /Compress Image/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "transparent.png", mimeType: "image/png", buffer: transparent });
  await page.getByLabel("Output", { exact: true }).selectOption("jpeg");
  await page.getByLabel("JPG background").fill("#00ff00");
  await page.getByLabel("Skip larger output").uncheck();
  await page.getByRole("button", { name: /Run Compress Image/ }).click();
  await expect(page.getByText("transparent-compressed.jpg")).toBeVisible();
  const jpg = await readFile(await downloadFirst(page));
  const flattenedPixel = await sampleImagePixel(page, jpg, 4, 4, "image/jpeg");
  expect(flattenedPixel.r).toBeLessThan(35);
  expect(flattenedPixel.g).toBeGreaterThan(210);
  expect(flattenedPixel.b).toBeLessThan(45);

  await page.getByLabel("Output", { exact: true }).selectOption("png");
  await page.getByLabel("Skip larger output").uncheck();
  await page.getByLabel("Max width").fill("300");
  await page.getByLabel("Max height").fill("300");
  await page.getByRole("button", { name: /Run Compress Image/ }).click();
  const bounded = await readFile(await downloadFirst(page));
  expect(readPngSize(bounded)).toEqual({ width: 120, height: 80 });

  const first = await makePngFixture(page, 220, 140);
  const second = await makePngFixture(page, 180, 120);
  await page.getByTestId("file-input").setInputFiles([
    { name: "first.png", mimeType: "image/png", buffer: first },
    { name: "second.png", mimeType: "image/png", buffer: second }
  ]);
  await page.getByLabel("Output", { exact: true }).selectOption("jpeg");
  await page.getByLabel("Preset").selectOption("small");
  await page.getByLabel("Target KB").fill("8");
  await page.getByRole("button", { name: /Run Compress Image/ }).click();
  await expect(page.getByText("first-compressed.jpg")).toBeVisible();
  await expect(page.getByText("second-compressed.jpg")).toBeVisible();
  await expect(page.getByText(/Batch total:/)).toBeVisible();
  await expect(page.getByRole("button", { name: /ZIP all/ })).toBeVisible();

  const zip = await readFile(await downloadZip(page));
  expect(zip.subarray(0, 2).toString()).toBe("PK");
});

test("converts, watermarks, memes, and redacts images", async ({ page }) => {
  await page.goto("/");
  const image = await makePngFixture(page, 160, 100);

  await page.getByRole("button", { name: /Image Tools/ }).click();
  await page.getByRole("button", { name: /Convert to JPG/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await page.getByRole("button", { name: /Run Convert to JPG/ }).click();
  await expect(page.getByText("fixture-converted.jpg")).toBeVisible();
  const jpg = await readFile(await downloadFirst(page));
  expect(jpg[0]).toBe(0xff);
  expect(jpg[1]).toBe(0xd8);

  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: /Image Tools/ }).click();
  await page.getByRole("button", { name: /Watermark Image/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await page.getByLabel("Text").fill("DOCUKIND");
  await page.getByLabel("Repeat across image").check();
  await page.getByRole("button", { name: /Run Watermark Image/ }).click();
  await expect(page.getByText("fixture-watermarked.png")).toBeVisible();

  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: /Image Tools/ }).click();
  await page.getByRole("button", { name: /Meme Generator/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await page.getByLabel("Top text").fill("SHIP IT");
  await page.getByRole("button", { name: /Run Meme Generator/ }).click();
  await expect(page.getByText("fixture-meme.png")).toBeVisible();

  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page.getByRole("button", { name: /Image Tools/ }).click();
  await clickTool(page, /Blur \/ Redact Image/);
  await page.getByTestId("file-input").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await expect(page.locator(".region-canvas")).toBeVisible();
  await expect(page.locator(".region-canvas img")).toBeVisible();
  await page.getByRole("button", { name: "Add region" }).click();
  await expect(page.locator(".region-box")).toHaveCount(1);
  await page.getByLabel("Mode").selectOption("redact");
  await page.getByRole("button", { name: /Run Blur \/ Redact Image/ }).click();
  await expect(page.getByText("fixture-redact.png")).toBeVisible();
  const redacted = await readFile(await downloadFirst(page));
  const pixel = await sampleImagePixel(page, redacted, 20, 20);
  expect(pixel.r).toBeLessThan(40);
  expect(pixel.g).toBeLessThan(40);
  expect(pixel.b).toBeLessThan(40);
});

async function makePdf(label: string, size: [number, number] = [360, 240]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage(size);
  page.drawText(label, { x: Math.min(64, size[0] * 0.18), y: size[1] * 0.55, size: 42, font });
  return doc.save();
}

async function makeMultiPagePdf(pages: Array<[string, [number, number]]>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const [label, size] of pages) {
    const pdfPage = doc.addPage(size);
    pdfPage.drawText(label, { x: Math.min(64, size[0] * 0.18), y: size[1] * 0.55, size: 42, font });
  }
  return doc.save();
}

async function makePngFixture(page: import("@playwright/test").Page, width: number, height: number): Promise<Buffer> {
  const dataUrl = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#2e5aac";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#d9f274";
    context.fillRect(width / 2, 0, width / 2, height);
    context.fillStyle = "#f05d5e";
    context.fillRect(width * 0.25, height * 0.25, width * 0.5, height * 0.5);
    return canvas.toDataURL("image/png");
  }, { width, height });

  return Buffer.from(dataUrl.split(",")[1], "base64");
}

async function makeTransparentPngFixture(page: import("@playwright/test").Page, width: number, height: number): Promise<Buffer> {
  const dataUrl = await page.evaluate(({ width, height }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(46, 90, 172, 0.78)";
    context.fillRect(width * 0.25, height * 0.2, width * 0.65, height * 0.65);
    context.fillStyle = "rgba(240, 93, 94, 0.92)";
    context.fillRect(width * 0.42, height * 0.08, width * 0.35, height * 0.82);
    return canvas.toDataURL("image/png");
  }, { width, height });

  return Buffer.from(dataUrl.split(",")[1], "base64");
}

function minimalPdfBytes(): Uint8Array {
  const encoder = new TextEncoder();
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] >>\nendobj\n"
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(encoder.encode(body).length);
    body += object;
  }

  const xrefStart = encoder.encode(body).length;
  const xrefRows = offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  const trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xrefRows}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return encoder.encode(body + trailer);
}

async function downloadFirst(page: import("@playwright/test").Page): Promise<string> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).first().click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Download did not produce a local file.");
  return path;
}

async function clickTool(page: import("@playwright/test").Page, name: RegExp): Promise<void> {
  await page.getByRole("button", { name }).evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
}

async function waitForPageThumbnail(page: import("@playwright/test").Page): Promise<void> {
  await expect(page.locator("canvas.page-thumbnail-canvas").first()).toBeVisible({ timeout: 25_000 });
}

async function placeFieldOnPreview(page: import("@playwright/test").Page, xRatio: number, yRatio: number): Promise<void> {
  await page.locator(".signature-overlay").evaluate((element, point) => {
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: rect.left + rect.width * point.xRatio,
      clientY: rect.top + rect.height * point.yRatio,
      pointerId: 1,
      pointerType: "mouse"
    }));
  }, { xRatio, yRatio });
}

async function dragPaletteFieldToPreview(page: import("@playwright/test").Page, kind: string, xRatio: number, yRatio: number): Promise<void> {
  const palette = page.getByTestId(`palette-${kind}`);
  const target = page.locator(".signature-overlay");
  const paletteBox = await palette.boundingBox();
  const targetBox = await target.boundingBox();
  if (!paletteBox || !targetBox) throw new Error(`Could not drag ${kind}; missing palette or preview box.`);
  const startX = paletteBox.x + paletteBox.width / 2;
  const startY = paletteBox.y + paletteBox.height / 2;
  const endX = targetBox.x + targetBox.width * xRatio;
  const endY = targetBox.y + targetBox.height * yRatio;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 8, startY + 8);
  await page.mouse.move(endX, endY, { steps: 14 });
  await page.mouse.up();
}

async function chooseAndPlaceField(page: import("@playwright/test").Page, kind: string, xRatio: number, yRatio: number): Promise<void> {
  await page.getByTestId(`palette-${kind}`).click();
  await placeFieldOnPreview(page, xRatio, yRatio);
}

async function clickCenterVerifiedButton(page: import("@playwright/test").Page, name: string): Promise<void> {
  const button = page.getByRole("button", { name, exact: true });
  await button.scrollIntoViewIfNeeded();
  await expect.poll(async () => button.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === element || element.contains(hit);
  })).toBe(true);
  const box = await button.boundingBox();
  if (!box) throw new Error(`${name} button did not have a bounding box.`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

function isCanvasNonBlank(element: HTMLCanvasElement): boolean {
  const context = element.getContext("2d");
  if (!context) return false;
  const data = context.getImageData(0, 0, element.width, element.height).data;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index] < 245 || data[index + 1] < 245 || data[index + 2] < 245) return true;
  }
  return false;
}

function canvasHasInk(element: HTMLCanvasElement): boolean {
  const context = element.getContext("2d");
  if (!context) return false;
  const data = context.getImageData(0, 0, element.width, element.height).data;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] > 0) return true;
  }
  return false;
}

async function downloadZip(page: import("@playwright/test").Page): Promise<string> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /ZIP all/ }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("ZIP download did not produce a local file.");
  return path;
}

function readPngSize(buffer: Buffer): { width: number; height: number } {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

async function sampleImagePixel(
  page: import("@playwright/test").Page,
  buffer: Buffer,
  x: number,
  y: number,
  mimeType = "image/png"
): Promise<{ r: number; g: number; b: number; a: number }> {
  return page.evaluate(async ({ base64, x, y, mimeType }) => {
    const response = await fetch(`data:${mimeType};base64,${base64}`);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const [r, g, b, a] = context.getImageData(x, y, 1, 1).data;
    bitmap.close();
    return { r, g, b, a };
  }, { base64: buffer.toString("base64"), x, y, mimeType });
}
