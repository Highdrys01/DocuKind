import { describe, expect, it } from "vitest";
import { calculateResize, formatPercentRegion, parseRegion } from "./image";

describe("image helpers", () => {
  it("calculates percentage resize dimensions", () => {
    expect(calculateResize(400, 200, { mode: "percent", percent: 50 })).toEqual({ width: 200, height: 100 });
  });

  it("fits dimensions inside a bounding box without upscaling", () => {
    expect(calculateResize(1600, 900, { mode: "pixels", width: 800, height: 800, fit: "inside" })).toEqual({ width: 800, height: 450 });
    expect(calculateResize(320, 180, { mode: "pixels", width: 800, height: 800, fit: "inside" })).toEqual({ width: 320, height: 180 });
  });

  it("parses percent regions against source dimensions", () => {
    expect(parseRegion("25%,10%,50%,40%", 200, 100)).toEqual({
      x: 50,
      y: 10,
      width: 100,
      height: 40,
      unit: "pixel"
    });
  });

  it("formats regions as percentages", () => {
    expect(formatPercentRegion({ x: 20, y: 10, width: 80, height: 40, unit: "pixel" }, 200, 100)).toBe("10.0%,10.0%,40.0%,40.0%");
  });
});
