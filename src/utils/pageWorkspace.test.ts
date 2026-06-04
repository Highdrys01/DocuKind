import { describe, expect, it } from "vitest";
import {
  activePageOrder,
  buildPageWorkspaceOptions,
  normalizePageRotation,
  pageIndexesToRangeText,
  pageRotationsJson,
  selectedPageIndexes,
  type WorkspacePage
} from "./pageWorkspace";

const pages: WorkspacePage[] = [
  { pageIndex: 2, selected: true, rotation: 90 },
  { pageIndex: 0, selected: false },
  { pageIndex: 1, selected: true, deleted: true, rotation: 180 },
  { pageIndex: 3, selected: true, rotation: -90 }
];

describe("page workspace helpers", () => {
  it("builds readable page ranges from indexes", () => {
    expect(pageIndexesToRangeText([0, 1, 2, 4, 6, 7])).toBe("1-3,5,7-8");
  });

  it("returns selected pages while ignoring deleted pages", () => {
    expect(selectedPageIndexes(pages)).toEqual([2, 3]);
  });

  it("keeps visual order for active organize pages", () => {
    expect(activePageOrder(pages)).toEqual([2, 0, 3]);
  });

  it("normalizes page rotations", () => {
    expect(normalizePageRotation(-90)).toBe(270);
    expect(normalizePageRotation(450)).toBe(90);
  });

  it("serializes only changed rotations", () => {
    expect(pageRotationsJson(pages)).toBe(JSON.stringify({ 1: 180, 2: 90, 3: 270 }));
  });

  it("builds split options from selected pages", () => {
    expect(buildPageWorkspaceOptions("split-pdf", pages, { splitMode: "selected" })).toEqual({
      splitMode: "ranges",
      ranges: "3; 4"
    });
  });

  it("builds tool-specific processor options", () => {
    expect(buildPageWorkspaceOptions("extract-pages", pages)).toEqual({ pages: "3-4" });
    expect(buildPageWorkspaceOptions("delete-pages", pages)).toEqual({ pages: "3-4" });
    expect(buildPageWorkspaceOptions("rotate-pdf", pages, { rotateAngle: 180 })).toEqual({ angle: "180", pages: "3-4" });
    expect(buildPageWorkspaceOptions("organize-pdf", pages)).toEqual({
      pageOrder: "3,1,4",
      pageRotations: JSON.stringify({ 1: 180, 2: 90, 3: 270 }),
      reverseOrder: false
    });
  });
});
