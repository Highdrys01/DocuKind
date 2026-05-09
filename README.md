# DocuKind

DocuKind is a free browser PDF toolkit that can be hosted on GitHub Pages. It runs PDF work locally in the user's browser, with no uploads, accounts, watermarks, tracking, or server storage.

## Tools

- Merge PDF
- Split PDF
- Organize pages
- Rotate PDF
- Delete pages
- Extract pages
- Images to PDF
- PDF to images
- Watermark
- Page numbers
- Sign PDF
- Metadata clear/update
- Basic compress

Compression is intentionally honest. The default mode rebuilds PDFs losslessly and can remove metadata. Raster scan mode can shrink scanned documents by turning pages into JPEG-backed PDF pages, but it does not preserve selectable text or form fields.

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

## GitHub Pages

This app uses `base: "./"` in `vite.config.ts`, so it can be deployed from any repository path. The included workflow publishes `dist/` with GitHub Pages Actions.

1. Push the repository to GitHub.
2. In repository settings, open Pages.
3. Set Build and deployment source to GitHub Actions.
4. Push to `main` or run the workflow manually.

## Privacy Model

DocuKind does not include a backend. Files are read into browser memory only for the selected action. Generated downloads are created with local `Blob` URLs and object URLs are revoked after use.

## Not Included in v1

Server-grade Office conversion, true PDF repair, full existing-text editing, OCR, and password cracking/unlocking are intentionally out of scope for this static release.

## License

MIT
