import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Rnd } from "react-rnd";
import type { ToolDefinition, ToolResult } from "../types";
import { parsePageSelection } from "../utils/pageRanges";
import { renderPdfPage, type RenderedPage } from "../utils/renderPdf";
import { navigate } from "../utils/router";
import {
  clampPlacement,
  defaultSizeForKind,
  DEFAULT_SIGNATURE_COLORS,
  placementToPreviewPixels,
  pointerToPdfPoint,
  previewRectToPlacement,
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
  const [overlayElement, setOverlayElement] = useState<HTMLDivElement | null>(null);
  const [overlaySize, setOverlaySize] = useState<PageSize>({ width: 0, height: 0 });
  const [activeDragKind, setActiveDragKind] = useState<SignatureFieldKind | null>(null);
  const [results, setResults] = useState<ToolResult[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const dragCenterRef = useRef<{ x: number; y: number } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } })
  );

  const file = files[0];
  const pageSize = useMemo<PageSize | null>(() => {
    if (!preview) return null;
    return { width: preview.width / PREVIEW_SCALE, height: preview.height / PREVIEW_SCALE };
  }, [preview]);
  const { isOver: isPageDropActive, setNodeRef: setDroppableNodeRef } = useDroppable({
    id: "signature-page",
    disabled: !pageSize
  });
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

  const setOverlayNode = useCallback((node: HTMLDivElement | null) => {
    overlayRef.current = node;
    setOverlayElement(node);
    setDroppableNodeRef(node);
  }, [setDroppableNodeRef]);

  useEffect(() => {
    if (!overlayElement) return;
    const updateSize = () => {
      const rect = overlayElement.getBoundingClientRect();
      setOverlaySize({ width: rect.width, height: rect.height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(overlayElement);
    return () => observer.disconnect();
  }, [overlayElement, preview]);

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

  const handleDragStart = (event: DragStartEvent) => {
    const kind = event.active.data.current?.kind;
    if (isSignatureFieldKind(kind)) setActiveDragKind(kind);
    const initialRect = event.active.rect.current.initial;
    dragCenterRef.current = initialRect
      ? { x: initialRect.left + initialRect.width / 2, y: initialRect.top + initialRect.height / 2 }
      : null;
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const kind = event.active.data.current?.kind;
    const initialRect = event.active.rect.current.initial;
    if (!isSignatureFieldKind(kind) || !initialRect) return;
    dragCenterRef.current = {
      x: initialRect.left + initialRect.width / 2 + event.delta.x,
      y: initialRect.top + initialRect.height / 2 + event.delta.y
    };
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const kind = event.active.data.current?.kind;
    setActiveDragKind(null);
    if (!isSignatureFieldKind(kind) || !overlayRef.current || !pageSize) return;

    const dragRect = event.active.rect.current.translated ?? event.active.rect.current.initial;
    if (!dragRect) return;

    const overlayRect = overlayRef.current.getBoundingClientRect();
    const center = dragCenterRef.current ?? {
      x: dragRect.left + dragRect.width / 2,
      y: dragRect.top + dragRect.height / 2
    };
    dragCenterRef.current = null;
    const droppedOnPage = event.over?.id === "signature-page" || (
      center.x >= overlayRect.left &&
      center.x <= overlayRect.right &&
      center.y >= overlayRect.top &&
      center.y <= overlayRect.bottom
    );
    if (!droppedOnPage) return;

    const point = pointerToPdfPoint(
      center.x,
      center.y,
      overlayRect,
      pageSize
    );
    addPlacement(kind, point);
  };

  const updatePlacementFromPreviewRect = (id: string, rect: { x: number; y: number; width: number; height: number }) => {
    if (!pageSize || overlaySize.width <= 0 || overlaySize.height <= 0) return;
    updatePlacement(id, (current) => previewRectToPlacement(current, rect, pageSize, overlaySize));
  };

  const updatePlacement = (id: string, updater: (placement: SignaturePlacement) => SignaturePlacement) => {
    if (!pageSize) return;
    setPlacements((current) => current.map((placement) => {
      if (placement.id !== id) return placement;
      return clampPlacement(updater(placement), pageSize);
    }));
    setResults([]);
  };

  const setSignatureColor = (nextColor: string) => {
    setColor(nextColor);
    if (selectedPlacement?.source !== "typed" || (selectedPlacement.kind !== "signature" && selectedPlacement.kind !== "initials")) return;
    updatePlacement(selectedPlacement.id, (current) => ({
      ...current,
      color: nextColor,
      imageData: renderSignatureTextImage(current.value, current.fontStyle ?? fontStyle, nextColor, current.kind)
    }));
  };

  const setSignatureFontStyle = (nextStyle: SignatureFontStyle) => {
    setFontStyle(nextStyle);
    if (selectedPlacement?.source !== "typed" || (selectedPlacement.kind !== "signature" && selectedPlacement.kind !== "initials")) return;
    updatePlacement(selectedPlacement.id, (current) => ({
      ...current,
      fontStyle: nextStyle,
      imageData: renderSignatureTextImage(current.value, nextStyle, current.color ?? color, current.kind)
    }));
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

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd} onDragCancel={() => {
        dragCenterRef.current = null;
        setActiveDragKind(null);
      }}>
        <div className="sign-grid">
          <div className="sign-main">
            <FileDropzone tool={tool} files={files} onFilesChange={(next) => {
              setFiles(next);
              setResults([]);
              setError("");
            }} />

            {file ? (
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
                          ref={setOverlayNode}
                          className={`signature-overlay ${isPageDropActive ? "drop-active" : ""}`}
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
                              previewSize={overlaySize}
                              selected={placement.id === selectedId}
                              onSelect={() => setSelectedId(placement.id)}
                              onPreviewRectChange={(rect) => updatePlacementFromPreviewRect(placement.id, rect)}
                              onKeyNudge={(dx, dy) => updatePlacement(placement.id, (current) => ({ ...current, x: current.x + dx, y: current.y + dy }))}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <section className="sign-empty-state">
                <Icon name="PenLine" size={28} />
                <strong>Upload a PDF to start signing.</strong>
                <span>Your document stays in this browser. Visual signatures are not certified digital signatures.</span>
              </section>
            )}

            {error && <p className="error-copy">{error}</p>}
            {progress && (
              <p className="progress-copy">
                {isRunning && <Icon name="Loader2" className="spin" size={16} />}
                {progress}
              </p>
            )}
            <p className="inline-alert">Visual signatures are stamped into the PDF locally. Use Certified Digital Signature (Local) only when you need certificate-based signing.</p>
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
                  <button className={fontStyle === choice.id ? "active" : ""} type="button" key={choice.id} onClick={() => setSignatureFontStyle(choice.id)}>
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
                  onClick={() => setSignatureColor(choice)}
                />
              ))}
              <input aria-label="Custom signature color" type="color" value={color} onChange={(event) => setSignatureColor(event.currentTarget.value)} />
            </div>
          </section>

          <section>
            <h2>Place Fields</h2>
            <p className="quiet-copy">Drag a field onto the page. On mobile, choose a field and tap the page.</p>
            <div className="field-palette">
              {fieldButtons.map((field) => (
                <DraggableFieldButton
                  active={pendingKind === field.kind}
                  field={field}
                  key={field.kind}
                  onChoose={() => setPendingKind(field.kind)}
                />
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
        <DragOverlay>
          {activeDragKind ? <FieldDragPreview field={fieldButtons.find((field) => field.kind === activeDragKind) ?? fieldButtons[0]} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function SignatureBox({
  placement,
  pageSize,
  previewSize,
  selected,
  onSelect,
  onPreviewRectChange,
  onKeyNudge
}: {
  placement: SignaturePlacement;
  pageSize: PageSize;
  previewSize: PageSize;
  selected: boolean;
  onSelect: () => void;
  onPreviewRectChange: (rect: { x: number; y: number; width: number; height: number }) => void;
  onKeyNudge: (dx: number, dy: number) => void;
}) {
  const rect = placementToPreviewPixels(placement, pageSize, previewSize);
  if (previewSize.width <= 0 || previewSize.height <= 0) return null;

  return (
    <Rnd
      bounds="parent"
      className={`signature-field-box ${selected ? "selected" : ""}`}
      minHeight={14}
      minWidth={24}
      position={{ x: rect.x, y: rect.y }}
      size={{ width: rect.width, height: rect.height }}
      enableResizing={selected}
      role="button"
      tabIndex={0}
      onDragStart={onSelect}
      onDragStop={(_, data) => onPreviewRectChange({ x: data.x, y: data.y, width: rect.width, height: rect.height })}
      onMouseDown={onSelect}
      onResizeStart={onSelect}
      onResizeStop={(_, __, ref, ___, position) => {
        onPreviewRectChange({
          x: position.x,
          y: position.y,
          width: ref.offsetWidth,
          height: ref.offsetHeight
        });
      }}
      onTouchStart={onSelect}
      onClick={(event: MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        onSelect();
      }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
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
    </Rnd>
  );
}

function DraggableFieldButton({ active, field, onChoose }: {
  active: boolean;
  field: FieldButtonDefinition;
  onChoose: () => void;
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
    id: `field-${field.kind}`,
    data: { kind: field.kind }
  });
  const style = { transform: CSS.Translate.toString(transform) };

  return (
    <button
      ref={setNodeRef}
      className={`${active ? "active" : ""} ${isDragging ? "dragging" : ""}`}
      data-testid={`palette-${field.kind}`}
      style={style}
      type="button"
      onClick={onChoose}
      {...attributes}
      {...listeners}
    >
      <Icon name={field.icon} size={18} />
      {field.label}
    </button>
  );
}

function FieldDragPreview({ field }: { field: FieldButtonDefinition }) {
  return (
    <div className="field-drag-preview">
      <Icon name={field.icon} size={18} />
      {field.label}
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

type FieldButtonDefinition = { kind: SignatureFieldKind; label: string; icon: string };

const fieldButtons: FieldButtonDefinition[] = [
  { kind: "signature", label: "Signature", icon: "PenLine" },
  { kind: "initials", label: "Initials", icon: "FileText" },
  { kind: "name", label: "Name", icon: "Tags" },
  { kind: "date", label: "Date", icon: "ListOrdered" },
  { kind: "text", label: "Text", icon: "FileText" }
];

function labelForKind(kind: SignatureFieldKind): string {
  return fieldButtons.find((field) => field.kind === kind)?.label ?? "Field";
}

function isSignatureFieldKind(value: unknown): value is SignatureFieldKind {
  return value === "signature" || value === "initials" || value === "name" || value === "date" || value === "text";
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
