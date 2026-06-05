export type SignatureFieldKind = "signature" | "initials" | "name" | "date" | "text";
export type SignatureFontStyle = "script" | "formal" | "classic" | "plain";

export type SignaturePlacement = {
  id: string;
  pageIndex: number;
  kind: SignatureFieldKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  color?: string;
  opacity?: number;
  value: string;
  fontStyle?: SignatureFontStyle;
  imageData?: string;
  source?: "typed" | "drawn" | "uploaded";
};

export type PageSize = {
  width: number;
  height: number;
};

export type PageViewport = {
  width: number;
  height: number;
  pdfWidth: number;
  pdfHeight: number;
  rotation: number;
  transform: [number, number, number, number, number, number];
};

export type PreviewPoint = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PreviewPixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DEFAULT_SIGNATURE_COLORS = ["#1f2a24", "#e23a3a", "#126c68", "#2e5aac"];
const MIN_FIELD_WIDTH = 36;
const MIN_FIELD_HEIGHT = 24;

export function placementToPreviewRect(placement: SignaturePlacement, page: PageSize): PreviewPoint {
  return {
    left: (placement.x / page.width) * 100,
    top: ((page.height - placement.y - placement.height) / page.height) * 100,
    width: (placement.width / page.width) * 100,
    height: (placement.height / page.height) * 100
  };
}

export function pointerToPdfPoint(clientX: number, clientY: number, rect: DOMRect, page: PageSize): { x: number; y: number } {
  const x = ((clientX - rect.left) / rect.width) * page.width;
  const y = page.height - ((clientY - rect.top) / rect.height) * page.height;
  return {
    x: clampNumber(x, 0, page.width),
    y: clampNumber(y, 0, page.height)
  };
}

export function pointerToPdfPointInViewport(clientX: number, clientY: number, rect: DOMRect, viewport: PageViewport): { x: number; y: number } {
  const viewportX = ((clientX - rect.left) / rect.width) * viewport.width;
  const viewportY = ((clientY - rect.top) / rect.height) * viewport.height;
  const point = applyInverseTransform(viewportX, viewportY, viewport.transform);
  return clampPdfPoint(point, viewport);
}

export function placementToPreviewPixels(placement: SignaturePlacement, page: PageSize, preview: PageSize): PreviewPixelRect {
  return {
    x: (placement.x / page.width) * preview.width,
    y: ((page.height - placement.y - placement.height) / page.height) * preview.height,
    width: (placement.width / page.width) * preview.width,
    height: (placement.height / page.height) * preview.height
  };
}

export function placementToPreviewPixelsInViewport(
  placement: SignaturePlacement,
  viewport: PageViewport,
  preview: PageSize
): PreviewPixelRect {
  const bounds = pdfRectToViewportBounds(placement, viewport);
  return {
    x: (bounds.x / viewport.width) * preview.width,
    y: (bounds.y / viewport.height) * preview.height,
    width: (bounds.width / viewport.width) * preview.width,
    height: (bounds.height / viewport.height) * preview.height
  };
}

export function previewRectToPlacement(
  placement: SignaturePlacement,
  rect: PreviewPixelRect,
  page: PageSize,
  preview: PageSize
): SignaturePlacement {
  if (preview.width <= 0 || preview.height <= 0) return placement;
  const width = (rect.width / preview.width) * page.width;
  const height = (rect.height / preview.height) * page.height;
  return clampPlacement({
    ...placement,
    x: (rect.x / preview.width) * page.width,
    y: page.height - ((rect.y + rect.height) / preview.height) * page.height,
    width,
    height
  }, page);
}

export function previewRectToPlacementInViewport(
  placement: SignaturePlacement,
  rect: PreviewPixelRect,
  viewport: PageViewport,
  preview: PageSize
): SignaturePlacement {
  if (preview.width <= 0 || preview.height <= 0 || viewport.width <= 0 || viewport.height <= 0) return placement;
  const scaleX = viewport.width / preview.width;
  const scaleY = viewport.height / preview.height;
  const viewportCorners = [
    { x: rect.x * scaleX, y: rect.y * scaleY },
    { x: (rect.x + rect.width) * scaleX, y: rect.y * scaleY },
    { x: rect.x * scaleX, y: (rect.y + rect.height) * scaleY },
    { x: (rect.x + rect.width) * scaleX, y: (rect.y + rect.height) * scaleY }
  ];
  const pdfCorners = viewportCorners.map((point) => applyInverseTransform(point.x, point.y, viewport.transform));
  const xs = pdfCorners.map((point) => point.x);
  const ys = pdfCorners.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return clampPlacement({
    ...placement,
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }, pageSizeFromViewport(viewport));
}

