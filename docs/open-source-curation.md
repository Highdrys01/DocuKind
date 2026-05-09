# Open-Source Curation

Last reviewed: 2026-05-09

DocuKind can learn from focused open-source tools, but every candidate has to pass the product gate before it can shape the app. The goal is not to clone whole projects. The goal is to select permissive, browser-safe libraries or implementation ideas, then adapt them into DocuKind's own UI, processor interface, privacy model, and tests.

## Policy

- Allowed for direct use: MIT, Apache-2.0, BSD, ISC, and similarly permissive licenses.
- Research-only unless explicitly approved: GPL, LGPL, AGPL, commercial, unclear, or mixed-code repositories.
- Every direct dependency needs a notice entry in `THIRD_PARTY_NOTICES.md`.
- No analytics, hosted APIs, remote workers, server callbacks, or cloud conversion.
- Prefer focused libraries over full app vendor drops.
- Add tests before a candidate graduates from "evaluate" to "adopted".
- If a strong tool cannot run safely in the browser, it may graduate as a local download pack instead of a bundled web dependency.

## Scorecard

Each candidate is scored from 1 to 5 in six areas:

- License safety
- Browser-only feasibility
- Maintenance signal
- Output quality
- Bundle/runtime cost
- Fit with `runTool(files, options)`

Adopted candidates should average 4 or better, with no score below 3 in license safety or browser feasibility.

## Candidate Matrix

