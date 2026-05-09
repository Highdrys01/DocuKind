import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import { fileToUint8Array } from "./file";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export type RenderedPage = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

export async function getRenderedPageCount(file: File): Promise<number> {
  const pdf = await pdfjsLib.getDocument({ data: await fileToUint8Array(file) }).promise;
  const count = pdf.numPages;
  await pdf.destroy();
  return count;
}

export async function renderPdfPage(file: File, pageNumber: number, scale = 0.45): Promise<RenderedPage> {
  const pdf = await pdfjsLib.getDocument({ data: await fileToUint8Array(file) }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    await pdf.destroy();
    throw new Error("Canvas rendering is not available in this browser.");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({ canvasContext: context, viewport } as never).promise;
  await pdf.destroy();

  return {
    canvas,
    width: canvas.width,
    height: canvas.height
  };
}

export async function renderPdfPageToBlob(
  file: File,
  pageNumber: number,
  scale: number,
  mimeType: "image/png" | "image/jpeg",
  quality = 0.85
): Promise<Blob> {
  const rendered = await renderPdfPage(file, pageNumber, scale);
  return canvasToBlob(rendered.canvas, mimeType, quality);
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: "image/png" | "image/jpeg",
  quality = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not export the rendered page."));
        }
      },
      mimeType,
      quality
    );
  });
}
