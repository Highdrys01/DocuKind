import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { ToolDefinition, ToolResult } from "../types";
import { parsePageSelection } from "../utils/pageRanges";
import { renderPdfPage, type RenderedPage } from "../utils/renderPdf";
import { navigate } from "../utils/router";
import {
  clampPlacement,
  defaultSizeForKind,
  DEFAULT_SIGNATURE_COLORS,
  placementToPreviewRect,
  pointerToPdfPoint,
  previewDeltaToPdfDelta,
  type PageSize,
  type SignatureFieldKind,
  type SignatureFontStyle,
  type SignaturePlacement
} from "../utils/signatures";
import { FileDropzone } from "./FileDropzone";
import { Icon } from "./Icon";
import { ResultList } from "./ResultList";

type SignPdfWorkspaceProps = {
  tool: ToolDefinition;
};

type Interaction = {
  id: string;
  mode: "drag" | "resize";
  startX: number;
  startY: number;
  original: SignaturePlacement;
};

const PREVIEW_SCALE = 1.35;
const styleChoices: Array<{ id: SignatureFontStyle; label: string; font: string }> = [
  { id: "script", label: "Script", font: '"Brush Script MT", "Segoe Script", cursive' },
  { id: "formal", label: "Formal", font: '"Snell Roundhand", "Segoe Script", cursive' },
  { id: "classic", label: "Classic", font: "Georgia, serif" },
  { id: "plain", label: "Plain", font: "Inter, system-ui, sans-serif" }
];

