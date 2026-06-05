import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";
import { fileToUint8Array } from "./file";
import type { PageViewport } from "./signatures";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export type RenderedPage = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  viewport: PageViewport;
};

export async function getRenderedPageCount(file: File): Promise<number> {
  const pdf = await pdfjsLib.getDocument({ data: await fileToUint8Array(file) }).promise;
  try {
    return pdf.numPages;
  } finally {
    await pdf.destroy();
  }
}

export async function getPdfPageViewports(file: File, scale = 1): Promise<PageViewport[]> {
  const pdf = await pdfjsLib.getDocument({ data: await fileToUint8Array(file) }).promise;
  try {
    const viewports: PageViewport[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      viewports.push(toPageViewport(page.getViewport({ scale })));
    }
    return viewports;
  } finally {
    await pdf.destroy();
  }
}

export async function renderPdfPage(file: File, pageNumber: number, scale = 0.45): Promise<RenderedPage> {
  const pdf = await pdfjsLib.getDocument({ data: await fileToUint8Array(file) }).promise;
  try {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("Canvas rendering is not available in this browser.");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({ canvasContext: context, viewport } as never).promise;

    return {
      canvas,
      width: canvas.width,
      height: canvas.height,
      viewport: toPageViewport(viewport)
    };
  } finally {
    await pdf.destroy();
  }
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

type PdfJsViewport = {
  width: number;
  height: number;
  rotation: number;
  transform: number[];
  rawDims?: {
    pageWidth?: number;
    pageHeight?: number;
  };
};

function toPageViewport(viewport: PdfJsViewport): PageViewport {
  return {
    width: viewport.width,
    height: viewport.height,
    pdfWidth: viewport.rawDims?.pageWidth ?? viewport.width,
    pdfHeight: viewport.rawDims?.pageHeight ?? viewport.height,
    rotation: viewport.rotation,
    transform: viewport.transform.slice(0, 6) as PageViewport["transform"]
  };
}