export function previewDeltaToPdfDelta(deltaX: number, deltaY: number, rect: DOMRect, page: PageSize): { dx: number; dy: number } {
  return {
    dx: (deltaX / rect.width) * page.width,
    dy: -(deltaY / rect.height) * page.height
  };
}

export function previewDeltaToPdfDeltaInViewport(
  deltaX: number,
  deltaY: number,
  viewport: PageViewport,
  preview: PageSize
): { dx: number; dy: number } {
  if (preview.width <= 0 || preview.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return { dx: 0, dy: 0 };
  }
  const viewportDeltaX = (deltaX / preview.width) * viewport.width;
  const viewportDeltaY = (deltaY / preview.height) * viewport.height;
  const origin = applyInverseTransform(0, 0, viewport.transform);
  const moved = applyInverseTransform(viewportDeltaX, viewportDeltaY, viewport.transform);

  return {
    dx: moved.x - origin.x,
    dy: moved.y - origin.y
  };
}

export function pageSizeFromViewport(viewport: PageViewport): PageSize {
  return { width: viewport.pdfWidth, height: viewport.pdfHeight };
}

export function copyPlacementToViewportPage(
  placement: SignaturePlacement,
  sourceViewport: PageViewport,
  targetViewport: PageViewport,
  pageIndex: number
): SignaturePlacement {
  const sourceBounds = pdfRectToViewportBounds(placement, sourceViewport);
  const sourceWidth = Math.max(1, sourceViewport.width);
  const sourceHeight = Math.max(1, sourceViewport.height);
  const targetRect = {
    x: (sourceBounds.x / sourceWidth) * targetViewport.width,
    y: (sourceBounds.y / sourceHeight) * targetViewport.height,
    width: (sourceBounds.width / sourceWidth) * targetViewport.width,
    height: (sourceBounds.height / sourceHeight) * targetViewport.height
  };

  return previewRectToPlacementInViewport(
    { ...placement, pageIndex },
    targetRect,
    targetViewport,
    { width: targetViewport.width, height: targetViewport.height }
  );
}

export function clampPlacement(placement: SignaturePlacement, page: PageSize): SignaturePlacement {
  const width = clampNumber(placement.width, MIN_FIELD_WIDTH, page.width);
  const height = clampNumber(placement.height, MIN_FIELD_HEIGHT, page.height);
  return {
    ...placement,
    width,
    height,
    x: clampNumber(placement.x, 0, Math.max(0, page.width - width)),
    y: clampNumber(placement.y, 0, Math.max(0, page.height - height)),
    opacity: clampNumber(placement.opacity ?? 1, 0.05, 1),
    rotation: typeof placement.rotation === "number" && Number.isFinite(placement.rotation) ? placement.rotation : 0
  };
}

export function validateSignaturePlacements(placements: SignaturePlacement[], pages: PageSize[]): SignaturePlacement[] {
  if (placements.length === 0) throw new Error("Add at least one signature field to the PDF.");

  return placements.map((placement) => {
    const page = pages[placement.pageIndex];
    if (!page) throw new Error(`Signature field "${placement.id}" is on a page that does not exist.`);

    const normalized: SignaturePlacement = {
      ...placement,
      value: String(placement.value ?? "").trim(),
      color: placement.color || "#1f2a24"
    };

    if (!normalized.value && !normalized.imageData) {
      throw new Error(`Signature field "${placement.kind}" is blank.`);
    }

    if (normalized.width <= 0 || normalized.height <= 0) {
      throw new Error(`Signature field "${placement.kind}" has an invalid size.`);
    }

    if (!Number.isFinite(normalized.x) || !Number.isFinite(normalized.y) || !Number.isFinite(normalized.width) || !Number.isFinite(normalized.height)) {
      throw new Error(`Signature field "${placement.kind}" has invalid coordinates.`);
    }

    if (
      normalized.x < 0 ||
      normalized.y < 0 ||
      normalized.x + normalized.width > page.width ||
      normalized.y + normalized.height > page.height
    ) {
      throw new Error(`Signature field "${placement.kind}" is outside the page bounds.`);
    }

    if (normalized.imageData) {
      dataUrlToBytes(normalized.imageData);
    }

    return clampPlacement(normalized, page);
  });
}

