export type PercentRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RegionResizeHandle = "nw" | "ne" | "sw" | "se";

export function parsePercentRegions(value: string): PercentRegion[] {
  return value
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map<PercentRegion | null>((part) => {
      const values = part.split(",").map((token) => Number(token.trim().replace("%", "")));
      if (values.length !== 4 || values.some((number) => !Number.isFinite(number))) return null;
      const [x, y, width, height] = values;
      return {
        x: clamp(x, 0, 100),
        y: clamp(y, 0, 100),
        width: clamp(width, 0, 100),
        height: clamp(height, 0, 100)
      };
    })
    .filter((region): region is PercentRegion => region !== null);
}

export function normalizeDragRegion(drag: {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}): PercentRegion {
  const x = Math.min(drag.startX, drag.currentX);
  const y = Math.min(drag.startY, drag.currentY);
  const width = Math.abs(drag.currentX - drag.startX);
  const height = Math.abs(drag.currentY - drag.startY);
  return { x, y, width, height };
}

export function formatPercentRegion(region: PercentRegion): string {
  return [region.x, region.y, region.width, region.height].map((value) => `${clamp(value, 0, 100).toFixed(1)}%`).join(",");
}

export function formatPercentRegions(regions: PercentRegion[]): string {
  return regions.map((region) => formatPercentRegion(clampPercentRegion(region))).join("; ");
}

export function ratioFromOption(value: unknown): number | undefined {
  const normalized = String(value ?? "free").trim().toLowerCase();
  if (!normalized || normalized === "free") return undefined;

  const match = normalized.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return undefined;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined;
  return width / height;
}

export function applyAspectRatio(region: PercentRegion, ratio: number | undefined): PercentRegion {
  if (!ratio || region.width <= 0 || region.height <= 0) return region;

  const current = region.width / region.height;
  let width = region.width;
  let height = region.height;

  if (current > ratio) {
    width = height * ratio;
  } else {
    height = width / ratio;
  }

  return {
    x: clamp(region.x, 0, 100),
    y: clamp(region.y, 0, 100),
    width: clamp(width, 0, 100 - region.x),
    height: clamp(height, 0, 100 - region.y)
  };
}

export function clampPercentRegion(region: PercentRegion, minSize = 1): PercentRegion {
  const width = clamp(region.width, minSize, 100);
  const height = clamp(region.height, minSize, 100);
  const x = clamp(region.x, 0, 100 - width);
  const y = clamp(region.y, 0, 100 - height);
  return { x, y, width, height };
}

export function movePercentRegion(region: PercentRegion, deltaX: number, deltaY: number): PercentRegion {
  return clampPercentRegion({
    ...region,
    x: region.x + deltaX,
    y: region.y + deltaY
  });
}

export function resizePercentRegion(
  region: PercentRegion,
  handle: RegionResizeHandle,
  deltaX: number,
  deltaY: number,
  ratio?: number
): PercentRegion {
  let next = { ...region };

  if (handle.includes("w")) {
    next.x += deltaX;
    next.width -= deltaX;
  }
  if (handle.includes("e")) {
    next.width += deltaX;
  }
  if (handle.includes("n")) {
    next.y += deltaY;
    next.height -= deltaY;
  }
  if (handle.includes("s")) {
    next.height += deltaY;
  }

  next = clampPercentRegion(next);
  return ratio ? clampPercentRegion(applyAspectRatio(next, ratio)) : next;
}

export function replacePercentRegion(regions: PercentRegion[], index: number, next: PercentRegion): PercentRegion[] {
  return regions.map((region, offset) => (offset === index ? clampPercentRegion(next) : region));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
