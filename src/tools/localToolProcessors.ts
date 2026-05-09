import JSZip from "jszip";
import type { ToolProcessor } from "../types";
import { resultFromBlob } from "../utils/file";

type PackFile = {
  path: string;
  content: string;
  executable?: boolean;
};

type LocalToolPack = {
  filename: string;
  summary: string;
  files: PackFile[];
};

function normalizeText(content: string): string {
  return content.trimStart().replace(/\s+$/u, "") + "\n";
}

async function buildPack(pack: LocalToolPack) {
  const zip = new JSZip();

  for (const file of pack.files) {
    zip.file(file.path, normalizeText(file.content), {
      unixPermissions: file.executable ? 0o755 : 0o644
    });
  }

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    platform: "UNIX"
  });

  return [resultFromBlob(pack.filename, blob, pack.summary)];
}

export const pdfToWordLocalPack: ToolProcessor = async () => {
  return buildPack({
    filename: "docukind-pdf-to-word-local.zip",
    summary: "Local PDF to Word pack. Runs on the user's computer with Python and pdf2docx; no files are uploaded.",
    files: [
      {
        path: "README.md",
        content: pdfToWordReadme
      },
      {
        path: "requirements.txt",
        content: "pdf2docx==0.5.12"
      },
      {
        path: "convert_pdf_to_word.py",
        content: pdfToWordPython,
        executable: true
      },
      {
        path: "run-mac-linux.sh",
        content: pdfToWordShell,
        executable: true
      },
      {
        path: "run-windows.bat",
        content: pdfToWordBatch
      }
    ]
  });
};

export const wordToPdfLocalPack: ToolProcessor = async () => {
  return buildPack(createOfficeToPdfPack({
    filename: "docukind-word-to-pdf-local.zip",
    title: "Word to PDF Local Pack",
    inputLabel: "Word document",
    extensions: [".doc", ".docx", ".odt", ".rtf"],
    exampleInput: "proposal.docx"
  }));
};

export const powerpointToPdfLocalPack: ToolProcessor = async () => {
  return buildPack(createOfficeToPdfPack({
    filename: "docukind-powerpoint-to-pdf-local.zip",
    title: "PowerPoint to PDF Local Pack",
    inputLabel: "presentation",
    extensions: [".ppt", ".pptx", ".odp"],
    exampleInput: "deck.pptx"
  }));
};

export const excelToPdfLocalPack: ToolProcessor = async () => {
  return buildPack(createOfficeToPdfPack({
    filename: "docukind-excel-to-pdf-local.zip",
    title: "Excel to PDF Local Pack",
    inputLabel: "spreadsheet",
    extensions: [".xls", ".xlsx", ".ods", ".csv"],
    exampleInput: "report.xlsx"
  }));
};

function createOfficeToPdfPack(config: {
  filename: string;
  title: string;
  inputLabel: string;
  extensions: string[];
  exampleInput: string;
}): LocalToolPack {
  const extensions = config.extensions.join(", ");
  const script = officeToPdfPython.replace("__SUPPORTED_EXTENSIONS__", JSON.stringify(config.extensions));

  return {
    filename: config.filename,
    summary: `${config.title}. Runs locally with LibreOffice headless conversion; no files are uploaded.`,
    files: [
      {
        path: "README.md",
        content: officeToPdfReadme(config.title, config.inputLabel, extensions, config.exampleInput)
      },
      {
        path: "convert_office_to_pdf.py",
        content: script,
        executable: true
      },
      {
        path: "run-mac-linux.sh",
        content: officeToPdfShell,
        executable: true
      },
      {
        path: "run-windows.bat",
        content: officeToPdfBatch
      }
    ]
  };
}

const pdfToWordReadme = `
# DocuKind PDF to Word Local Pack

This pack converts a PDF into a DOCX file on your own computer. It is for PDFs with real selectable text, tables, and vector layout. Scanned PDFs are images; run OCR first if you need editable scanned text.

## What It Uses

- Python 3.10+
- pdf2docx, an open-source Python converter

DocuKind does not upload, store, or inspect your files. This pack runs locally after you download it.

## macOS / Linux

1. Unzip this folder.
2. Open a terminal in the folder.
3. Run:

\`\`\`sh
chmod +x run-mac-linux.sh
./run-mac-linux.sh "/path/to/input.pdf"
\`\`\`

Optional custom output:

\`\`\`sh
./run-mac-linux.sh "/path/to/input.pdf" "/path/to/output.docx"
\`\`\`

## Windows

1. Install Python 3.10 or newer from https://www.python.org/downloads/ and enable "Add Python to PATH".
2. Unzip this folder.
3. Double-click Command Prompt in this folder, or open PowerShell here.
4. Run:

\`\`\`bat
run-windows.bat "C:\\path\\to\\input.pdf"
\`\`\`

Optional custom output:

\`\`\`bat
run-windows.bat "C:\\path\\to\\input.pdf" "C:\\path\\to\\output.docx"
\`\`\`

## Quality Notes

- Best: digital PDFs with selectable text.
- Good: forms and simple tables, depending on how the PDF was created.
- Limited: scans, photos of documents, complex page art, and unusual fonts.
- Private: files stay on your machine.
`;

