export type PercentRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
