import { describe, expect, it } from "vitest";
import { formatPageLabel, parsePageSelection, parseRangeGroups } from "./pageRanges";

describe("page range parsing", () => {
  it("returns all pages for empty or all", () => {
    expect(parsePageSelection("", 3)).toEqual([0, 1, 2]);
    expect(parsePageSelection("all", 2)).toEqual([0, 1]);
  });

  it("parses mixed page values and ranges", () => {
    expect(parsePageSelection("1, 3-5, 2", 6)).toEqual([0, 2, 3, 4, 1]);
  });

  it("supports descending ranges", () => {
    expect(parsePageSelection("4-2", 4)).toEqual([3, 2, 1]);
  });

  it("rejects pages outside the document", () => {
    expect(() => parsePageSelection("1,9", 4)).toThrow("outside");
  });

  it("splits semicolon-delimited groups", () => {
    expect(parseRangeGroups("1-2; 4", 4)).toEqual([[0, 1], [3]]);
  });

  it("formats labels as user-facing page numbers", () => {
    expect(formatPageLabel([0, 2, 3])).toBe("1-3-4");
  });
});
