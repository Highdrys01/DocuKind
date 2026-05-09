# Third-Party Notices

DocuKind is built from original application code plus permissively licensed open-source dependencies. Candidate projects listed in `docs/open-source-curation.md` are not bundled unless they also appear in `package.json`.

## Runtime Dependencies

| Package | License | Purpose | Source |
| --- | --- | --- | --- |
| React | MIT | User interface runtime. | https://react.dev/ |
| React DOM | MIT | Browser rendering for React. | https://react.dev/ |
| lucide-react | ISC | Interface icons. | https://lucide.dev/ |
| pdf-lib | MIT | Local PDF creation and modification. | https://pdf-lib.js.org/ |
| pdfjs-dist / PDF.js | Apache-2.0 | Local PDF parsing and rendering previews. | https://github.com/mozilla/pdf.js |
| JSZip | MIT OR GPL-3.0-or-later | ZIP generation; DocuKind uses the MIT license option. | https://github.com/Stuk/jszip |
| pica | MIT | High-quality browser image resizing. | https://github.com/nodeca/pica |
| UPNG.js / upng-js | MIT | PNG color-quantized compression for the Compress Image tool. | https://github.com/photopea/UPNG.js |
| gifenc | MIT | Browser GIF encoding. | https://github.com/mattdesl/gifenc |

## Local Tool Pack References

These tools are not bundled in the browser app. DocuKind generates optional ZIP packs that ask the user to install and run them locally.

| Tool | License posture | Purpose | Source |
| --- | --- | --- | --- |
| pdf2docx | MIT in current Artifex release, installed by the user in a local Python environment. | PDF to Word local conversion pack. | https://github.com/ArtifexSoftware/pdf2docx |
| LibreOffice | MPL-2.0/open-source office suite, installed by the user separately. | Word, PowerPoint, and Excel to PDF local conversion packs. | https://www.libreoffice.org/ |
| pyHanko / pyhanko-cli | MIT, installed by the user in a local Python environment. | Certified Digital Signature local signing pack for PKCS#12 certificates and optional timestamping. | https://docs.pyhanko.eu/ |

## Development Dependencies

| Package | License | Purpose | Source |
| --- | --- | --- | --- |
| Vite | MIT | Build tooling and local dev server. | https://vite.dev/ |
| TypeScript | Apache-2.0 | Type checking. | https://www.typescriptlang.org/ |
| Vitest | MIT | Unit tests. | https://vitest.dev/ |
| Playwright | Apache-2.0 | Browser smoke tests. | https://playwright.dev/ |

## Curation Rules

- Direct use is limited to permissive licenses such as MIT, Apache-2.0, BSD, and ISC.
- GPL/AGPL projects may be studied for public behavior and UX patterns, but their code is not copied into DocuKind.
- Full external apps are not vendored. Reusable libraries or rewritten ideas must fit DocuKind's local-only processor architecture.
- Any future direct dependency must be added to this notice file in the same commit that introduces it.
