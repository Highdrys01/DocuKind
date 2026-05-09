import { describe, expect, it } from "vitest";
import { applyAspectRatio, formatPercentRegion, normalizeDragRegion, parsePercentRegions, ratioFromOption } from "./regions";

describe("region helpers", () => {
  it("parses and formats percent regions", () => {
    expect(parsePercentRegions("10%,20%,30%,40%")).toEqual([{ x: 10, y: 20, width: 30, height: 40 }]);
    expect(formatPercentRegion({ x: 10, y: 20, width: 30, height: 40 })).toBe("10.0%,20.0%,30.0%,40.0%");
  });

  it("normalizes drag regions", () => {
    expect(normalizeDragRegion({ startX: 80, startY: 70, currentX: 20, currentY: 10 })).toEqual({
      x: 20,
      y: 10,
      width: 60,
      height: 60
    });
  });

  it("applies aspect ratio presets by shrinking the loose edge", () => {
    expect(ratioFromOption("16:9")).toBeCloseTo(16 / 9);
    expect(applyAspectRatio({ x: 10, y: 10, width: 80, height: 80 }, 16 / 9)).toEqual({
      x: 10,
      y: 10,
      width: 80,
      height: 45
    });
  });

  it("leaves freeform regions unchanged", () => {
    expect(ratioFromOption("free")).toBeUndefined();
    expect(applyAspectRatio({ x: 5, y: 5, width: 40, height: 20 }, undefined)).toEqual({
      x: 5,
      y: 5,
      width: 40,
      height: 20
    });
  });
});
