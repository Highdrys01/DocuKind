import { describe, expect, it } from "vitest";
import {
  applyAspectRatio,
  formatPercentRegion,
  formatPercentRegions,
  movePercentRegion,
  normalizeDragRegion,
  parsePercentRegions,
  replacePercentRegion,
  resizePercentRegion,
  ratioFromOption
} from "./regions";

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

  it("applies aspect ratio presets against non-square source images", () => {
    expect(applyAspectRatio({ x: 10, y: 10, width: 80, height: 80 }, 1, 160 / 100)).toEqual({
      x: 10,
      y: 10,
      width: 50,
      height: 80
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

  it("moves regions while keeping them inside the image", () => {
    expect(movePercentRegion({ x: 80, y: 90, width: 30, height: 20 }, 10, 10)).toEqual({
      x: 70,
      y: 80,
      width: 30,
      height: 20
    });
  });

  it("resizes regions from handles", () => {
    expect(resizePercentRegion({ x: 20, y: 20, width: 40, height: 30 }, "se", 10, 5)).toEqual({
      x: 20,
      y: 20,
      width: 50,
      height: 35
    });
    expect(resizePercentRegion({ x: 20, y: 20, width: 40, height: 30 }, "nw", 10, 5)).toEqual({
      x: 30,
      y: 25,
      width: 30,
      height: 25
    });
  });

  it("replaces and serializes region lists", () => {
    const regions = replacePercentRegion([{ x: 0, y: 0, width: 10, height: 10 }], 0, { x: 5, y: 6, width: 20, height: 30 });
    expect(formatPercentRegions(regions)).toBe("5.0%,6.0%,20.0%,30.0%");
  });
});
