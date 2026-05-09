import JSZip from "jszip";
import type { ToolResult } from "../types";

export async function zipResults(results: ToolResult[], zipName = "docukind-results.zip"): Promise<ToolResult> {
  const zip = new JSZip();
  for (const result of results) {
    zip.file(result.filename, result.blob);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return {
    filename: zipName,
    blob,
    summary: `${results.length} files packaged`
  };
}
