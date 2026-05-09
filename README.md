# DocuKind

DocuKind is a free browser PDF toolkit that can be hosted on GitHub Pages. It runs PDF work locally in the user's browser, with no uploads, accounts, watermarks, tracking, or server storage.

## Use the App

After GitHub Pages is enabled, the public app will be available at:

```text
https://highdrys01.github.io/PDF-IMG/
```

Basic workflow:

1. Open DocuKind in a modern browser.
2. Choose a PDF tool from the dashboard.
3. Add your PDF or image files.
4. Adjust the tool settings if needed.
5. Select **Run**.
6. Download the output file, or use **ZIP all** when a tool creates multiple files.

Your files stay on your device. DocuKind is a static browser app, so it does not upload PDFs to a server.

## Tools

- **Merge PDF**: combine multiple PDFs into one file in the order shown.
- **Split PDF**: create one PDF per page or split by custom ranges.
- **Organize pages**: reorder pages with a custom sequence like `3,1,2`.
- **Rotate PDF**: rotate all pages or selected pages.
- **Delete pages**: remove unwanted pages.
- **Extract pages**: save selected pages as a new PDF.
- **Images to PDF**: turn JPG, PNG, or WebP images into PDF pages.
- **PDF to images**: export selected pages as PNG or JPG files.
- **Watermark**: add text watermarks with position, color, size, angle, and opacity controls.
- **Page numbers**: add simple page labels with custom prefix/suffix.
- **Sign PDF**: place a typed signature on selected pages.
- **Metadata**: clear or set title, author, subject, and keywords.
- **Basic compress**: rebuild PDFs losslessly or rasterize scanned PDFs.

Compression is intentionally honest. The default mode rebuilds PDFs losslessly and can remove metadata. Raster scan mode can shrink scanned documents by turning pages into JPEG-backed PDF pages, but it does not preserve selectable text or form fields.

## Page Ranges

Tools that ask for pages support:

- `all` for the whole document
- `1,3,5` for individual pages
- `2-6` for a page range
- `1,3-5,8` for mixed selections
- `1-2; 3-5` in Split PDF range mode to create separate output files

Page numbers are user-facing and start at `1`.

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm test
npm run build
```

The production files are emitted to `dist/`.

## Smoke Test

The Playwright smoke test opens the built app, checks the dashboard, uploads generated PDFs, verifies thumbnails render, and runs the merge flow.

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
7. Open `https://highdrys01.github.io/PDF-IMG/`.

First deploy note: if the workflow fails with `Not Found` during **Configure Pages** or **Deploy to GitHub Pages**, Pages is still disabled for the repository. Open `https://github.com/Highdrys01/PDF-IMG/settings/pages`, set the source to **GitHub Actions**, then rerun the workflow.

## Privacy Model

DocuKind does not include a backend. Files are read into browser memory only for the selected action. Generated downloads are created with local `Blob` URLs and object URLs are revoked after use.

## Browser Support

Use a current version of Chrome, Edge, Firefox, or Safari. Very large PDFs may be limited by the user's device memory because all processing happens locally.

## Not Included in v1

Server-grade Office conversion, true PDF repair, full existing-text editing, OCR, and password cracking/unlocking are intentionally out of scope for this static release.

## Troubleshooting

- If downloads do not appear, check the browser's download permissions.
- If a PDF will not open, it may be encrypted, malformed, or too large for the current device.
- If compression makes a file larger, the original PDF was likely already optimized.
- If raster compression is used, selectable text and form fields will not be preserved.
- If GitHub Pages shows a 404, confirm Pages is set to **GitHub Actions** and the deploy workflow completed successfully.

## License

MIT