| Candidate | Area | License posture | Score | Decision | DocuKind use |
| --- | --- | --- | ---: | --- | --- |
| [pdf-lib](https://pdf-lib.js.org/) | PDF edit/create | MIT, verified direct dep | 5 | Adopted | Core PDF creation, page copy, rotation, metadata, drawing. |
| [PDF.js](https://github.com/mozilla/pdf.js) | PDF render | Apache-2.0, verified direct dep | 5 | Adopted | PDF thumbnails and PDF-to-image rendering. |
| [pica](https://github.com/nodeca/pica) | Image resize | MIT, verified direct dep | 5 | Adopted | High-quality browser resampling for resize/compress flows. |
| [gifenc](https://github.com/mattdesl/gifenc) | GIF encode | MIT, verified direct dep | 4 | Adopted | GIF export from JPG frames. |
| [JSZip](https://github.com/Stuk/jszip) | ZIP output | MIT option, verified direct dep | 4 | Adopted | Multi-file download packaging. |
| [Cropper.js](https://github.com/fengyuanchen/cropperjs) | Crop UX | MIT | 5 | Evaluate patterns | Use as a benchmark for aspect ratios, touch behavior, and crop affordances. |
| [Filerobot Image Editor](https://github.com/scaleflex/filerobot-image-editor) | Photo editor UX | MIT | 4 | Evaluate patterns | Study undo/reset, comparison, filters, annotation UX; do not vendor full app yet. |
| [Fabric.js](https://fabricjs.com/) | Canvas editor | MIT, verify before install | 4 | Evaluate if needed | Candidate for object-level annotations/text/shapes if DocuKind outgrows simple canvas helpers. |
| [UPNG.js](https://github.com/photopea/UPNG.js) | PNG/APNG encode | MIT, verified direct dep | 4 | Adopted | Color-quantized PNG compression for Compress Image when Small file or Target KB is selected. |
| [browser-image-compression](https://npm.io/package/browser-image-compression) | Compression workflow | MIT | 4 | Evaluate patterns | Target-size compression and worker-style non-blocking ideas. |
| [image-blob-reduce](https://github.com/nodeca/image-blob-reduce) | Image orientation/reduce | MIT, verify before install | 4 | Evaluate next | EXIF-aware image reduction before canvas processing. |
| [exifr](https://github.com/MikeKovarik/exifr) | EXIF read | MIT, verify before install | 4 | Evaluate next | Read orientation/metadata locally without retaining file contents. |
| [Compressor.js](https://github.com/fengyuanchen/compressorjs) | Image compression | MIT, verify before install | 3 | Compare only | Compare output and options against current pica/canvas approach. |
| [Konva](https://github.com/konvajs/konva) | Canvas objects | MIT, verify before install | 4 | Evaluate later | Alternative to Fabric for annotations, shapes, and selections. |
| [TUI Image Editor](https://github.com/nhn/tui.image-editor) | Image editor app | MIT with analytics caveat | 2 | Research only | Avoid direct adoption unless analytics are removed and bundle impact is acceptable. |
| [Squoosh](https://github.com/GoogleChromeLabs/squoosh) | Image codecs | Apache-2.0 plus codec licenses | 3 | Research only | Study codec UX; verify each codec license and bundle cost before use. |
| [jsPDF](https://github.com/parallax/jsPDF) | PDF create | MIT, verify before install | 3 | Compare only | pdf-lib already covers the current browser PDF creation needs. |
| [pdfmake](https://github.com/bpampuch/pdfmake) | PDF layout | MIT, verify before install | 3 | Evaluate later | Candidate only if DocuKind adds template-based document generation. |
| [PDFKit](https://github.com/foliojs/pdfkit) | PDF create | MIT, verify before install | 2 | Defer | Node-oriented and overlaps with pdf-lib. |
| [pdf2docx](https://github.com/ArtifexSoftware/pdf2docx) | PDF to Word | MIT in current Artifex release, user-installed in local pack | 3 | Local pack | Used by the PDF to Word download pack, not bundled into the browser app. Best for digital PDFs. |
| [LibreOffice](https://www.libreoffice.org/) | Office to PDF | MPL-2.0 / open-source suite, user-installed | 3 | Local pack | Used by Word/PPT/Excel to PDF download packs through local headless conversion. Not bundled. |
| [pyHanko](https://docs.pyhanko.eu/) / [pyhanko-cli](https://pypi.org/project/pyhanko-cli/) | Certified PDF signing | MIT, user-installed in local pack | 4 | Local pack | Used by the Certified Digital Signature pack for local PKCS#12 signing with optional visible fields and timestamp URLs. Not bundled into the browser app. |
| [canvg](https://github.com/canvg/canvg) | SVG render | MIT, verify before install | 4 | Evaluate later | Possible SVG-to-image/PDF workflows. |
| [SVGO](https://github.com/svg/svgo) | SVG optimize | MIT, verify before install | 3 | Evaluate later | Only relevant if SVG tools are added. |
| [heic2any](https://github.com/alexcorvi/heic2any) | HEIC convert | MIT, verify before install | 3 | Guarded evaluate | Only ship HEIC if decoding is tested across target browsers. |
| [UTIF.js](https://github.com/photopea/UTIF.js) | TIFF decode | MIT, verify before install | 3 | Guarded evaluate | Possible TIFF import, with browser memory warnings. |
| [fflate](https://github.com/101arrowz/fflate) | ZIP/deflate | MIT, verify before install | 4 | Compare later | Potential lighter/faster ZIP replacement if JSZip becomes a bottleneck. |
| [StreamSaver.js](https://github.com/jimmywarting/StreamSaver.js) | Large downloads | MIT, verify before install | 3 | Evaluate later | Useful only if local Blob downloads hit memory limits. |
| [FileSaver.js](https://github.com/eligrey/FileSaver.js) | Downloads | MIT, verify before install | 2 | Not needed | Current Blob download helper is enough. |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | OCR | Apache-2.0, verify before install | 2 | Research only | Heavy OCR is out of v1 unless a dedicated local OCR mode is designed and tested. |
| [OpenCV.js](https://docs.opencv.org/) | Image CV | Apache-2.0, verify packages | 2 | Research only | Too heavy for basic static tools; revisit for advanced local processing. |
| [PDFCraft](https://github.com/PDFCraftTool/pdfcraft) | Browser PDF suite | AGPL-3.0 | 1 | Research only | Do not copy or vendor; can inspire non-code UX ideas only. |
| [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) | PDF suite | GPL-family/server app | 1 | Research only | Server-oriented and license-incompatible for direct use. |
| [pdfcpu](https://github.com/pdfcpu/pdfcpu) | PDF CLI/lib | Apache-2.0, Go | 2 | Research only | Not browser-native; could inspire behavior for future backend, not static v1. |
| [qpdf](https://github.com/qpdf/qpdf) | PDF repair/encrypt | Apache-2.0, native/CLI | 2 | Research only | Not a drop-in browser dependency; no fake repair/unlock promises. |

## Current Adoption Notes

- DocuKind already uses the strongest PDF core choices: pdf-lib for modification and PDF.js for rendering.
- Image quality now follows the focused-library approach: pica handles resizing, UPNG.js handles optional PNG color quantization, and DocuKind owns the workflow and UI.
- Cropper.js is used as a UX benchmark, not copied. DocuKind now has its own aspect-ratio-aware region selector.
- browser-image-compression is used as a workflow benchmark, not copied. DocuKind now supports target-size compression for JPG/WebP output and transparent PNG/WebP-safe compression behavior.
- Backend-grade conversion is now treated as local tooling instead of fake browser tooling. PDF to Word, Word to PDF, PowerPoint to PDF, and Excel to PDF generate tool-specific ZIP packs with local scripts and honest requirements.
- Visual Sign PDF stays browser-only and embeds appearances with pdf-lib. Certified cryptographic signing is deliberately separate as a pyHanko local pack, because a static site cannot issue certificates, verify identity, or promise qualified/eIDAS legal status by itself.

## Next Upgrade Queue

1. Evaluate image-blob-reduce or exifr for EXIF orientation handling before image canvas decode.
2. Prototype undo/reset and compare-view UX for Photo Editor using DocuKind's own canvas pipeline.
3. Evaluate Fabric.js or Konva only if object-level annotations become a product requirement.
4. Keep AGPL/GPL/server projects research-only unless the product strategy changes.
