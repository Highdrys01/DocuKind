import { useEffect, useState } from "react";
import { renderPdfPage, type RenderedPage } from "../utils/renderPdf";
import { Icon } from "./Icon";

type PdfPreviewProps = {
  file: File | undefined;
};

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "image"; url: string }
  | { status: "pdf"; pages: Array<RenderedPage & { pageNumber: number }> }
  | { status: "error"; message: string };

export function PdfPreview({ file }: PdfPreviewProps) {
  const [state, setState] = useState<PreviewState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;

    async function render() {
      if (!file) {
        setState({ status: "idle" });
        return;
      }

      setState({ status: "loading" });

      if (file.type.startsWith("image/")) {
        objectUrl = URL.createObjectURL(file);
        if (!cancelled) setState({ status: "image", url: objectUrl });
        return;
      }

      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setState({ status: "idle" });
        return;
      }

      try {
        const pages = [];
        for (let pageNumber = 1; pageNumber <= 4; pageNumber += 1) {
          try {
            const rendered = await renderPdfPage(file, pageNumber, 0.33);
            if (cancelled) return;
            pages.push({ ...rendered, pageNumber });
          } catch {
            break;
          }
        }

        if (!cancelled) setState({ status: "pdf", pages });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Preview failed."
          });
        }
      }
    }

    void render();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  if (!file) {
    return (
      <aside className="preview empty-preview">
        <Icon name="FileText" size={28} />
        <span>No file selected</span>
      </aside>
    );
  }

  if (state.status === "loading") {
    return (
      <aside className="preview">
        <div className="loading-line">
          <Icon name="Loader2" className="spin" size={18} />
          Rendering preview
        </div>
      </aside>
    );
  }

  if (state.status === "image") {
    return (
      <aside className="preview">
        <img className="image-preview" src={state.url} alt={file.name} />
      </aside>
    );
  }

  if (state.status === "pdf") {
    return (
      <aside className="preview">
        <div className="thumbnail-grid">
          {state.pages.map((page) => (
            <CanvasThumb key={page.pageNumber} page={page} />
          ))}
        </div>
      </aside>
    );
  }

  if (state.status === "error") {
    return (
      <aside className="preview empty-preview">
        <Icon name="FileText" size={28} />
        <span>{state.message}</span>
      </aside>
    );
  }

  return null;
}

function CanvasThumb({ page }: { page: RenderedPage & { pageNumber: number } }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!container) return;

    page.canvas.className = "thumbnail-canvas";
    page.canvas.setAttribute("aria-label", `Page ${page.pageNumber}`);
    container.replaceChildren(page.canvas);
  }, [container, page]);

  return (
    <figure className="thumbnail">
      <div ref={setContainer} />
      <figcaption>{page.pageNumber}</figcaption>
    </figure>
  );
}
