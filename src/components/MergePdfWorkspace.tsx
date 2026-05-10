import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ToolDefinition, ToolResult } from "../types";
import { acceptsFile, dedupeFiles, formatBytes, normalizeFilename } from "../utils/file";
import { getRenderedPageCount, renderPdfPage, type RenderedPage } from "../utils/renderPdf";
import { navigate } from "../utils/router";
import { Icon } from "./Icon";
import { ResultList } from "./ResultList";

type MergePdfWorkspaceProps = {
  tool: ToolDefinition;
};

type MergeItem = {
  id: string;
  file: File;
};

type PdfMetaState =
  | { status: "loading" }
  | { status: "ready"; pageCount: number; firstPage: RenderedPage }
  | { status: "error"; message: string };

export function MergePdfWorkspace({ tool }: MergePdfWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MergeItem[]>([]);
  const [metaById, setMetaById] = useState<Record<string, PdfMetaState>>({});
  const [outputName, setOutputName] = useState("docukind-merged");
  const [separatorBlankPages, setSeparatorBlankPages] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [rejectedFiles, setRejectedFiles] = useState<string[]>([]);
  const [results, setResults] = useState<ToolResult[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const readyMetas = items
    .map((item) => metaById[item.id])
    .filter((meta): meta is Extract<PdfMetaState, { status: "ready" }> => meta?.status === "ready");
  const knownPages = readyMetas.reduce((total, meta) => total + meta.pageCount, 0);
  const separatorPages = separatorBlankPages && items.length > 1 ? items.length - 1 : 0;
  const totalSize = items.reduce((total, item) => total + item.file.size, 0);
  const cleanOutputName = useMemo(() => `${normalizeFilename(outputName || "docukind-merged")}.pdf`, [outputName]);
  const canRun = items.length >= tool.minFiles && !isRunning;

  useEffect(() => {
    let cancelled = false;

    for (const item of items) {
      if (metaById[item.id]) continue;
      setMetaById((current) => ({ ...current, [item.id]: { status: "loading" } }));
      void (async () => {
        try {
          const [pageCount, firstPage] = await Promise.all([
            getRenderedPageCount(item.file),
            renderPdfPage(item.file, 1, 0.28)
          ]);
          if (!cancelled) {
            setMetaById((current) => ({ ...current, [item.id]: { status: "ready", pageCount, firstPage } }));
          }
        } catch (caught) {
          if (!cancelled) {
            setMetaById((current) => ({
              ...current,
              [item.id]: {
                status: "error",
                message: caught instanceof Error ? caught.message : "Could not preview this PDF."
              }
            }));
          }
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [items]);

  useEffect(() => {
    const activeIds = new Set(items.map((item) => item.id));
    setMetaById((current) => Object.fromEntries(Object.entries(current).filter(([id]) => activeIds.has(id))));
  }, [items]);

  const addFiles = (incoming: FileList | File[]) => {
    const files = Array.from(incoming);
    const accepted = files.filter((file) => acceptsFile(file, tool.accepts));
    const rejected = files.filter((file) => !acceptsFile(file, tool.accepts)).map((file) => file.name);
    setRejectedFiles(rejected);
    if (accepted.length === 0) return;

    setItems((current) => {
      const existing = new Set(current.map((item) => itemKey(item.file)));
      const additions = dedupeFiles(accepted)
        .filter((file) => !existing.has(itemKey(file)))
        .map((file) => ({ id: `${itemKey(file)}:${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`, file }));
      return [...current, ...additions];
    });
    setResults([]);
    setError("");
  };

  const moveItem = (id: string, direction: -1 | 1) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      return arrayMove(current, index, target);
    });
    setResults([]);
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setResults([]);
  };

  const handleSortEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((current) => {
      const oldIndex = current.findIndex((item) => item.id === active.id);
      const newIndex = current.findIndex((item) => item.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
    setResults([]);
  };

  const runTool = async () => {
    if (items.length < tool.minFiles) {
      setError("Add at least two PDFs to merge.");
      return;
    }

    setIsRunning(true);
    setError("");
    setResults([]);
    setProgress("Preparing merge");

    try {
      const processor = await tool.processor();
      const output = await processor(
        items.map((item) => item.file),
        { outputName, separatorBlankPages },
        { onProgress: setProgress }
      );
      setResults(output);
      setProgress(`Done: ${cleanOutputName} ready`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not merge these PDFs.");
      setProgress("");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="tool-workspace merge-workspace">
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
          <p className="tool-tagline">Build one clean PDF from multiple files, in exactly the order you choose.</p>
        </div>
      </section>

      <div className="merge-grid">
        <section className="merge-panel">
          <div
            className={`merge-dropzone ${isDraggingFiles ? "is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingFiles(true);
            }}
            onDragLeave={() => setIsDraggingFiles(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDraggingFiles(false);
              addFiles(event.dataTransfer.files);
            }}
          >
            <input
              ref={inputRef}
              className="sr-only"
              data-testid="file-input"
              type="file"
              accept={tool.accepts}
              multiple
              onChange={(event) => {
                if (event.currentTarget.files) addFiles(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
            <span className="dropzone-icon">
              <Icon name="UploadCloud" size={30} />
            </span>
            <div>
              <h2>Add PDFs</h2>
              <p>Drop multiple PDFs here, then drag them into the final order.</p>
              <small>{tool.accepts.replaceAll(",", ", ")}</small>
            </div>
            <button className="button primary" type="button" onClick={() => inputRef.current?.click()}>
              Choose PDFs
            </button>
          </div>

          {rejectedFiles.length > 0 && (
            <p className="inline-alert" role="alert">
              Skipped unsupported file{rejectedFiles.length > 1 ? "s" : ""}: {rejectedFiles.join(", ")}
            </p>
          )}

          {items.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSortEnd}>
              <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                <ol className="merge-file-list" aria-label="PDF merge order">
                  {items.map((item, index) => (
                    <SortableMergeItem
                      key={item.id}
                      index={index}
                      item={item}
                      meta={metaById[item.id]}
                      onMove={moveItem}
                      onRemove={removeItem}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="merge-empty-state">
              <Icon name="Layers" size={28} />
              <strong>No PDFs selected</strong>
              <span>Add at least two files to create a merged document.</span>
            </div>
          )}

          {error && <p className="error-copy">{error}</p>}
          {progress && (
            <p className="progress-copy">
              {isRunning && <Icon name="Loader2" className="spin" size={16} />}
              {progress}
            </p>
          )}
          <button className="button run-button" type="button" disabled={!canRun} onClick={runTool}>
            {isRunning ? <Icon name="Loader2" className="spin" size={18} /> : <Icon name="Layers" size={18} />}
            Merge PDFs
          </button>
          <ResultList results={results} />
        </section>

        <aside className="merge-sidebar">
          <section>
            <h2>Output</h2>
            <label className="field">
              <span>Filename</span>
              <input value={outputName} placeholder="docukind-merged" onChange={(event) => setOutputName(event.currentTarget.value)} />
            </label>
            <label className="checkbox-row">
              <input checked={separatorBlankPages} type="checkbox" onChange={(event) => setSeparatorBlankPages(event.currentTarget.checked)} />
              <span>Add blank page between PDFs</span>
            </label>
          </section>

          <section>
            <h2>Merge Summary</h2>
            <div className="merge-stats">
              <span>Files</span>
              <strong>{items.length}</strong>
              <span>Known pages</span>
              <strong>{knownPages + separatorPages || 0}</strong>
              <span>Total size</span>
              <strong>{formatBytes(totalSize)}</strong>
              <span>Output</span>
              <strong>{cleanOutputName}</strong>
            </div>
            {separatorBlankPages && items.length > 1 && (
              <p className="quiet-copy">{separatorPages} blank separator page{separatorPages === 1 ? "" : "s"} will be inserted.</p>
            )}
          </section>

          <button className="button" type="button" disabled={items.length === 0} onClick={() => {
            setItems([]);
            setResults([]);
            setError("");
            setProgress("");
          }}>
            Clear all
          </button>
        </aside>
      </div>
    </div>
  );
}

function SortableMergeItem({
  index,
  item,
  meta,
  onMove,
  onRemove
}: {
  index: number;
  item: MergeItem;
  meta: PdfMetaState | undefined;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <li ref={setNodeRef} className={`merge-file-card ${isDragging ? "is-sorting" : ""}`} style={style}>
      <button className="drag-handle" type="button" aria-label={`Drag ${item.file.name}`} {...attributes} {...listeners}>
        <Icon name="GripVertical" size={18} />
      </button>
      <span className="merge-order">{index + 1}</span>
      <div className="merge-thumb">
        {meta?.status === "ready" ? (
          <MergeCanvas page={meta.firstPage} />
        ) : meta?.status === "error" ? (
          <Icon name="FileWarning" size={26} />
        ) : (
          <Icon name="Loader2" className="spin" size={24} />
        )}
      </div>
      <div className="merge-file-copy">
        <strong>{item.file.name}</strong>
        <span>{formatBytes(item.file.size)}</span>
        {meta?.status === "ready" && (
          <small>{meta.pageCount} page{meta.pageCount === 1 ? "" : "s"}</small>
        )}
        {meta?.status === "error" && <small className="error-copy">{meta.message}</small>}
      </div>
      <div className="merge-card-actions">
        <button className="icon-button" type="button" aria-label={`Move ${item.file.name} up`} onClick={() => onMove(item.id, -1)}>
          <Icon name="ArrowUp" size={16} />
        </button>
        <button className="icon-button" type="button" aria-label={`Move ${item.file.name} down`} onClick={() => onMove(item.id, 1)}>
          <Icon name="ArrowDown" size={16} />
        </button>
        <button className="icon-button" type="button" aria-label={`Remove ${item.file.name}`} onClick={() => onRemove(item.id)}>
          <Icon name="X" size={16} />
        </button>
      </div>
    </li>
  );
}

function MergeCanvas({ page }: { page: RenderedPage }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!container) return;
    page.canvas.className = "merge-thumbnail-canvas";
    container.replaceChildren(page.canvas);
  }, [container, page]);

  return <div ref={setContainer} />;
}

function itemKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