export function SignPdfWorkspace({ tool }: SignPdfWorkspaceProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [preview, setPreview] = useState<RenderedPage | null>(null);
  const [placements, setPlacements] = useState<SignaturePlacement[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [pendingKind, setPendingKind] = useState<SignatureFieldKind>("signature");
  const [fullName, setFullName] = useState("");
  const [initials, setInitials] = useState("");
  const [customText, setCustomText] = useState("");
  const [fontStyle, setFontStyle] = useState<SignatureFontStyle>("script");
  const [color, setColor] = useState(DEFAULT_SIGNATURE_COLORS[0]);
  const [signatureMode, setSignatureMode] = useState<"type" | "draw" | "upload">("type");
  const [drawnImageData, setDrawnImageData] = useState("");
  const [uploadedImageData, setUploadedImageData] = useState("");
  const [copyPages, setCopyPages] = useState("all");
  const [results, setResults] = useState<ToolResult[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const file = files[0];
  const pageSize = useMemo<PageSize | null>(() => {
    if (!preview) return null;
    return { width: preview.width / PREVIEW_SCALE, height: preview.height / PREVIEW_SCALE };
  }, [preview]);
  const currentPlacements = placements.filter((placement) => placement.pageIndex === pageNumber - 1);
  const selectedPlacement = placements.find((placement) => placement.id === selectedId);

  useEffect(() => {
    setPageNumber(1);
    setPageCount(0);
    setPreview(null);
    setPlacements([]);
    setSelectedId("");
    setResults([]);
    setError("");
    setProgress("");
  }, [file]);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      if (!file) return;
      setProgress("Rendering page");
      try {
        const rendered = await renderPdfPage(file, pageNumber, PREVIEW_SCALE);
        if (!cancelled) {
          setPreview(rendered);
          setProgress("");
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not render this PDF.");
          setProgress("");
        }
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [file, pageNumber]);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;

    async function countPages() {
      try {
        const { getRenderedPageCount } = await import("../utils/renderPdf");
        const count = await getRenderedPageCount(file);
        if (!cancelled) setPageCount(count);
      } catch {
        if (!cancelled) setPageCount(1);
      }
    }

    void countPages();
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    if (!canvasHostRef.current || !preview) return;
    preview.canvas.className = "signature-page-canvas";
    canvasHostRef.current.replaceChildren(preview.canvas);
  }, [preview]);

  useEffect(() => {
    const canvas = drawCanvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = color;
  }, [color]);

  const addPlacement = (kind: SignatureFieldKind, point: { x: number; y: number }) => {
    if (!pageSize) return;
    const base = createPlacement(kind);
    const centered = {
      ...base,
      pageIndex: pageNumber - 1,
      x: point.x - base.width / 2,
      y: point.y - base.height / 2
    };
    const placement = clampPlacement(centered, pageSize);
    setPlacements((current) => [...current, placement]);
    setSelectedId(placement.id);
    setResults([]);
  };

  const updatePlacement = (id: string, updater: (placement: SignaturePlacement) => SignaturePlacement) => {
    if (!pageSize) return;
    setPlacements((current) => current.map((placement) => {
      if (placement.id !== id) return placement;
      return clampPlacement(updater(placement), pageSize);
    }));
    setResults([]);
  };

  const runTool = async () => {
    if (!file) {
      setError("Add a PDF first.");
      return;
    }

    if (placements.length === 0) {
      setError("Add at least one signing field.");
      return;
    }

    setIsRunning(true);
    setError("");
    setResults([]);
    setProgress("Preparing signature fields");

    try {
      const processor = await tool.processor();
      const output = await processor(files, { placements }, { onProgress: setProgress });
      setResults(output);
      setProgress("Done: signed PDF ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign this PDF.");
      setProgress("");
    } finally {
      setIsRunning(false);
    }
  };

  const createPlacement = (kind: SignatureFieldKind): SignaturePlacement => {
    const size = defaultSizeForKind(kind);
    const baseValue = valueForKind(kind);
    const shouldUseImage = kind === "signature" || kind === "initials";
    return {
      id: `${kind}-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`,
      pageIndex: pageNumber - 1,
      kind,
      x: 24,
      y: 24,
      width: size.width,
      height: size.height,
      value: baseValue,
      color,
      opacity: 1,
      fontStyle,
      imageData: shouldUseImage ? imageDataForKind(kind, baseValue) : undefined,
      source: shouldUseImage ? signatureMode === "type" ? "typed" : signatureMode === "draw" ? "drawn" : "uploaded" : undefined
    };
  };

  const valueForKind = (kind: SignatureFieldKind): string => {
    if (kind === "signature") return fullName.trim();
    if (kind === "initials") return initials.trim();
    if (kind === "name") return fullName.trim();
    if (kind === "date") return new Date().toLocaleDateString();
    return customText.trim();
  };

  const imageDataForKind = (kind: SignatureFieldKind, value: string): string | undefined => {
    if (kind !== "signature" && kind !== "initials") return undefined;
    if (signatureMode === "upload" && uploadedImageData) return uploadedImageData;
    if (signatureMode === "draw" && drawnImageData) return drawnImageData;
    return renderSignatureTextImage(value, fontStyle, color, kind);
  };

  const copySelectedToPages = () => {
    if (!selectedPlacement || pageCount < 1) return;
    let indexes: number[];
    try {
      indexes = parsePageSelection(copyPages, pageCount);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid page range.");
      return;
    }

    const clones = indexes
      .filter((index) => index !== selectedPlacement.pageIndex)
      .map((pageIndex) => ({
        ...selectedPlacement,
        id: `${selectedPlacement.kind}-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${pageIndex}`}`,
        pageIndex
      }));
    setPlacements((current) => [...current, ...clones]);
  };

  return (
    <div className="tool-workspace sign-workspace">
      <button className="back-link" type="button" onClick={() => navigate("/pdf")}>
        <Icon name="ArrowLeft" size={18} />
        PDF Tools
      </button>

      <section className="workspace-title compact">
        <span className="tool-icon large">
          <Icon name={tool.icon} size={28} />
        </span>
        <div>
          <p className="eyebrow">{tool.category}</p>
          <h1>{tool.title}</h1>
          <p className="tool-tagline">Create visual signatures locally, place fields anywhere, and download the signed PDF.</p>
        </div>
      </section>

      <div className="sign-grid">
        <div className="sign-main">
          <FileDropzone tool={tool} files={files} onFilesChange={(next) => {
            setFiles(next);
            setResults([]);
            setError("");
          }} />

          {file && (
            <div className="sign-document">
              <SignatureThumbnails file={file} pageCount={pageCount} pageNumber={pageNumber} onSelect={setPageNumber} />
              <div className="signature-page-shell">
                <div className="signature-page-toolbar">
                  <button className="icon-button" type="button" aria-label="Previous page" disabled={pageNumber <= 1} onClick={() => setPageNumber((value) => Math.max(1, value - 1))}>
                    <Icon name="ArrowUp" size={16} />
                  </button>
                  <span>Page {pageNumber} / {pageCount || 1}</span>
                  <button className="icon-button" type="button" aria-label="Next page" disabled={pageCount > 0 && pageNumber >= pageCount} onClick={() => setPageNumber((value) => Math.min(pageCount || value + 1, value + 1))}>
                    <Icon name="ArrowDown" size={16} />
                  </button>
                </div>
                <div className="signature-page-stage">
                  <div className="signature-page-stack">
                    <div ref={canvasHostRef} className="signature-canvas-host" />
                    {pageSize && (
                      <div
                        ref={overlayRef}
                        className="signature-overlay"
                        onPointerDown={(event) => {
                          if (event.target !== event.currentTarget || !pageSize) return;
                          const point = pointerToPdfPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), pageSize);
                          addPlacement(pendingKind, point);
                        }}
                      >
                        {currentPlacements.map((placement) => (
                          <SignatureBox
                            key={placement.id}
                            placement={placement}
                            pageSize={pageSize}
                            selected={placement.id === selectedId}
                            onSelect={() => setSelectedId(placement.id)}
                            onStart={(mode, event) => {
                              event.stopPropagation();
                              setSelectedId(placement.id);
                              interactionRef.current = { id: placement.id, mode, startX: event.clientX, startY: event.clientY, original: placement };
                              const captureTarget = event.currentTarget.closest(".signature-field-box") as HTMLElement | null;
                              (captureTarget ?? event.currentTarget).setPointerCapture(event.pointerId);
                            }}
                            onMove={(event) => {
                              const interaction = interactionRef.current;
                              if (!interaction || interaction.id !== placement.id || !overlayRef.current || !pageSize) return;
                              const { dx, dy } = previewDeltaToPdfDelta(event.clientX - interaction.startX, event.clientY - interaction.startY, overlayRef.current.getBoundingClientRect(), pageSize);
                              updatePlacement(placement.id, () => interaction.mode === "resize"
                                ? { ...interaction.original, width: interaction.original.width + dx, height: interaction.original.height - dy }
                                : { ...interaction.original, x: interaction.original.x + dx, y: interaction.original.y + dy });
                            }}
                            onEnd={() => {
                              interactionRef.current = null;
                            }}
                            onKeyNudge={(dx, dy) => updatePlacement(placement.id, (current) => ({ ...current, x: current.x + dx, y: current.y + dy }))}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && <p className="error-copy">{error}</p>}
          {progress && (
            <p className="progress-copy">
              {isRunning && <Icon name="Loader2" className="spin" size={16} />}
              {progress}
            </p>
          )}
          <button className="button run-button" type="button" disabled={!file || placements.length === 0 || isRunning} onClick={runTool}>
            {isRunning ? <Icon name="Loader2" className="spin" size={18} /> : <Icon name="PenLine" size={18} />}
            Sign PDF
          </button>
          <ResultList results={results} />
        </div>

        <aside className="sign-palette">
          <section>
            <h2>Signature Details</h2>
            <label className="field">
              <span>Full name</span>
              <input value={fullName} placeholder="Your name" onChange={(event) => setFullName(event.currentTarget.value)} />
            </label>
            <label className="field">
              <span>Initials</span>
              <input value={initials} placeholder="AB" onChange={(event) => setInitials(event.currentTarget.value)} />
            </label>
          </section>

          <section>
            <h2>Signature Source</h2>
            <div className="segmented compact">
              {(["type", "draw", "upload"] as const).map((mode) => (
                <button key={mode} className={signatureMode === mode ? "active" : ""} type="button" onClick={() => setSignatureMode(mode)}>
                  {mode === "type" ? "Type" : mode === "draw" ? "Draw" : "Upload"}
                </button>
              ))}
            </div>
            {signatureMode === "type" && (
              <div className="signature-style-list">
                {styleChoices.map((choice) => (
                  <button className={fontStyle === choice.id ? "active" : ""} type="button" key={choice.id} onClick={() => setFontStyle(choice.id)}>
                    <span style={{ fontFamily: choice.font }}>{fullName || "Signature"}</span>
                    <small>{choice.label}</small>
                  </button>
                ))}
              </div>
            )}
            {signatureMode === "draw" && (
              <div className="draw-pad">
                <canvas
                  ref={drawCanvasRef}
                  width={420}
                  height={140}
                  onPointerDown={(event) => {
                    const context = event.currentTarget.getContext("2d");
                    if (!context) return;
                    drawingRef.current = true;
                    const rect = event.currentTarget.getBoundingClientRect();
                    context.beginPath();
                    context.moveTo(event.clientX - rect.left, event.clientY - rect.top);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (!drawingRef.current) return;
                    const context = event.currentTarget.getContext("2d");
                    if (!context) return;
                    const rect = event.currentTarget.getBoundingClientRect();
                    context.lineTo(event.clientX - rect.left, event.clientY - rect.top);
                    context.stroke();
                  }}
                  onPointerUp={(event) => {
                    drawingRef.current = false;
                    setDrawnImageData(event.currentTarget.toDataURL("image/png"));
                  }}
                />
                <button className="button" type="button" onClick={() => {
                  const canvas = drawCanvasRef.current;
                  canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
                  setDrawnImageData("");
                }}>
                  Clear
                </button>
              </div>
            )}
            {signatureMode === "upload" && (
              <label className="upload-inline">
                <input
                  type="file"
                  accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                  onChange={async (event) => {
                    const upload = event.currentTarget.files?.[0];
                    if (upload) setUploadedImageData(await fileToDataUrl(upload));
                    event.currentTarget.value = "";
                  }}
                />
                <span>{uploadedImageData ? "Signature image ready" : "Choose PNG or JPG signature image"}</span>
              </label>
            )}
            <div className="swatch-row" aria-label="Signature colors">
              {DEFAULT_SIGNATURE_COLORS.map((choice) => (
                <button
                  className={choice === color ? "active" : ""}
                  style={{ background: choice }}
                  type="button"
                  key={choice}
                  aria-label={`Use color ${choice}`}
                  onClick={() => setColor(choice)}
                />
              ))}
              <input aria-label="Custom signature color" type="color" value={color} onChange={(event) => setColor(event.currentTarget.value)} />
            </div>
          </section>

          <section>
            <h2>Place Fields</h2>
            <p className="quiet-copy">Choose a field, then click the page. Drag placed fields to move them.</p>
            <div className="field-palette">
              {fieldButtons.map((field) => (
                <button className={pendingKind === field.kind ? "active" : ""} type="button" key={field.kind} onClick={() => setPendingKind(field.kind)}>
                  <Icon name={field.icon} size={18} />
                  {field.label}
                </button>
              ))}
            </div>
            <label className="field">
              <span>Custom text</span>
              <input value={customText} placeholder="Approved by..." onChange={(event) => setCustomText(event.currentTarget.value)} />
            </label>
          </section>

          {selectedPlacement && (
            <section>
              <h2>Selected Field</h2>
              <label className="field">
                <span>Value</span>
                <input value={selectedPlacement.value} onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  updatePlacement(selectedPlacement.id, (current) => ({
                    ...current,
                    value: nextValue,
                    imageData: current.source === "typed" && (current.kind === "signature" || current.kind === "initials")
                      ? renderSignatureTextImage(nextValue, current.fontStyle ?? "script", current.color ?? color, current.kind)
                      : current.imageData
                  }));
                }} />
              </label>
              <div className="field-actions-row">
                <button className="button" type="button" onClick={() => updatePlacement(selectedPlacement.id, (current) => ({ ...current, x: current.x - 2 }))}>Left</button>
                <button className="button" type="button" onClick={() => updatePlacement(selectedPlacement.id, (current) => ({ ...current, x: current.x + 2 }))}>Right</button>
                <button className="button" type="button" onClick={() => updatePlacement(selectedPlacement.id, (current) => ({ ...current, y: current.y + 2 }))}>Up</button>
                <button className="button" type="button" onClick={() => updatePlacement(selectedPlacement.id, (current) => ({ ...current, y: current.y - 2 }))}>Down</button>
              </div>
              <label className="field">
                <span>Copy to pages</span>
                <input value={copyPages} placeholder="all or 1,3-5" onChange={(event) => setCopyPages(event.currentTarget.value)} />
              </label>
              <div className="field-actions-row">
                <button className="button" type="button" onClick={() => {
                  setPlacements((current) => [...current, { ...selectedPlacement, id: `${selectedPlacement.kind}-${Date.now()}`, x: selectedPlacement.x + 12, y: selectedPlacement.y - 12 }]);
                }}>
                  Duplicate
                </button>
                <button className="button" type="button" onClick={copySelectedToPages}>Copy</button>
                <button className="button" type="button" onClick={() => {
                  setPlacements((current) => current.filter((placement) => placement.id !== selectedPlacement.id));
                  setSelectedId("");
                }}>
                  Delete
                </button>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function SignatureBox({
  placement,
  pageSize,
  selected,
  onSelect,
  onStart,
  onMove,
  onEnd,
  onKeyNudge
}: {
  placement: SignaturePlacement;
  pageSize: PageSize;
  selected: boolean;
  onSelect: () => void;
  onStart: (mode: "drag" | "resize", event: PointerEvent<HTMLElement>) => void;
  onMove: (event: PointerEvent<HTMLDivElement>) => void;
  onEnd: () => void;
  onKeyNudge: (dx: number, dy: number) => void;
}) {
  const rect = placementToPreviewRect(placement, pageSize);
  return (
    <div
      className={`signature-field-box ${selected ? "selected" : ""}`}
      style={{ left: `${rect.left}%`, top: `${rect.top}%`, width: `${rect.width}%`, height: `${rect.height}%` }}
      role="button"
      tabIndex={0}
      onPointerDown={(event) => onStart("drag", event)}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onKeyDown={(event) => {
        const amount = event.shiftKey ? 10 : 2;
        if (event.key === "ArrowLeft") onKeyNudge(-amount, 0);
        if (event.key === "ArrowRight") onKeyNudge(amount, 0);
        if (event.key === "ArrowUp") onKeyNudge(0, amount);
        if (event.key === "ArrowDown") onKeyNudge(0, -amount);
      }}
    >
      <span className="signature-field-label">{labelForKind(placement.kind)}</span>
      {placement.imageData ? (
        <img src={placement.imageData} alt="" />
      ) : (
        <strong>{placement.value}</strong>
      )}
      <span
        className="signature-resize-handle"
        onPointerDown={(event) => onStart("resize", event)}
        aria-hidden="true"
      />
    </div>
  );
}

function SignatureThumbnails({ file, pageCount, pageNumber, onSelect }: { file: File; pageCount: number; pageNumber: number; onSelect: (page: number) => void }) {
  const [thumbs, setThumbs] = useState<Array<RenderedPage & { pageNumber: number }>>([]);

  useEffect(() => {
    let cancelled = false;

    async function renderThumbs() {
      const next = [];
      for (let index = 1; index <= Math.min(pageCount || 1, 12); index += 1) {
        const rendered = await renderPdfPage(file, index, 0.18);
        if (cancelled) return;
        next.push({ ...rendered, pageNumber: index });
      }
      setThumbs(next);
    }

    void renderThumbs();
    return () => {
      cancelled = true;
    };
  }, [file, pageCount]);

  return (
    <nav className="signature-thumbs" aria-label="PDF pages">
      {thumbs.map((thumb) => (
        <ThumbnailButton key={thumb.pageNumber} thumb={thumb} active={thumb.pageNumber === pageNumber} onSelect={onSelect} />
      ))}
    </nav>
  );
}

function ThumbnailButton({ thumb, active, onSelect }: { thumb: RenderedPage & { pageNumber: number }; active: boolean; onSelect: (page: number) => void }) {
  const hostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!hostRef.current) return;
    thumb.canvas.className = "signature-thumb-canvas";
    hostRef.current.replaceChildren(thumb.canvas);
  }, [thumb]);

  return (
    <button className={active ? "active" : ""} type="button" onClick={() => onSelect(thumb.pageNumber)}>
      <span ref={hostRef} />
      <small>{thumb.pageNumber}</small>
    </button>
  );
}

const fieldButtons: Array<{ kind: SignatureFieldKind; label: string; icon: string }> = [
  { kind: "signature", label: "Signature", icon: "PenLine" },
  { kind: "initials", label: "Initials", icon: "FileText" },
  { kind: "name", label: "Name", icon: "Tags" },
  { kind: "date", label: "Date", icon: "ListOrdered" },
  { kind: "text", label: "Text", icon: "FileText" }
];

function labelForKind(kind: SignatureFieldKind): string {
  return fieldButtons.find((field) => field.kind === kind)?.label ?? "Field";
}

function renderSignatureTextImage(value: string, style: SignatureFontStyle, color: string, kind: SignatureFieldKind): string | undefined {
  if (!value.trim()) return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = kind === "initials" ? 360 : 720;
  canvas.height = 220;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const font = styleChoices.find((choice) => choice.id === style)?.font ?? styleChoices[0].font;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.font = `${kind === "initials" ? 108 : 96}px ${font}`;
  context.textBaseline = "middle";
  context.fillText(value, 28, canvas.height / 2, canvas.width - 56);
  return canvas.toDataURL("image/png");
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read signature image."));
    reader.readAsDataURL(file);
  });
}
