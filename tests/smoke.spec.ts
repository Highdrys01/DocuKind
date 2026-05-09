import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

test("renders the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /PDF work/ })).toBeVisible();
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

async function makePdf(label: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([360, 240]);
  page.drawText(label, { x: 64, y: 132, size: 42, font });
  return doc.save();
}
