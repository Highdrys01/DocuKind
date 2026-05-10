# DocuKind

DocuKind is a free browser PDF and image toolkit that can be hosted on GitHub Pages. It runs document and image work locally in the user's browser, with no uploads, accounts, watermarks, tracking, or server storage.

## Use the App

After GitHub Pages is enabled, the public app will be available at:

```text
https://highdrys01.github.io/DocuKind/
```

Basic workflow:

1. Open DocuKind in a modern browser.
2. Use **PDF Tools** for documents or **Image Tools** for image work. `/` and `/pdf` open the PDF suite; `/image` opens the image suite.
3. Add your PDF or image files.
4. Adjust the tool settings if needed.
5. Select **Run**.
6. Download the output file, or use **ZIP all** when a tool creates multiple files.

Your files stay on your device. DocuKind is a static browser app, so it does not upload files to a server.

For tools that need a real desktop conversion engine, DocuKind shows a dedicated PDF tool card that downloads a tool-specific ZIP with scripts and instructions. You run that converter on your own computer.

## Tools

### PDF Tools

- **Merge PDF**: combine multiple PDFs with first-page previews, page counts, drag reorder, clean output naming, and optional blank separator pages for double-sided printing.
- **Split PDF**: create one PDF per page or split by custom ranges.
- **Organize pages**: reorder pages with a custom sequence like `3,1,2`.
- **Rotate PDF**: rotate all pages or selected pages.
- **Delete pages**: remove unwanted pages.
- **Extract pages**: save selected pages as a new PDF.
- **Images to PDF**: turn JPG, PNG, or WebP images into PDF pages with fit, margin, page size, and background controls.
- **PDF to images**: export selected pages as PNG or JPG files.
- **PDF to Word**: download a local pdf2docx-based converter pack for editable DOCX output.
- **Word to PDF**: download a local LibreOffice-based converter pack for DOC, DOCX, ODT, and RTF files.
- **PowerPoint to PDF**: download a local LibreOffice-based converter pack for PPT, PPTX, and ODP presentations.
- **Excel to PDF**: download a local LibreOffice-based converter pack for XLS, XLSX, ODS, and CSV spreadsheets.
- **Watermark**: add single or repeating text watermarks with position, color, size, angle, and opacity controls.
- **Page numbers**: add simple page labels with custom prefix/suffix and optional total page count.
- **Sign PDF**: use a visual signing workspace with page preview, thumbnails, typed/drawn/uploaded signature appearances, initials, name, date, custom text, color choices, drag placement, resizing, nudging, duplicate, delete, and copy-to-page controls.
- **Certified Digital Signature (Local)**: download a local pyHanko-based pack for cryptographic certificate signing with your own `.p12` or `.pfx` certificate.
- **Metadata**: clear or set title, author, subject, and keywords.
- **Compress PDF**: rebuild PDFs losslessly or rasterize scanned PDFs.

Compression is intentionally honest. The default mode rebuilds PDFs losslessly and can remove metadata. Raster scan mode can shrink scanned documents by turning pages into JPEG-backed PDF pages, but it does not preserve selectable text or form fields.

### Image Tools

- **Compress Image**: shrink JPG, PNG, WebP, or browser-decoded GIF still frames with presets, target-size search, max dimensions, transparency-safe PNG/WebP output, JPG background flattening, and larger-output skipping.
- **Resize Image**: resize one or many images by exact pixels or percentage, using high-quality browser resampling.
- **Crop Image**: crop by typing `x,y,width,height` values or dragging a crop region on the preview, with optional aspect-ratio presets.
- **Rotate / Flip Image**: rotate and mirror images in batches.
- **Convert to JPG**: convert supported browser image formats to JPG with a background color for transparency.
- **Convert from JPG**: convert JPG files to PNG, WebP, or GIF. Multiple JPG files can become one animated GIF.
- **Watermark Image**: stamp single or repeated text watermarks with position, opacity, angle, size, and color controls.
- **Meme Generator**: add top and bottom captions with text and outline colors.
- **Photo Editor**: crop, rotate, flip, adjust brightness, contrast, saturation, blur, grayscale, and sepia, then export.
- **Blur / Redact Image**: manually select private areas and blur or cover them before downloading.

Animated GIF uploads are decoded by the browser as a still preview frame for most image tools. The JPG-to-GIF tool can create a new animated GIF from multiple JPG frames.

### Local Tool Packs

Local packs are for conversion jobs that should not be faked in a browser:

