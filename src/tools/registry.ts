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

const imageAccepts = "image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif";
const wordAccepts = "application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx,.odt,.rtf";
const powerpointAccepts = "application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,.ppt,.pptx,.odp";
const spreadsheetAccepts = "application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,.xls,.xlsx,.ods,.csv";

const outputFormatChoices = [
  { label: "PNG", value: "png" },
  { label: "JPG", value: "jpeg" },
  { label: "WebP", value: "webp" }
];

const aspectRatioChoices = [
  { label: "Free", value: "free" },
  { label: "Square", value: "1:1" },
  { label: "4:3", value: "4:3" },
  { label: "3:2", value: "3:2" },
  { label: "16:9", value: "16:9" }
];

export const tools: ToolDefinition[] = [
  {
    id: "merge-pdf",
    title: "Merge PDF",
    suite: "pdf",
    kind: "pdf",
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
    suite: "pdf",
    kind: "pdf",
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
    suite: "pdf",
    kind: "pdf",
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
    suite: "pdf",
    kind: "pdf",
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
    suite: "pdf",
    kind: "pdf",
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
    suite: "pdf",
    kind: "pdf",
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
    suite: "pdf",
    kind: "pdf",
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
    suite: "pdf",
    kind: "pdf",
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
    id: "pdf-to-word",
    title: "PDF to Word",
    suite: "pdf",
    kind: "local",
    category: "Convert",
    tagline: "Download an offline DOCX converter pack.",
    icon: "Download",
    accepts: "application/pdf,.pdf",
    multiple: false,
    minFiles: 0,
    options: [],
    downloadOnly: true,
    downloadNotice: "High-quality PDF to Word conversion needs a local engine. This pack installs pdf2docx in a private Python environment and converts your PDF on your machine.",
    processor: () => import("./localToolProcessors").then((module) => module.pdfToWordLocalPack)
  },
  {
    id: "word-to-pdf",
    title: "Word to PDF",
    suite: "pdf",
    kind: "local",
    category: "Convert",
    tagline: "Download a local LibreOffice PDF pack.",
    icon: "Download",
    accepts: wordAccepts,
    multiple: false,
    minFiles: 0,
    options: [],
    downloadOnly: true,
    downloadNotice: "Browser-only Word conversion is not professional enough. This pack uses LibreOffice locally for better fidelity and keeps documents off any server.",
    processor: () => import("./localToolProcessors").then((module) => module.wordToPdfLocalPack)
  },
  {
    id: "powerpoint-to-pdf",
    title: "PowerPoint to PDF",
    suite: "pdf",
    kind: "local",
    category: "Convert",
    tagline: "Download an offline presentation converter.",
    icon: "Download",
    accepts: powerpointAccepts,
    multiple: false,
    minFiles: 0,
    options: [],
    downloadOnly: true,
    downloadNotice: "Presentations need layout-aware conversion. This pack runs LibreOffice on your computer so slides stay private and conversion quality is not faked in the browser.",
    processor: () => import("./localToolProcessors").then((module) => module.powerpointToPdfLocalPack)
  },
  {
    id: "excel-to-pdf",
    title: "Excel to PDF",
    suite: "pdf",
    kind: "local",
    category: "Convert",
    tagline: "Download an offline spreadsheet converter.",
    icon: "Download",
    accepts: spreadsheetAccepts,
    multiple: false,
    minFiles: 0,
    options: [],
    downloadOnly: true,
    downloadNotice: "Spreadsheet PDF output depends on the sheet layout engine. This pack uses LibreOffice locally, with no uploads or cloud conversion.",
    processor: () => import("./localToolProcessors").then((module) => module.excelToPdfLocalPack)
  },
  {
    id: "watermark",
    title: "Watermark",
    suite: "pdf",
    kind: "pdf",
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
    suite: "pdf",
    kind: "pdf",
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
    suite: "pdf",
    kind: "pdf",
    category: "Security",
    tagline: "Drag visual signatures anywhere on a PDF.",
    icon: "PenLine",
    accepts: "application/pdf,.pdf",
    multiple: false,
    minFiles: 1,
    options: [],
    processor: () => import("./processors").then((module) => module.signPdf)
  },
  {
    id: "certified-signature-local",
    title: "Certified Digital Signature (Local)",
    suite: "pdf",
    kind: "local",
    category: "Security",
    tagline: "Download a local certificate signing pack.",
    icon: "ShieldCheck",
    accepts: "application/pdf,.pdf",
    multiple: false,
    minFiles: 0,
    options: [],
    downloadOnly: true,
    downloadNotice: "Cryptographic PDF signing needs the user's own certificate and local key handling. This pack uses pyHanko locally and does not claim legal validity beyond the user's certificate authority.",
    processor: () => import("./localToolProcessors").then((module) => module.certifiedSignatureLocalPack)
  },
  {
    id: "metadata",
    title: "Metadata",
    suite: "pdf",
    kind: "pdf",
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
    suite: "pdf",
    kind: "pdf",
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
  },
  {
    id: "compress-image",
    title: "Compress Image",
    suite: "image",
    kind: "image",
    category: "Optimize",
    tagline: "Shrink images with quality controls.",
    icon: "Archive",
    accepts: imageAccepts,
    multiple: true,
    minFiles: 1,
    options: [
      {
        name: "format",
        label: "Output",
        type: "select",
        defaultValue: "auto",
        choices: [{ label: "Auto", value: "auto" }, ...outputFormatChoices]
      },
      {
        name: "preset",
        label: "Preset",
        type: "select",
        defaultValue: "balanced",
        choices: [
          { label: "Balanced", value: "balanced" },
          { label: "Small file", value: "small" },
          { label: "High quality", value: "quality" },
          { label: "Custom", value: "custom" }
        ]
      },
      {
        name: "quality",
        label: "Quality",
        type: "range",
        defaultValue: 0.82,
        min: 0.2,
        max: 0.98,
        step: 0.01,
        showWhen: (options: ToolOptions) => options.preset === "custom" && options.format !== "png"
      },
      { name: "targetSizeKb", label: "Target KB", type: "number", defaultValue: 0, min: 0, max: 20000, step: 10, help: "Optional. Uses quality search first, then dimensions if enabled." },
      { name: "reduceDimensions", label: "Reduce dimensions to hit target", type: "checkbox", defaultValue: true, showWhen: (options: ToolOptions) => Number(options.targetSizeKb) > 0 },
      { name: "maxWidth", label: "Max width", type: "number", defaultValue: 0, min: 0, max: 12000, step: 10, help: "Use 0 to keep original width." },
      { name: "maxHeight", label: "Max height", type: "number", defaultValue: 0, min: 0, max: 12000, step: 10, help: "Use 0 to keep original height." },
      { name: "neverUpscale", label: "Never upscale", type: "checkbox", defaultValue: true },
      {
        name: "backgroundColor",
        label: "JPG background",
        type: "color",
        defaultValue: "#ffffff",
        help: "Used only when JPG output flattens transparent pixels.",
        showWhen: (options: ToolOptions) => options.format === "jpeg"
      },
      { name: "skipLarger", label: "Skip larger output", type: "checkbox", defaultValue: true }
    ],
    processor: () => import("./imageProcessors").then((module) => module.compressImage)
  },
  {
    id: "resize-image",
    title: "Resize Image",
    suite: "image",
    kind: "image",
    category: "Edit",
    tagline: "Resize by pixels or percentage.",
    icon: "Image",
    accepts: imageAccepts,
    multiple: true,
    minFiles: 1,
    options: [
      {
        name: "resizeMode",
        label: "Mode",
        type: "select",
        defaultValue: "pixels",
        choices: [
          { label: "Pixels", value: "pixels" },
          { label: "Percent", value: "percent" }
        ]
      },
      { name: "width", label: "Width", type: "number", defaultValue: 1280, min: 1, max: 12000, step: 1, showWhen: (options) => options.resizeMode !== "percent" },
      { name: "height", label: "Height", type: "number", defaultValue: 720, min: 1, max: 12000, step: 1, showWhen: (options) => options.resizeMode !== "percent" },
      { name: "percent", label: "Percent", type: "range", defaultValue: 50, min: 1, max: 300, step: 1, showWhen: (options) => options.resizeMode === "percent" },
      {
        name: "fit",
        label: "Fit",
        type: "select",
        defaultValue: "inside",
        choices: [
          { label: "Fit inside", value: "inside" },
          { label: "Contain", value: "contain" },
          { label: "Cover", value: "cover" },
          { label: "Stretch", value: "stretch" }
        ],
        showWhen: (options) => options.resizeMode !== "percent"
      },
      { name: "outputFormat", label: "Output", type: "select", defaultValue: "png", choices: outputFormatChoices },
      { name: "quality", label: "Quality", type: "range", defaultValue: 0.9, min: 0.2, max: 0.98, step: 0.01 }
    ],
    processor: () => import("./imageProcessors").then((module) => module.resizeImage)
  },
  {
    id: "crop-image",
    title: "Crop Image",
    suite: "image",
    kind: "image",
    category: "Edit",
    tagline: "Crop with numeric or selected regions.",
    icon: "Scissors",
    accepts: imageAccepts,
    multiple: true,
    minFiles: 1,
    options: [
      { name: "cropRegion", label: "Selected crop", type: "text", defaultValue: "", placeholder: "10%,10%,80%,80%", help: "Drag on the preview or enter x,y,width,height." },
      { name: "aspectRatio", label: "Aspect", type: "select", defaultValue: "free", choices: aspectRatioChoices, help: "Used when dragging on the preview." },
      { name: "x", label: "X", type: "number", defaultValue: 0, min: 0, max: 12000, step: 1, showWhen: (options) => !options.cropRegion },
      { name: "y", label: "Y", type: "number", defaultValue: 0, min: 0, max: 12000, step: 1, showWhen: (options) => !options.cropRegion },
      { name: "cropWidth", label: "Width", type: "number", defaultValue: 400, min: 1, max: 12000, step: 1, showWhen: (options) => !options.cropRegion },
      { name: "cropHeight", label: "Height", type: "number", defaultValue: 400, min: 1, max: 12000, step: 1, showWhen: (options) => !options.cropRegion },
      { name: "outputFormat", label: "Output", type: "select", defaultValue: "png", choices: outputFormatChoices },
      { name: "quality", label: "Quality", type: "range", defaultValue: 0.92, min: 0.2, max: 0.98, step: 0.01 }
    ],
    processor: () => import("./imageProcessors").then((module) => module.cropImage)
  },
  {
    id: "rotate-flip-image",
    title: "Rotate / Flip Image",
    suite: "image",
    kind: "image",
    category: "Edit",
    tagline: "Rotate and mirror images in batches.",
    icon: "RotateCw",
    accepts: imageAccepts,
    multiple: true,
    minFiles: 1,
    options: [
      {
        name: "rotate",
        label: "Rotate",
        type: "select",
        defaultValue: "90",
        choices: [
          { label: "0 degrees", value: "0" },
          { label: "90 degrees", value: "90" },
          { label: "180 degrees", value: "180" },
          { label: "270 degrees", value: "270" }
        ]
      },
      { name: "flipX", label: "Flip horizontal", type: "checkbox", defaultValue: false },
      { name: "flipY", label: "Flip vertical", type: "checkbox", defaultValue: false },
      { name: "outputFormat", label: "Output", type: "select", defaultValue: "png", choices: outputFormatChoices },
      { name: "quality", label: "Quality", type: "range", defaultValue: 0.9, min: 0.2, max: 0.98, step: 0.01 }
    ],
    processor: () => import("./imageProcessors").then((module) => module.rotateFlipImage)
  },
  {
    id: "convert-to-jpg",
    title: "Convert to JPG",
    suite: "image",
    kind: "image",
    category: "Convert",
    tagline: "Convert PNG, WebP, or GIF previews to JPG.",
    icon: "Image",
    accepts: imageAccepts,
    multiple: true,
    minFiles: 1,
    options: [
      { name: "quality", label: "JPG quality", type: "range", defaultValue: 0.9, min: 0.2, max: 0.98, step: 0.01 },
      { name: "backgroundColor", label: "Background", type: "color", defaultValue: "#ffffff", help: "Used behind transparent images." }
    ],
    processor: () => import("./imageProcessors").then((module) => module.convertToJpg)
  },
  {
    id: "convert-from-jpg",
    title: "Convert from JPG",
    suite: "image",
    kind: "image",
    category: "Convert",
    tagline: "Convert JPG to PNG, WebP, or GIF.",
    icon: "Images",
    accepts: "image/jpeg,.jpg,.jpeg",
    multiple: true,
    minFiles: 1,
    options: [
      {
        name: "outputFormat",
        label: "Output",
        type: "select",
        defaultValue: "png",
        choices: [...outputFormatChoices, { label: "GIF", value: "gif" }]
      },
      { name: "quality", label: "Quality", type: "range", defaultValue: 0.9, min: 0.2, max: 0.98, step: 0.01, showWhen: (options) => options.outputFormat !== "gif" },
      { name: "gifDelay", label: "GIF delay", type: "number", defaultValue: 500, min: 20, max: 5000, step: 10, showWhen: (options) => options.outputFormat === "gif" }
    ],
    processor: () => import("./imageProcessors").then((module) => module.convertFromJpg)
  },
  {
    id: "watermark-image",
    title: "Watermark Image",
    suite: "image",
    kind: "image",
    category: "Security",
    tagline: "Stamp text watermarks on images.",
    icon: "Droplets",
    accepts: imageAccepts,
    multiple: true,
    minFiles: 1,
    options: [
      { name: "text", label: "Text", type: "text", defaultValue: "DRAFT", placeholder: "DRAFT" },
      { name: "position", label: "Position", type: "select", defaultValue: "center", choices: positionChoices },
      { name: "size", label: "Size", type: "number", defaultValue: 48, min: 8, max: 300, step: 2 },
      { name: "opacity", label: "Opacity", type: "range", defaultValue: 0.65, min: 0.03, max: 1, step: 0.01 },
      { name: "angle", label: "Angle", type: "number", defaultValue: -22, min: -180, max: 180, step: 1 },
      { name: "color", label: "Color", type: "color", defaultValue: "#ffffff" },
      { name: "repeat", label: "Repeat across image", type: "checkbox", defaultValue: false },
      { name: "outputFormat", label: "Output", type: "select", defaultValue: "png", choices: outputFormatChoices },
      { name: "quality", label: "Quality", type: "range", defaultValue: 0.9, min: 0.2, max: 0.98, step: 0.01 }
    ],
    processor: () => import("./imageProcessors").then((module) => module.watermarkImage)
  },
  {
    id: "meme-generator",
    title: "Meme Generator",
    suite: "image",
    kind: "image",
    category: "Create",
    tagline: "Add bold top and bottom captions.",
    icon: "FileText",
    accepts: imageAccepts,
    multiple: true,
    minFiles: 1,
    options: [
      { name: "topText", label: "Top text", type: "text", defaultValue: "TOP TEXT" },
      { name: "bottomText", label: "Bottom text", type: "text", defaultValue: "BOTTOM TEXT" },
      { name: "fontScale", label: "Text size", type: "range", defaultValue: 0.1, min: 0.04, max: 0.2, step: 0.01 },
      { name: "textColor", label: "Text", type: "color", defaultValue: "#ffffff" },
      { name: "strokeColor", label: "Outline", type: "color", defaultValue: "#000000" },
      { name: "outputFormat", label: "Output", type: "select", defaultValue: "png", choices: outputFormatChoices },
      { name: "quality", label: "Quality", type: "range", defaultValue: 0.92, min: 0.2, max: 0.98, step: 0.01 }
    ],
    processor: () => import("./imageProcessors").then((module) => module.memeGenerator)
  },
  {
    id: "photo-editor",
    title: "Photo Editor",
    suite: "image",
    kind: "image",
    category: "Edit",
    tagline: "Adjust, crop, rotate, and filter images.",
    icon: "Image",
    accepts: imageAccepts,
    multiple: true,
    minFiles: 1,
    options: [
      { name: "cropRegion", label: "Crop region", type: "text", defaultValue: "", placeholder: "10%,10%,80%,80%", help: "Optional. Drag on the preview or enter x,y,width,height." },
      { name: "aspectRatio", label: "Aspect", type: "select", defaultValue: "free", choices: aspectRatioChoices, help: "Used when dragging on the preview." },
      { name: "rotate", label: "Rotate", type: "select", defaultValue: "0", choices: [{ label: "0 degrees", value: "0" }, { label: "90 degrees", value: "90" }, { label: "180 degrees", value: "180" }, { label: "270 degrees", value: "270" }] },
      { name: "flipX", label: "Flip horizontal", type: "checkbox", defaultValue: false },
      { name: "flipY", label: "Flip vertical", type: "checkbox", defaultValue: false },
      { name: "brightness", label: "Brightness", type: "range", defaultValue: 100, min: 0, max: 200, step: 1 },
      { name: "contrast", label: "Contrast", type: "range", defaultValue: 100, min: 0, max: 200, step: 1 },
      { name: "saturation", label: "Saturation", type: "range", defaultValue: 100, min: 0, max: 250, step: 1 },
      { name: "blur", label: "Blur", type: "range", defaultValue: 0, min: 0, max: 20, step: 1 },
      { name: "grayscale", label: "Grayscale", type: "checkbox", defaultValue: false },
      { name: "sepia", label: "Sepia", type: "checkbox", defaultValue: false },
      { name: "outputFormat", label: "Output", type: "select", defaultValue: "png", choices: outputFormatChoices },
      { name: "quality", label: "Quality", type: "range", defaultValue: 0.9, min: 0.2, max: 0.98, step: 0.01 }
    ],
    processor: () => import("./imageProcessors").then((module) => module.photoEditor)
  },
  {
    id: "blur-redact-image",
    title: "Blur / Redact Image",
    suite: "image",
    kind: "image",
    category: "Security",
    tagline: "Manually hide private regions.",
    icon: "LayoutGrid",
    accepts: imageAccepts,
    multiple: true,
    minFiles: 1,
    options: [
      { name: "regions", label: "Regions", type: "textarea", defaultValue: "", placeholder: "10%,10%,35%,20%", help: "Drag on the preview or enter x,y,width,height. Separate multiple regions with semicolons." },
      { name: "mode", label: "Mode", type: "select", defaultValue: "blur", choices: [{ label: "Blur", value: "blur" }, { label: "Redact", value: "redact" }] },
      { name: "blurAmount", label: "Blur amount", type: "range", defaultValue: 14, min: 1, max: 40, step: 1, showWhen: (options) => options.mode !== "redact" },
      { name: "redactColor", label: "Redact color", type: "color", defaultValue: "#111111", showWhen: (options) => options.mode === "redact" },
      { name: "outputFormat", label: "Output", type: "select", defaultValue: "png", choices: outputFormatChoices },
      { name: "quality", label: "Quality", type: "range", defaultValue: 0.9, min: 0.2, max: 0.98, step: 0.01 }
    ],
    processor: () => import("./imageProcessors").then((module) => module.blurRedactImage)
  }
];

export function getTool(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id);
}

export function defaultOptionsFor(tool: ToolDefinition): ToolOptions {
  return Object.fromEntries(tool.options.map((option) => [option.name, option.defaultValue]));
}

export const categories = Array.from(new Set(tools.map((tool) => tool.category)));
