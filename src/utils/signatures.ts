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

export type PreviewPoint = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const DEFAULT_SIGNATURE_COLORS = ["#1f2a24", "#e23a3a", "#126c68", "#2e5aac"];

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

export function previewDeltaToPdfDelta(deltaX: number, deltaY: number, rect: DOMRect, page: PageSize): { dx: number; dy: number } {
  return {
    dx: (deltaX / rect.width) * page.width,
    dy: -(deltaY / rect.height) * page.height
  };
}

export function clampPlacement(placement: SignaturePlacement, page: PageSize): SignaturePlacement {
  const width = clampNumber(placement.width, 24, page.width);
  const height = clampNumber(placement.height, 14, page.height);
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
      return { width: 88, height: 44 };
    case "date":
      return { width: 104, height: 28 };
    case "name":
      return { width: 140, height: 30 };
    case "text":
      return { width: 160, height: 34 };
  }
}

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mimeType: string } {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) throw new Error("Signature image data is not a valid data URL.");

  const binary = globalThis.atob(match[2]);
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