const pdfToWordPython = String.raw`
#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from pdf2docx import Converter


def resolve_output(input_pdf: Path, output) -> Path:
    if output is None:
        return input_pdf.with_suffix(".docx")

    output_path = Path(output).expanduser()
    if output_path.suffix.lower() == ".docx":
        output_path.parent.mkdir(parents=True, exist_ok=True)
        return output_path

    output_path.mkdir(parents=True, exist_ok=True)
    return output_path / f"{input_pdf.stem}.docx"


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert a PDF to DOCX locally with pdf2docx.")
    parser.add_argument("input_pdf", help="Path to the source PDF.")
    parser.add_argument("output", nargs="?", help="Optional output .docx path or output folder.")
    args = parser.parse_args()

    input_pdf = Path(args.input_pdf).expanduser()
    if not input_pdf.exists():
        print(f"Input file not found: {input_pdf}", file=sys.stderr)
        return 2
    if input_pdf.suffix.lower() != ".pdf":
        print("Input must be a .pdf file.", file=sys.stderr)
        return 2

    output_docx = resolve_output(input_pdf, args.output)
    converter = Converter(str(input_pdf))
    try:
        converter.convert(str(output_docx), start=0, end=None)
    finally:
        converter.close()

    print(f"Created: {output_docx}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`;

const pdfToWordShell = String.raw`
#!/usr/bin/env sh
set -eu

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3.10+ is required. Install it from https://www.python.org/downloads/"
  exit 1
fi

if ! python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' >/dev/null 2>&1; then
  echo "Python 3.10+ is required because pdf2docx needs Python 3.10 or newer."
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python convert_pdf_to_word.py "$@"
`;

const pdfToWordBatch = String.raw`
@echo off
setlocal
cd /d "%~dp0"
py -3.10 -m venv .venv
if errorlevel 1 (
  echo Python 3.10+ is required. Install it from https://www.python.org/downloads/
  exit /b 1
)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python convert_pdf_to_word.py %*
`;

function officeToPdfReadme(title: string, inputLabel: string, extensions: string, exampleInput: string): string {
  return `
# DocuKind ${title}

This pack converts a ${inputLabel} to PDF on your own computer using LibreOffice's headless converter. That gives much better fidelity than a browser-only imitation because LibreOffice can read real Office files locally.

## Supported Inputs

${extensions}

## Requirements

Install LibreOffice first:

- macOS: https://www.libreoffice.org/download/download-libreoffice/
- Windows: https://www.libreoffice.org/download/download-libreoffice/
- Linux: install LibreOffice from your package manager

DocuKind does not upload, store, or inspect your files. This pack runs locally after you download it.

## macOS / Linux

1. Unzip this folder.
2. Open a terminal in the folder.
3. Run:

\`\`\`sh
chmod +x run-mac-linux.sh
./run-mac-linux.sh "/path/to/${exampleInput}"
\`\`\`

Optional output folder:

\`\`\`sh
./run-mac-linux.sh "/path/to/${exampleInput}" "/path/to/output-folder"
\`\`\`

## Windows

1. Install LibreOffice.
2. Unzip this folder.
3. Open Command Prompt or PowerShell in the folder.
4. Run:

\`\`\`bat
run-windows.bat "C:\\path\\to\\${exampleInput}"
\`\`\`

Optional output folder:

\`\`\`bat
run-windows.bat "C:\\path\\to\\${exampleInput}" "C:\\path\\to\\output-folder"
\`\`\`

## Quality Notes

- Best: Office files that open correctly in LibreOffice.
- Good: common fonts, page sizes, images, tables, and slide decks.
- Limited: documents that rely on missing commercial fonts, unusual macros, or unsupported Office features.
- Private: files stay on your machine.
`;
}

const officeToPdfPython = String.raw`
#!/usr/bin/env python3
import argparse
import shutil
import subprocess
import sys
from pathlib import Path

SUPPORTED_EXTENSIONS = set(__SUPPORTED_EXTENSIONS__)


def find_soffice():
    candidates = [
        shutil.which("soffice"),
        shutil.which("libreoffice"),
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]

    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return str(candidate)
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert an Office document to PDF locally with LibreOffice.")
    parser.add_argument("input_file", help="Path to the source document.")
    parser.add_argument("output_dir", nargs="?", default=None, help="Optional output folder.")
    args = parser.parse_args()

    input_file = Path(args.input_file).expanduser()
    if not input_file.exists():
        print(f"Input file not found: {input_file}", file=sys.stderr)
        return 2

    if input_file.suffix.lower() not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        print(f"Unsupported input type {input_file.suffix!r}. Supported: {supported}", file=sys.stderr)
        return 2

    soffice = find_soffice()
    if not soffice:
        print("LibreOffice was not found. Install it from https://www.libreoffice.org/download/download-libreoffice/", file=sys.stderr)
        return 2

    output_dir = Path(args.output_dir).expanduser() if args.output_dir else input_file.parent
    output_dir.mkdir(parents=True, exist_ok=True)

    command = [
        soffice,
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        str(output_dir),
        str(input_file),
    ]
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0:
        print(completed.stdout.strip())
        print(completed.stderr.strip(), file=sys.stderr)
        return completed.returncode

    expected_output = output_dir / f"{input_file.stem}.pdf"
    if expected_output.exists():
        print(f"Created: {expected_output}")
    else:
        print(completed.stdout.strip() or f"Conversion finished. Check: {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`;

const officeToPdfShell = String.raw`
#!/usr/bin/env sh
set -eu

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install it from https://www.python.org/downloads/"
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

python3 convert_office_to_pdf.py "$@"
`;

const officeToPdfBatch = String.raw`
@echo off
setlocal
cd /d "%~dp0"
py -3 convert_office_to_pdf.py %*
if errorlevel 1 (
  echo Python 3 and LibreOffice are required. Install Python from https://www.python.org/downloads/ and LibreOffice from https://www.libreoffice.org/download/download-libreoffice/
  exit /b 1
)
`;
