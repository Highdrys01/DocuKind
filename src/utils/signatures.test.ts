import { describe, expect, it } from "vitest";
import {
  clampPlacement,
  copyPlacementToViewportPage,
  dataUrlToBytes,
  placementToPreviewPixels,
  placementToPreviewPixelsInViewport,
  parseSignaturePlacements,
  placementToPreviewRect,
  previewRectToPlacement,
  previewRectToPlacementInViewport,
  previewDeltaToPdfDelta,
  previewDeltaToPdfDeltaInViewport,
  pointerToPdfPointInViewport,
  validateSignaturePlacements,
  type PageViewport,
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

  it("round-trips placement through preview pixel coordinates", () => {
    const placement = makePlacement({ x: 60, y: 80, width: 120, height: 40 });
    const preview = { width: 300, height: 400 };
    const pixels = placementToPreviewPixels(placement, page, preview);
    expect(pixels).toEqual({ x: 30, y: 340, width: 60, height: 20 });
    expect(previewRectToPlacement(placement, pixels, page, preview)).toMatchObject({
      x: 60,
      y: 80,
      width: 120,
      height: 40
    });
  });

  it("round-trips rotated PDF viewport coordinates", () => {
    const viewport = makeViewport90();
    const placement = makePlacement({ x: 40, y: 60, width: 100, height: 30 });
    const preview = { width: 400, height: 300 };
    const pixels = placementToPreviewPixelsInViewport(placement, viewport, preview);

    expect(pixels).toEqual({ x: 30, y: 20, width: 15, height: 50 });
    expect(previewRectToPlacementInViewport(placement, pixels, viewport, preview)).toMatchObject({
      x: 40,
      y: 60,
      width: 100,
      height: 30
    });
  });

  it("converts pointer positions through rotated PDF viewports", () => {
    const viewport = makeViewport90();
    const point = pointerToPdfPointInViewport(100, 200, { left: 0, top: 0, width: 800, height: 600 } as DOMRect, viewport);

    expect(point).toEqual({ x: 200, y: 100 });
  });

  it("converts visual nudge deltas through rotated PDF viewports", () => {
    expect(previewDeltaToPdfDeltaInViewport(0, -20, makeViewport0(), { width: 600, height: 800 })).toEqual({ dx: 0, dy: 20 });
    expect(previewDeltaToPdfDeltaInViewport(10, 0, makeViewport90(), { width: 800, height: 600 })).toEqual({ dx: 0, dy: 10 });
    expect(previewDeltaToPdfDeltaInViewport(0, -10, makeViewport90(), { width: 800, height: 600 })).toEqual({ dx: -10, dy: 0 });
  });

  it("clamps placement inside page bounds", () => {
    const clamped = clampPlacement(makePlacement({ x: 580, y: -10, width: 80, height: 20 }), page);
    expect(clamped.x).toBe(520);
    expect(clamped.y).toBe(0);
  });

  it("copies placements by visual position across rotated pages", () => {
    const source = makeViewport0();
    const target = makeViewport90();
    const placement = makePlacement({ x: 60, y: 80, width: 120, height: 80 });
    const copied = copyPlacementToViewportPage(placement, source, target, 1);
    const copiedPixels = placementToPreviewPixelsInViewport(copied, target, { width: target.width, height: target.height });

    expect(copied.pageIndex).toBe(1);
    expect(copiedPixels).toEqual({ x: 80, y: 480, width: 160, height: 60 });
  });

  it("rejects blank placements and invalid pages", () => {
    expect(() => validateSignaturePlacements([], [page])).toThrow(/at least one/);
    expect(() => validateSignaturePlacements([makePlacement({ value: "", imageData: undefined })], [page])).toThrow(/blank/);
    expect(() => validateSignaturePlacements([makePlacement({ pageIndex: 2 })], [page])).toThrow(/does not exist/);
    expect(() => validateSignaturePlacements([makePlacement({ x: 560, width: 80 })], [page])).toThrow(/outside/);
    expect(() => validateSignaturePlacements([makePlacement({ imageData: "data:image/gif;base64,SGk=" })], [page])).toThrow(/PNG or JPG/);
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

function makeViewport0(): PageViewport {
  return {
    width: 600,
    height: 800,
    pdfWidth: 600,
    pdfHeight: 800,
    rotation: 0,
    transform: [1, 0, 0, -1, 0, 800]
  };
}

function makeViewport90(): PageViewport {
  return {
    width: 800,
    height: 600,
    pdfWidth: 600,
    pdfHeight: 800,
    rotation: 90,
    transform: [0, 1, 1, 0, 0, 0]
  };
}