- **PDF to Word** uses Python and pdf2docx. It works best on digital PDFs with selectable text. Scanned PDFs need OCR first.
- **Office to PDF packs** use LibreOffice headless conversion. Install LibreOffice locally, unzip the pack, and run the included macOS/Linux or Windows script.
- **Certified Digital Signature** uses pyHanko locally with your own PKCS#12 certificate. It supports visible signature coordinates and an optional RFC 3161 timestamp URL. Legal validity depends on your certificate authority, jurisdiction, and signing policy; DocuKind does not provide certificates or claim qualified/eIDAS/ESIGN/UETA compliance by itself.

These packs still follow the privacy model: files stay on your machine. The website only generates the ZIP instructions and scripts.

## Page Ranges

Tools that ask for pages support:

- `all` for the whole document
- `first` and `last` for document edges
- `odd` and `even` for alternating pages
- `1,3,5` for individual pages
- `2-6` for a page range
- `1,3-5,8` for mixed selections
- `3-last` for a range that ends at the final page
- `1-2; last` in Split PDF range mode to create separate output files

Page numbers are user-facing and start at `1`.

## Local Development

```bash
npm install
npm run dev
```

## Build And Test

```bash
npm test
npm run build
npm run test:smoke
npm audit
```

The production files are emitted to `dist/`.

## Smoke Test

The Playwright smoke test opens the built app, checks the dashboard, uploads generated PDFs and images, verifies thumbnails render, and runs representative PDF and image flows.

```bash
npm run build
npm run test:smoke
```

## GitHub Pages

This app uses `base: "./"` in `vite.config.ts`, so it can be deployed from any repository path. The included workflow publishes `dist/` with GitHub Pages Actions.

To publish:

1. Open the repository on GitHub.
2. Go to **Settings**.
3. Open **Pages**.
4. Set **Build and deployment** source to **GitHub Actions**.
5. Open the **Actions** tab and run the deploy workflow, or push a new commit to `main`.
6. Wait for the workflow to finish.
7. Open `https://highdrys01.github.io/DocuKind/`.

First deploy note: if the workflow fails with `Not Found` during **Configure Pages** or **Deploy to GitHub Pages**, Pages is still disabled for the repository. Open `https://github.com/Highdrys01/DocuKind/settings/pages`, set the source to **GitHub Actions**, then rerun the workflow.

## Privacy Model

DocuKind does not include a backend. Files are read into browser memory only for browser-safe actions. Generated downloads are created with local `Blob` URLs and object URLs are revoked after use.

The uploader filters unsupported file types before processing. For example, PDF tools accept PDFs only, image tools accept browser-supported image formats, and Images to PDF accepts supported image files only.

Local tool packs are downloaded as ZIP files and run separately by the user. They are not cloud jobs and do not send documents to DocuKind.

## Open-Source Curation

DocuKind uses permissively licensed open-source libraries as engines, not as cloned full apps. See `docs/open-source-curation.md` for the candidate scorecard and `THIRD_PARTY_NOTICES.md` for direct dependency notices. GPL/AGPL projects are research-only unless the policy is explicitly changed.

## Browser Support

Use a current version of Chrome, Edge, Firefox, or Safari. Very large PDFs or images may be limited by the user's device memory because all processing happens locally.

## Not Included in v1

Server-grade conversion is handled as local download packs when a good offline engine exists. True PDF repair, full existing-text editing, OCR, AI upscaling, background removal, URL-based HTML to image, automatic face blur, and password cracking/unlocking remain intentionally out of scope for the browser app until they can be done honestly.

## Troubleshooting

- If downloads do not appear, check the browser's download permissions.
- If a PDF will not open, it may be encrypted, malformed, or too large for the current device.
- If compression makes a file larger, the original PDF was likely already optimized.
- If an image tool will not run, the image may be too large for the browser canvas memory available on the current device.
- If raster compression is used, selectable text and form fields will not be preserved.
- If GitHub Pages shows a 404, confirm Pages is set to **GitHub Actions** and the deploy workflow completed successfully.
- If you renamed the repository, use the new project URL. The old `/PDF-IMG/` path will 404 after the repo is renamed to `DocuKind`.
- If a local pack will not run, confirm the pack's README requirements are installed. PDF-to-Word needs Python 3.10+. Office-to-PDF packs need Python 3 and LibreOffice.
- If the certified signing pack will not run, confirm Python 3.10+, `pyhanko-cli`, your certificate file, and certificate password/passfile are available locally.

## License

MIT
