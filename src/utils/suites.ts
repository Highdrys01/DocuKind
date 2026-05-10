import type { ToolSuite } from "../types";

export function suiteClassName(suite: ToolSuite): string {
  return `suite-${suite}`;
}

export function suiteToolLabel(suite: ToolSuite): string {
  return suite === "pdf" ? "PDF" : "Image";
}
