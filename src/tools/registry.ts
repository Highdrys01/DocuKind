import type { ToolDefinition, ToolOptions } from "../types";

const positionChoices = [
  { label: "Center", value: "center" },
  { label: "Top left", value: "top-left" },
  { label: "Top center", value: "top-center" },
  { label: "Top right", value: "top-right" },
  { label: "Bottom left", value: "bottom-left" },
  { label: "Bottom center", value: "bottom-center" },
  { label: "Bottom right", value: "bottom-right" }
];

const pageRangeField = (placeholder = "all or 1,3-5") => ({
  name: "pages",
  label: "Pages",
  type: "text" as const,
  defaultValue: "all",
  placeholder,
  help: "Supports all, first, last, odd, even, and ranges like 2-6."
});

export const tools: ToolDefinition[] = [
  {
    id: "merge-pdf",
    title: "Merge PDF",
    category: "Organize",
    tagline: "Combine PDFs in the order shown.",
    icon: "Layers",
    accepts: "application/pdf,.pdf",
    multiple: true,
    minFiles: 2,
    options: [],
    processor: () => import("./processors").then((module) => module.mergePdf)
  },
  {
    id: "split-pdf",
    title: "Split PDF",
    category: "Organize",
    tagline: "Create one file per page or by ranges.",
    icon: "Scissors",
    accepts: "application/pdf,.pdf",
    multiple: false,
    minFiles: 1,
    options: [
      {
        name: "splitMode",
        label: "Mode",
        type: "select",
        defaultValue: "every",
        choices: [
          { label: "Every page", value: "every" },
          { label: "Ranges", value: "ranges" }
        ]
      },
      {
        name: "ranges",
        label: "Ranges",
        type: "textarea",
        defaultValue: "1-2; 3-5",
        placeholder: "1-2; last",
        help: "Use semicolons to make separate files. Supports last, odd, and even.",
        showWhen: (options: ToolOptions) => options.splitMode === "ranges"
      }
    ],
    processor: () => import("./processors").then((module) => module.splitPdf)
  },
  {
    id: "organize-pdf",
    title: "Organize Pages",
    category: "Organize",
    tagline: "Reorder pages with a custom sequence.",
    icon: "LayoutGrid",
    accepts: "application/pdf,.pdf",
    multiple: false,
    minFiles: 1,
    options: [
      {
        name: "pageOrder",
        label: "Page order",
        type: "text",
        defaultValue: "all",
        placeholder: "3,1,2,last or all",
        help: "Repeats are ignored; use custom order, all, first, or last."
      },
      {
        name: "reverseOrder",
        label: "Reverse page order",
        type: "checkbox",
        defaultValue: false
      }
    ],
    processor: () => import("./processors").then((module) => module.organizePdf)
  },
  {
    id: "rotate-pdf",
    title: "Rotate PDF",
    category: "Organize",
    tagline: "Turn selected pages permanently.",
    icon: "RotateCw",
    accepts: "application/pdf,.pdf",
    multiple: false,
    minFiles: 1,
    options: [
      {
        name: "angle",
        label: "Angle",
        type: "select",
        defaultValue: "90",
        choices: [
          { label: "90 degrees", value: "90" },
          { label: "180 degrees", value: "180" },
          { label: "270 degrees", value: "270" }
        ]
      },
      pageRangeField()
    ],
    processor: () => import("./processors").then((module) => module.rotatePdf)
  },
  {
    id: "delete-pages",
    title: "Delete Pages",
    category: "Organize",
    tagline: "Remove unwanted pages.",
    icon: "Trash2",
    accepts: "application/pdf,.pdf",
    multiple: false,
    minFiles: 1,
    options: [pageRangeField("2,4-6")],
    processor: () => import("./processors").then((module) => module.deletePagesPdf)
  },
  {
    id: "extract-pages",
    title: "Extract Pages",
    category: "Organize",
    tagline: "Pull selected pages into a new PDF.",
    icon: "Copy",
    accepts: "application/pdf,.pdf",
    multiple: false,
    minFiles: 1,
    options: [pageRangeField("1,3-5")],
    processor: () => import("./processors").then((module) => module.extractPagesPdf)
  },
  {
    id: "images-to-pdf",
    title: "Images to PDF",
    category: "Convert",
    tagline: "Turn JPG, PNG, or WebP images into pages.",
    icon: "Images",
    accepts: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
    multiple: true,
    minFiles: 1,
    options: [
      {
        name: "pageSize",
        label: "Page size",
        type: "select",
        defaultValue: "auto",
        choices: [
          { label: "Auto", value: "auto" },
          { label: "A4", value: "a4" },
          { label: "Letter", value: "letter" },
          { label: "Square", value: "square" }
        ]
      },
      {
        name: "fit",
        label: "Image fit",
        type: "select",
        defaultValue: "contain",
        choices: [
          { label: "Contain", value: "contain" },
          { label: "Cover", value: "cover" },
          { label: "Stretch", value: "stretch" }
        ]
      },
      {
        name: "margin",
        label: "Margin",
        type: "number",
        defaultValue: 24,
        min: 0,
        max: 144,
        step: 6
      },
      {
        name: "backgroundColor",
        label: "Background",
        type: "color",
        defaultValue: "#ffffff",
        help: "Used behind transparent PNG/WebP images."
      }
    ],
    processor: () => import("./processors").then((module) => module.imagesToPdf)
  },
  {
    id: "pdf-to-images",
    title: "PDF to Images",
    category: "Convert",
    tagline: "Export pages as PNG or JPG.",
    icon: "Image",
    accepts: "application/pdf,.pdf",
    multiple: false,
    minFiles: 1,
    options: [
      pageRangeField(),
      {
        name: "format",
        label: "Format",
        type: "select",
        defaultValue: "png",
        choices: [
          { label: "PNG", value: "png" },
          { label: "JPG", value: "jpeg" }
        ]
      },
      {
        name: "scale",
        label: "Scale",
        type: "range",
        defaultValue: 1.5,
        min: 0.7,
        max: 3,
        step: 0.1
      },
      {
        name: "quality",
        label: "JPG quality",
        type: "range",
        defaultValue: 0.86,
        min: 0.35,
        max: 0.95,
        step: 0.01,
        showWhen: (options: ToolOptions) => options.format === "jpeg"
      }
    ],
    processor: () => import("./processors").then((module) => module.pdfToImages)
  },
  {
    id: "watermark",
    title: "Watermark",
    category: "Edit",
    tagline: "Stamp text across selected pages.",
    icon: "Droplets",
    accepts: "application/pdf,.pdf",
    multiple: false,
    minFiles: 1,
    options: [
      { name: "text", label: "Text", type: "text", defaultValue: "DRAFT", placeholder: "DRAFT" },
      pageRangeField(),
      { name: "position", label: "Position", type: "select", defaultValue: "center", choices: positionChoices },
      { name: "size", label: "Size", type: "number", defaultValue: 42, min: 8, max: 160, step: 2 },
      { name: "opacity", label: "Opacity", type: "range", defaultValue: 0.18, min: 0.03, max: 1, step: 0.01 },
      { name: "angle", label: "Angle", type: "number", defaultValue: -32, min: -180, max: 180, step: 1 },
      { name: "color", label: "Color", type: "color", defaultValue: "#f05d5e" },
      { name: "tile", label: "Repeat across page", type: "checkbox", defaultValue: false }
    ],
    processor: () => import("./processors").then((module) => module.watermarkPdf)
  },
  {
    id: "page-numbers",
    title: "Page Numbers",
    category: "Edit",
    tagline: "Add simple page labels.",
    icon: "ListOrdered",
    accepts: "application/pdf,.pdf",
    multiple: false,
    minFiles: 1,
    options: [
      pageRangeField(),
      { name: "startAt", label: "Start at", type: "number", defaultValue: 1, min: 1, max: 9999, step: 1 },
      { name: "position", label: "Position", type: "select", defaultValue: "bottom-center", choices: positionChoices },
      { name: "prefix", label: "Prefix", type: "text", defaultValue: "", placeholder: "Page " },
      { name: "suffix", label: "Suffix", type: "text", defaultValue: "", placeholder: " / 10" },
      { name: "includeTotal", label: "Include total pages", type: "checkbox", defaultValue: false },
      { name: "size", label: "Size", type: "number", defaultValue: 11, min: 6, max: 48, step: 1 },
      { name: "color", label: "Color", type: "color", defaultValue: "#1f2a24" }
    ],
    processor: () => import("./processors").then((module) => module.pageNumbersPdf)
  },
  {
    id: "sign-pdf",
    title: "Sign PDF",
    category: "Sign",
    tagline: "Apply a typed signature locally.",
    icon: "PenLine",
    accepts: "application/pdf,.pdf",
    multiple: false,
    minFiles: 1,
    options: [
      { name: "signatureText", label: "Signature", type: "text", defaultValue: "", placeholder: "Your name" },
      pageRangeField("last page number or all"),
      { name: "position", label: "Position", type: "select", defaultValue: "bottom-right", choices: positionChoices },
      { name: "size", label: "Size", type: "number", defaultValue: 28, min: 8, max: 96, step: 2 },
      { name: "color", label: "Color", type: "color", defaultValue: "#1f2a24" },
      { name: "includeDate", label: "Include date", type: "checkbox", defaultValue: false }
    ],
    processor: () => import("./processors").then((module) => module.signPdf)
  },
  {
    id: "metadata",
    title: "Metadata",
    category: "Edit",
    tagline: "Clear or update document properties.",
    icon: "Tags",
    accepts: "application/pdf,.pdf",
    multiple: false,
    minFiles: 1,
    options: [
      {
        name: "mode",
        label: "Mode",
        type: "select",
        defaultValue: "clear",
        choices: [
          { label: "Clear metadata", value: "clear" },
          { label: "Set metadata", value: "set" }
        ]
      },
      { name: "title", label: "Title", type: "text", defaultValue: "", showWhen: (options) => options.mode === "set" },
      { name: "author", label: "Author", type: "text", defaultValue: "", showWhen: (options) => options.mode === "set" },
      { name: "subject", label: "Subject", type: "text", defaultValue: "", showWhen: (options) => options.mode === "set" },
      { name: "keywords", label: "Keywords", type: "text", defaultValue: "", placeholder: "invoice, signed", showWhen: (options) => options.mode === "set" }
    ],
    processor: () => import("./processors").then((module) => module.metadataPdf)
  },
  {
    id: "compress",
    title: "Basic Compress",
    category: "Optimize",
    tagline: "Rebuild PDFs or rasterize scans.",
    icon: "Archive",
    accepts: "application/pdf,.pdf",
    multiple: false,
    minFiles: 1,
    options: [
      {
        name: "mode",
        label: "Mode",
        type: "select",
        defaultValue: "lossless",
        choices: [
          { label: "Lossless rebuild", value: "lossless" },
          { label: "Raster scan", value: "raster" }
        ],
        help: "Use raster only for scanned PDFs when smaller files matter more than selectable text."
      },
      { name: "removeMetadata", label: "Remove metadata", type: "checkbox", defaultValue: true, showWhen: (options) => options.mode === "lossless" },
      { name: "rasterScale", label: "Raster scale", type: "range", defaultValue: 1.1, min: 0.6, max: 2.2, step: 0.1, showWhen: (options) => options.mode === "raster" },
      { name: "jpegQuality", label: "JPG quality", type: "range", defaultValue: 0.68, min: 0.2, max: 0.95, step: 0.01, showWhen: (options) => options.mode === "raster" }
    ],
    processor: () => import("./processors").then((module) => module.compressPdf)
  }
];

export function getTool(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id);
}

export function defaultOptionsFor(tool: ToolDefinition): ToolOptions {
  return Object.fromEntries(tool.options.map((option) => [option.name, option.defaultValue]));
}

export const categories = Array.from(new Set(tools.map((tool) => tool.category)));
