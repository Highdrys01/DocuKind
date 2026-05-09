import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument, StandardFonts } from "pdf-lib";

test("renders the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /PDF and image work/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Merge PDF/ })).toBeVisible();
});

test("renders uploaded PDF thumbnails and runs merge", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Merge PDF/ }).click();
  await expect(page.getByRole("heading", { name: "Merge PDF" })).toBeVisible();

  const first = await makePdf("first");
  const second = await makePdf("second");
  await page.getByTestId("file-input").setInputFiles([
    { name: "first.pdf", mimeType: "application/pdf", buffer: Buffer.from(first) },
    { name: "second.pdf", mimeType: "application/pdf", buffer: Buffer.from(second) }
  ]);

  const canvas = page.locator("canvas.thumbnail-canvas").first();
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

  await page.getByRole("button", { name: /Run Merge PDF/ }).click();
  await expect(page.getByText("docukind-merged.pdf")).toBeVisible();
});

test("resizes and crops images with downloadable outputs", async ({ page }) => {
  await page.goto("/");
  const image = await makePngFixture(page, 160, 100);

  await page.getByRole("button", { name: /^Image$/ }).click();
  await page.getByRole("button", { name: /Resize Image/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await page.getByLabel("Width").fill("80");
  await page.getByLabel("Height").fill("40");
  await page.getByLabel("Fit").selectOption("stretch");
  await page.getByRole("button", { name: /Run Resize Image/ }).click();
  await expect(page.getByText("fixture-80x40.png")).toBeVisible();

  const resized = await downloadFirst(page);
  expect(readPngSize(await readFile(resized))).toEqual({ width: 80, height: 40 });

  await page.getByRole("button", { name: "Tools" }).click();
  await page.getByRole("button", { name: /^Image$/ }).click();
  await page.getByRole("button", { name: /Crop Image/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await page.getByLabel("Selected crop").fill("25%,20%,50%,50%");
  await page.getByRole("button", { name: /Run Crop Image/ }).click();
  await expect(page.getByText("fixture-crop-80x50.png")).toBeVisible();

  const cropped = await downloadFirst(page);
  expect(readPngSize(await readFile(cropped))).toEqual({ width: 80, height: 50 });
});

test("converts, watermarks, memes, and redacts images", async ({ page }) => {
  await page.goto("/");
  const image = await makePngFixture(page, 160, 100);

  await page.getByRole("button", { name: /^Image$/ }).click();
  await page.getByRole("button", { name: /Convert to JPG/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await page.getByRole("button", { name: /Run Convert to JPG/ }).click();
  await expect(page.getByText("fixture-converted.jpg")).toBeVisible();
  const jpg = await readFile(await downloadFirst(page));
  expect(jpg[0]).toBe(0xff);
  expect(jpg[1]).toBe(0xd8);

  await page.getByRole("button", { name: "Tools" }).click();
  await page.getByRole("button", { name: /^Image$/ }).click();
  await page.getByRole("button", { name: /Watermark Image/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await page.getByLabel("Text").fill("DOCUKIND");
  await page.getByLabel("Repeat across image").check();
  await page.getByRole("button", { name: /Run Watermark Image/ }).click();
  await expect(page.getByText("fixture-watermarked.png")).toBeVisible();

  await page.getByRole("button", { name: "Tools" }).click();
  await page.getByRole("button", { name: /^Image$/ }).click();
  await page.getByRole("button", { name: /Meme Generator/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await page.getByLabel("Top text").fill("SHIP IT");
  await page.getByRole("button", { name: /Run Meme Generator/ }).click();
  await expect(page.getByText("fixture-meme.png")).toBeVisible();

  await page.getByRole("button", { name: "Tools" }).click();
  await page.getByRole("button", { name: /^Image$/ }).click();
  await page.getByRole("button", { name: /Blur \/ Redact Image/ }).click();
  await page.getByTestId("file-input").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: image });
  await page.getByLabel("Regions").fill("0%,0%,50%,50%");
  await page.getByLabel("Mode").selectOption("redact");
  await page.getByRole("button", { name: /Run Blur \/ Redact Image/ }).click();
  await expect(page.getByText("fixture-redact.png")).toBeVisible();
  const redacted = await readFile(await downloadFirst(page));
  const pixel = await sampleImagePixel(page, redacted, 20, 20);
  expect(pixel.r).toBeLessThan(40);
  expect(pixel.g).toBeLessThan(40);
  expect(pixel.b).toBeLessThan(40);
});

async function makePdf(label: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([360, 240]);
  page.drawText(label, { x: 64, y: 132, size: 42, font });
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

async function downloadFirst(page: import("@playwright/test").Page): Promise<string> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /^Download$/ }).first().click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Download did not produce a local file.");
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
  y: number
): Promise<{ r: number; g: number; b: number; a: number }> {
  return page.evaluate(async ({ base64, x, y }) => {
    const response = await fetch(`data:image/png;base64,${base64}`);
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
  }, { base64: buffer.toString("base64"), x, y });
}
