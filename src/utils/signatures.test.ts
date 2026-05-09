import { describe, expect, it } from "vitest";
import {
  clampPlacement,
  dataUrlToBytes,
  parseSignaturePlacements,
  placementToPreviewRect,
  previewDeltaToPdfDelta,
  validateSignaturePlacements,
  type SignaturePlacement
} from "./signatures";

describe("signature helpers", () => {
  const page = { width: 600, height: 800 };

  it("converts PDF placement coordinates to preview percentages", () => {
    const rect = placementToPreviewRect(makePlacement({ x: 60, y: 80, width: 120, height: 40 }), page);
    expect(rect).toEqual({ left: 10, top: 85, width: 20, height: 5 });
  });

  it("converts preview deltas to PDF deltas with inverted y axis", () => {
    const delta = previewDeltaToPdfDelta(50, 25, { width: 300, height: 400 } as DOMRect, page);
    expect(delta.dx).toBe(100);
    expect(delta.dy).toBe(-50);
  });

  it("clamps placement inside page bounds", () => {
    const clamped = clampPlacement(makePlacement({ x: 580, y: -10, width: 80, height: 20 }), page);
    expect(clamped.x).toBe(520);
    expect(clamped.y).toBe(0);
  });

  it("rejects blank placements and invalid pages", () => {
    expect(() => validateSignaturePlacements([], [page])).toThrow(/at least one/);
    expect(() => validateSignaturePlacements([makePlacement({ value: "", imageData: undefined })], [page])).toThrow(/blank/);
    expect(() => validateSignaturePlacements([makePlacement({ pageIndex: 2 })], [page])).toThrow(/does not exist/);
  });

  it("parses structured placements from tool options", () => {
    const placements = parseSignaturePlacements([{ kind: "date", pageIndex: "1", x: "10", y: "20", value: "May 9" }]);
    expect(placements).toMatchObject([{ kind: "date", pageIndex: 1, x: 10, y: 20, value: "May 9" }]);
  });

  it("decodes data URLs", () => {
    const { bytes, mimeType } = dataUrlToBytes("data:image/png;base64,SGk=");
    expect(mimeType).toBe("image/png");
    expect(Array.from(bytes)).toEqual([72, 105]);
  });
});

function makePlacement(overrides: Partial<SignaturePlacement> = {}): SignaturePlacement {
  return {
    id: "sig-1",
    pageIndex: 0,
    kind: "signature",
    x: 10,
    y: 20,
    width: 120,
    height: 40,
    value: "Ada",
    color: "#1f2a24",
    opacity: 1,
    ...overrides
  };
}