export function parseSignaturePlacements(value: unknown): SignaturePlacement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const kind = normalizeKind(raw.kind);
    if (!kind) return [];

    return [{
      id: typeof raw.id === "string" && raw.id ? raw.id : `signature-${index + 1}`,
      pageIndex: toInt(raw.pageIndex, 0),
      kind,
      x: toNumber(raw.x, 0),
      y: toNumber(raw.y, 0),
      width: toNumber(raw.width, defaultSizeForKind(kind).width),
      height: toNumber(raw.height, defaultSizeForKind(kind).height),
      rotation: toNumber(raw.rotation, 0),
      color: typeof raw.color === "string" ? raw.color : "#1f2a24",
      opacity: toNumber(raw.opacity, 1),
      value: typeof raw.value === "string" ? raw.value : "",
      fontStyle: normalizeFontStyle(raw.fontStyle),
      imageData: typeof raw.imageData === "string" ? raw.imageData : undefined,
      source: raw.source === "drawn" || raw.source === "uploaded" ? raw.source : "typed"
    }];
  });
}

export function defaultSizeForKind(kind: SignatureFieldKind): { width: number; height: number } {
  switch (kind) {
    case "signature":
      return { width: 180, height: 64 };
    case "initials":
      return { width: 96, height: 48 };
    case "date":
      return { width: 128, height: 34 };
    case "name":
      return { width: 160, height: 36 };
    case "text":
      return { width: 190, height: 38 };
  }
}

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string } {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) throw new Error("Signature image data is not a valid data URL.");
  if (match[1] !== "image/png" && match[1] !== "image/jpeg" && match[1] !== "image/jpg") {
    throw new Error("Signature images must be PNG or JPG.");
  }

  let binary: string;
  try {
    binary = globalThis.atob(match[2]);
  } catch {
    throw new Error("Signature image data is not valid base64.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return { bytes, mimeType: match[1] };
}

function normalizeKind(value: unknown): SignatureFieldKind | undefined {
  return value === "signature" || value === "initials" || value === "name" || value === "date" || value === "text"
    ? value
    : undefined;
}

function normalizeFontStyle(value: unknown): SignatureFontStyle {
  return value === "formal" || value === "classic" || value === "plain" ? value : "script";
}

function pdfRectToViewportBounds(placement: SignaturePlacement, viewport: PageViewport): PreviewPixelRect {
  const points = [
    applyTransform(placement.x, placement.y, viewport.transform),
    applyTransform(placement.x + placement.width, placement.y, viewport.transform),
    applyTransform(placement.x, placement.y + placement.height, viewport.transform),
    applyTransform(placement.x + placement.width, placement.y + placement.height, viewport.transform)
  ];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function applyTransform(
  x: number,
  y: number,
  [a, b, c, d, e, f]: PageViewport["transform"]
): { x: number; y: number } {
  return {
    x: x * a + y * c + e,
    y: x * b + y * d + f
  };
}

function applyInverseTransform(
  x: number,
  y: number,
  [a, b, c, d, e, f]: PageViewport["transform"]
): { x: number; y: number } {
  const determinant = a * d - b * c;
  if (determinant === 0) return { x: 0, y: 0 };
  return {
    x: (x * d - y * c + c * f - e * d) / determinant,
    y: (-x * b + y * a + e * b - f * a) / determinant
  };
}

function clampPdfPoint(point: { x: number; y: number }, viewport: PageViewport): { x: number; y: number } {
  return {
    x: clampNumber(point.x, 0, viewport.pdfWidth),
    y: clampNumber(point.y, 0, viewport.pdfHeight)
  };
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value: unknown, fallback: number): number {
  return Math.max(0, Math.trunc(toNumber(value, fallback)));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
