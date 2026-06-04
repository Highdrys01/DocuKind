import type { ToolOptions } from "../types";
import { formatPageLabel } from "./pageRanges";

export type PageToolId = "split-pdf" | "extract-pages" | "delete-pages" | "organize-pdf" | "rotate-pdf";

export type WorkspacePage = {
  pageIndex: number;
  selected?: boolean;
  deleted?: boolean;
  rotation?: number;
};

export type PageWorkspaceConfig = {
  splitMode?: "every" | "selected" | "ranges";
  ranges?: string;
  rotateAngle?: number | string;
};

export function pageIndexesToCsv(indexes: number[]): string {
  return indexes.map((index) => String(index + 1)).join(",");
}

export function pageIndexesToRangeText(indexes: number[]): string {
  if (indexes.length === 0) return "";
  const sorted = [...indexes].sort((a, b) => a - b);
  return formatPageLabel(sorted).replaceAll("_", ",");
}

export function selectedPageIndexes(pages: WorkspacePage[]): number[] {
  return pages
    .filter((page) => page.selected && !page.deleted)
    .map((page) => page.pageIndex)
    .sort((a, b) => a - b);
}

export function activePageOrder(pages: WorkspacePage[]): number[] {
  return pages.filter((page) => !page.deleted).map((page) => page.pageIndex);
}

export function pageRotationsJson(pages: WorkspacePage[]): string {
  const rotations = Object.fromEntries(
    pages
      .map((page) => [page.pageIndex, normalizePageRotation(page.rotation ?? 0)] as const)
      .filter(([, rotation]) => rotation !== 0)
  );
  return JSON.stringify(rotations);
}

export function buildPageWorkspaceOptions(
  toolId: PageToolId,
  pages: WorkspacePage[],
  config: PageWorkspaceConfig = {}
): ToolOptions {
  const selected = selectedPageIndexes(pages);

  if (toolId === "split-pdf") {
    const splitMode = config.splitMode ?? "every";
    if (splitMode === "selected") {
      return {
        splitMode: "ranges",
        ranges: selected.map((index) => String(index + 1)).join("; ")
      };
    }
    return {
      splitMode,
      ranges: splitMode === "ranges" ? (config.ranges ?? "") : ""
    };
  }

  if (toolId === "organize-pdf") {
    return {
      pageOrder: pageIndexesToCsv(activePageOrder(pages)),
      pageRotations: pageRotationsJson(pages),
      reverseOrder: false
    };
  }

  if (toolId === "rotate-pdf") {
    return {
      angle: String(config.rotateAngle ?? 90),
      pages: pageIndexesToRangeText(selected)
    };
  }

  return {
    pages: pageIndexesToRangeText(selected)
  };
}

export function normalizePageRotation(value: number): number {
  return ((Math.round(value / 90) * 90) % 360 + 360) % 360;
}
