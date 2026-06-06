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
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ToolDefinition, ToolResult } from "../types";
import { acceptsFile, formatBytes } from "../utils/file";
import {
  buildPageWorkspaceOptions,
  pageIndexesToRangeText,
  pageRotationsJson,
  selectedPageIndexes,
  type PageToolId,
  type WorkspacePage
} from "../utils/pageWorkspace";
import { parsePageSelection } from "../utils/pageRanges";
import { getRenderedPageCount, renderPdfPage, type RenderedPage } from "../utils/renderPdf";
import { navigate } from "../utils/router";
import { Icon } from "./Icon";
import { ResultList } from "./ResultList";

type PagePdfWorkspaceProps = {
  tool: ToolDefinition & { id: PageToolId };
};

type PageItem = WorkspacePage & {
  id: string;
  pageNumber: number;
  status: "loading" | "ready" | "error";
  thumbnail?: RenderedPage;
  error?: string;
};

type SplitMode = "every" | "selected" | "ranges";

const pageToolTitles: Record<PageToolId, string> = {
  "split-pdf": "Split a PDF by choosing pages or ranges visually.",
  "extract-pages": "Select the exact pages to pull into a new PDF.",
  "delete-pages": "Mark unwanted pages before creating the cleaned PDF.",
  "organize-pdf": "Drag pages into order, rotate pages, or remove pages before export.",
  "rotate-pdf": "Select pages and preview the rotation before saving."
};

export function isPagePdfTool(tool: ToolDefinition): tool is ToolDefinition & { id: PageToolId } {
  return ["split-pdf", "extract-pages", "delete-pages", "organize-pdf", "rotate-pdf"].includes(tool.id);
}

export function PagePdfWorkspace({ tool }: PagePdfWorkspaceProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | undefined>();
  const [pageCount, setPageCount] = useState(0);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | undefined>();
  const [splitMode, setSplitMode] = useState<SplitMode>("every");
  const [ranges, setRanges] = useState("1-2; 3-last");
  const [selectionRange, setSelectionRange] = useState("");
  const [rotateAngle, setRotateAngle] = useState("90");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [rejectedFiles, setRejectedFiles] = useState<string[]>([]);
  const [results, setResults] = useState<ToolResult[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedIndexes = useMemo(() => selectedPageIndexes(pages), [pages]);
  const selectedCount = selectedIndexes.length;
  const selectedTileCount = pages.filter((page) => page.selected).length;
  const selectedDeletedCount = pages.filter((page) => page.selected && page.deleted).length;
  const activeCount = pages.filter((page) => !page.deleted).length;
  const deletedCount = pages.filter((page) => page.deleted).length;
  const loadedThumbs = pages.filter((page) => page.status === "ready").length;
  const selectedRangeText = selectedCount > 0 ? pageIndexesToRangeText(selectedIndexes) : "None";
  const isOrganize = tool.id === "organize-pdf";
  const canRun = Boolean(file) && !isRunning && pages.length > 0;

  useEffect(() => {
    setResults([]);
    setError("");
    setProgress("");
    setSelectedPageId(undefined);
    setSplitMode("every");
    setRanges("1-2; 3-last");
    setSelectionRange("");
    setRotateAngle("90");
  }, [tool.id]);

  useEffect(() => {
    let cancelled = false;

    async function renderPages() {
      if (!file) {
        setPages([]);
        setPageCount(0);
        setIsRendering(false);
        return;
      }

      setIsRendering(true);
      setProgress(`Reading ${file.name}`);
      setPages([]);
      setPageCount(0);
      setError("");
      setResults([]);

      try {
        const count = await getRenderedPageCount(file);
        if (cancelled) return;
        setPageCount(count);
        const initialPages = Array.from({ length: count }, (_, index) => ({
          id: `page-${index + 1}`,
          pageIndex: index,
          pageNumber: index + 1,
          selected: tool.id === "rotate-pdf",
          deleted: false,
          rotation: 0,
          status: "loading" as const
        }));
        setPages(initialPages);
        setSelectedPageId(initialPages[0]?.id);

        for (let index = 0; index < count; index += 1) {
          if (cancelled) return;
          setProgress(`Rendering page ${index + 1} of ${count}`);
          try {
            const thumbnail = await renderPdfPage(file, index + 1, 0.24);
            if (cancelled) return;
            setPages((current) => current.map((page) => (
              page.pageIndex === index ? { ...page, status: "ready", thumbnail } : page
            )));
          } catch (caught) {
            if (cancelled) return;
            setPages((current) => current.map((page) => (
              page.pageIndex === index
                ? { ...page, status: "error", error: caught instanceof Error ? caught.message : "Could not render page." }
                : page
            )));
          }
        }

        if (!cancelled) {
          setProgress(`Ready: ${count} page${count === 1 ? "" : "s"} loaded`);
          setIsRendering(false);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not open this PDF.");
          setProgress("");
          setIsRendering(false);
        }
      }
    }

    void renderPages();

    return () => {
      cancelled = true;
    };
  }, [file, tool.id]);

  const setSelected = (predicate: (page: PageItem) => boolean) => {
    setPages((current) => current.map((page) => ({ ...page, selected: predicate(page) })));
    setResults([]);
  };

  const applySelectionRange = () => {
    if (pageCount < 1) return;
    try {
      const indexes = parsePageSelection(selectionRange, pageCount);
      const selected = new Set(indexes);
      setSelected((page) => !page.deleted && selected.has(page.pageIndex));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read that page range.");
    }
  };

  const invertSelection = () => {
    setSelected((page) => !page.deleted && !page.selected);
  };

  const updateSelectedPages = (update: (page: PageItem) => PageItem) => {
    setPages((current) => current.map((page) => (page.selected ? update(page) : page)));
    setResults([]);
  };

  const togglePage = (id: string) => {
    setPages((current) => current.map((page) => page.id === id ? { ...page, selected: !page.selected } : page));
    setSelectedPageId(id);
    setResults([]);
  };

  const addFile = (incoming: FileList | File[]) => {
    const files = Array.from(incoming);
    const accepted = files.filter((candidate) => acceptsFile(candidate, tool.accepts));
    const rejected = files.filter((candidate) => !acceptsFile(candidate, tool.accepts)).map((candidate) => candidate.name);
    setRejectedFiles(rejected);
    if (accepted[0]) setFile(accepted[0]);
  };

  const clearFile = () => {
    setFile(undefined);
    setPages([]);
    setPageCount(0);
    setResults([]);
    setError("");
    setProgress("");
  };

  const handleSortEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPages((current) => {
      const oldIndex = current.findIndex((page) => page.id === active.id);
      const newIndex = current.findIndex((page) => page.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
    setResults([]);
  };

  const moveSelectedPage = (direction: -1 | 1) => {
    if (!selectedPageId || !isOrganize) return;
    setPages((current) => {
      const index = current.findIndex((page) => page.id === selectedPageId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      return arrayMove(current, index, target);
    });
    setResults([]);
  };

  const runTool = async () => {
    if (!file) {
      setError("Add a PDF first.");
      return;
    }

    const validationMessage = validateRun(tool.id, pages, splitMode, ranges);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setIsRunning(true);
    setError("");
    setResults([]);
    setProgress("Preparing output");

    try {
      const processor = await tool.processor();
      const output = await processor(
        [file],
        buildPageWorkspaceOptions(tool.id, pages, { splitMode, ranges, rotateAngle }),
        { onProgress: setProgress }
      );
      setResults(output);
      setProgress(`Done: ${output.length} file${output.length === 1 ? "" : "s"} ready`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not run ${tool.title}.`);
      setProgress("");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="tool-workspace page-workspace">
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
          <p className="tool-tagline">{pageToolTitles[tool.id]}</p>
        </div>
      </section>

      <div className="page-workspace-grid">
        <section className="page-board-panel">
          <div
            className={`merge-dropzone page-dropzone ${isDraggingFiles ? "is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingFiles(true);
            }}
            onDragLeave={() => setIsDraggingFiles(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDraggingFiles(false);
              addFile(event.dataTransfer.files);
            }}
          >
            <input
              ref={inputRef}
              className="sr-only"
              data-testid="file-input"
              type="file"
              accept={tool.accepts}
              onChange={(event) => {
                if (event.currentTarget.files) addFile(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
            <span className="dropzone-icon">
              <Icon name={file ? "FileText" : "UploadCloud"} size={30} />
            </span>
            <div>
              <h2>{file ? file.name : "Add a PDF"}</h2>
              <p>{file ? `${pageCount || "..."} page${pageCount === 1 ? "" : "s"} · ${formatBytes(file.size)}` : "Drop a PDF here to open the visual page workspace."}</p>
              <small>{file ? "Your file stays in this browser tab." : tool.accepts.replaceAll(",", ", ")}</small>
            </div>
            <button className="button primary" type="button" onClick={() => inputRef.current?.click()}>
              {file ? "Replace" : "Choose PDF"}
            </button>
          </div>

          {rejectedFiles.length > 0 && (
            <p className="inline-alert" role="alert">
              Skipped unsupported file{rejectedFiles.length > 1 ? "s" : ""}: {rejectedFiles.join(", ")}
            </p>
          )}

          {file ? (
            <div className="page-board-shell">
              <div className="page-board-toolbar">
                <div>
                  <strong>{tool.id === "delete-pages" ? "Pages marked for removal" : "Selected pages"}</strong>
                  <span>{selectedRangeText}</span>
                </div>
                <div className="page-action-row" aria-label="Page selection actions">
                  <button className="button compact-button" type="button" onClick={() => setSelected((page) => !page.deleted)}>All</button>
                  <button className="button compact-button" type="button" onClick={() => setSelected(() => false)}>Clear</button>
                  <button className="button compact-button" type="button" onClick={() => setSelected((page) => !page.deleted && page.pageNumber % 2 === 1)}>Odd</button>
                  <button className="button compact-button" type="button" onClick={() => setSelected((page) => !page.deleted && page.pageNumber % 2 === 0)}>Even</button>
                  <button className="button compact-button" type="button" onClick={invertSelection}>Invert</button>
                </div>
              </div>
              <div className="page-range-selector">
                <label className="field compact-field">
                  <span>Select pages</span>
                  <input
                    aria-label="Select pages by range"
                    value={selectionRange}
                    placeholder="1-3, 5, last"
                    onChange={(event) => setSelectionRange(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applySelectionRange();
                    }}
                  />
                </label>
                <button className="button compact-button" type="button" onClick={applySelectionRange}>Apply</button>
                <small>Use all, first, last, odd, even, or ranges like 2-6.</small>
              </div>

              {isOrganize ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSortEnd}>
                  <SortableContext items={pages.map((page) => page.id)} strategy={rectSortingStrategy}>
                    <div className="page-thumbnail-grid" aria-label="PDF page thumbnails">
                      {pages.map((page) => (
                        <SortablePageTile
                          key={page.id}
                          page={page}
                          isActive={selectedPageId === page.id}
                          previewRotation={page.rotation ?? 0}
                          showRemovedOverlay={false}
                          onToggle={togglePage}
                          onSelect={setSelectedPageId}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="page-thumbnail-grid" aria-label="PDF page thumbnails">
                  {pages.map((page) => (
                    <PageTile
                      key={page.id}
                      page={page}
                      isActive={selectedPageId === page.id}
                      previewRotation={(page.rotation ?? 0) + (tool.id === "rotate-pdf" && page.selected ? Number(rotateAngle) : 0)}
                      showRemovedOverlay={tool.id === "delete-pages" && Boolean(page.selected)}
                      onToggle={togglePage}
                      onSelect={setSelectedPageId}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="merge-empty-state page-empty-state">
              <Icon name="LayoutGrid" size={30} />
              <strong>Visual page workspace</strong>
              <span>After upload, every page gets a thumbnail so you can select, reorder, delete, or rotate with confidence.</span>
            </div>
          )}

          {error && <p className="error-copy">{error}</p>}
          {progress && (
            <p className="progress-copy">
              {(isRunning || isRendering) && <Icon name="Loader2" className="spin" size={16} />}
              {progress}
            </p>
          )}
          <button className="button run-button" type="button" disabled={!canRun} onClick={runTool}>
            {isRunning ? <Icon name="Loader2" className="spin" size={18} /> : <Icon name={tool.icon} size={18} />}
            {primaryActionLabel(tool.id, splitMode)}
          </button>
          <ResultList results={results} />
        </section>

        <aside className="page-control-panel">
          <section>
            <h2>Controls</h2>
            <ToolSpecificControls
              toolId={tool.id}
              splitMode={splitMode}
              ranges={ranges}
              rotateAngle={rotateAngle}
              selectedCount={selectedCount}
              deletedCount={deletedCount}
              selectedDeletedCount={selectedDeletedCount}
              onSplitModeChange={setSplitMode}
              onRangesChange={setRanges}
              onRotateAngleChange={setRotateAngle}
              onRotateSelected={(delta) => updateSelectedPages((page) => ({ ...page, rotation: (page.rotation ?? 0) + delta }))}
              onDeleteSelected={() => updateSelectedPages((page) => ({ ...page, deleted: true, selected: false }))}
              onRestoreSelected={() => updateSelectedPages((page) => ({ ...page, deleted: false }))}
              onMoveSelected={moveSelectedPage}
              onReverse={() => {
                setPages((current) => [...current].reverse());
                setResults([]);
              }}
              onReset={() => {
                setPages((current) => [...current].sort((a, b) => a.pageIndex - b.pageIndex).map((page) => ({
                  ...page,
                  selected: tool.id === "rotate-pdf",
                  deleted: false,
                  rotation: 0
                })));
                setResults([]);
              }}
            />
          </section>

          <section>
            <h2>Summary</h2>
            <div className="merge-stats">
              <span>Pages</span>
              <strong>{pageCount || 0}</strong>
              <span>Thumbnails</span>
              <strong>{loadedThumbs}/{pageCount || 0}</strong>
              <span>Selected</span>
              <strong>{selectedTileCount}</strong>
              <span>Active output</span>
              <strong>{activeCount}</strong>
              <span>Removed</span>
              <strong>{deletedCount}</strong>
            </div>
            {isOrganize && pageRotationsJson(pages) !== "{}" && (
              <p className="quiet-copy">Some pages will be permanently rotated in the organized PDF.</p>
            )}
            {tool.id === "rotate-pdf" && (
              <p className="quiet-copy">Rotation is previewed on selected thumbnails and applied permanently on export.</p>
            )}
          </section>

          <button className="button" type="button" disabled={!file} onClick={clearFile}>
            Clear file
          </button>
        </aside>
      </div>
    </div>
  );
}

function ToolSpecificControls({
  toolId,
  splitMode,
  ranges,
  rotateAngle,
  selectedCount,
  deletedCount,
  selectedDeletedCount,
  onSplitModeChange,
  onRangesChange,
  onRotateAngleChange,
  onRotateSelected,
  onDeleteSelected,
  onRestoreSelected,
  onMoveSelected,
  onReverse,
  onReset
}: {
  toolId: PageToolId;
  splitMode: SplitMode;
  ranges: string;
  rotateAngle: string;
  selectedCount: number;
  deletedCount: number;
  selectedDeletedCount: number;
  onSplitModeChange: (mode: SplitMode) => void;
  onRangesChange: (value: string) => void;
  onRotateAngleChange: (value: string) => void;
  onRotateSelected: (delta: number) => void;
  onDeleteSelected: () => void;
  onRestoreSelected: () => void;
  onMoveSelected: (direction: -1 | 1) => void;
  onReverse: () => void;
  onReset: () => void;
}) {
  if (toolId === "split-pdf") {
    return (
      <div className="page-controls-stack">
        <div className="segmented compact">
          {[
            ["every", "Every page"],
            ["selected", "Selected"],
            ["ranges", "Ranges"]
          ].map(([value, label]) => (
            <button key={value} className={splitMode === value ? "active" : ""} type="button" onClick={() => onSplitModeChange(value as SplitMode)}>
              {label}
            </button>
          ))}
        </div>
        {splitMode === "selected" && <p className="quiet-copy">Selected pages become separate output PDFs. Selected: {selectedCount}</p>}
        {splitMode === "ranges" && (
          <label className="field">
            <span>Ranges</span>
            <textarea value={ranges} rows={4} onChange={(event) => onRangesChange(event.currentTarget.value)} />
            <small>Use semicolons for separate files, like `1-2; 3; last`.</small>
          </label>
        )}
      </div>
    );
  }

  if (toolId === "organize-pdf") {
    return (
      <div className="page-controls-stack">
        <div className="page-action-row">
          <button className="button compact-button" type="button" onClick={() => onMoveSelected(-1)}>Move up</button>
          <button className="button compact-button" type="button" onClick={() => onMoveSelected(1)}>Move down</button>
        </div>
        <div className="page-action-row">
          <button className="button compact-button" type="button" onClick={() => onRotateSelected(-90)}>Rotate left</button>
          <button className="button compact-button" type="button" onClick={() => onRotateSelected(90)}>Rotate right</button>
        </div>
        <div className="page-action-row">
          <button className="button compact-button danger-button" type="button" disabled={selectedCount === 0} onClick={onDeleteSelected}>Remove selected</button>
          <button className="button compact-button" type="button" disabled={selectedDeletedCount === 0 || deletedCount === 0} onClick={onRestoreSelected}>Restore selected</button>
        </div>
        <div className="page-action-row">
          <button className="button compact-button" type="button" onClick={onReverse}>Reverse order</button>
          <button className="button compact-button" type="button" onClick={onReset}>Reset</button>
        </div>
      </div>
    );
  }

  if (toolId === "rotate-pdf") {
    return (
      <div className="page-controls-stack">
        <label className="field">
          <span>Angle</span>
          <select value={rotateAngle} onChange={(event) => onRotateAngleChange(event.currentTarget.value)}>
            <option value="90">90 degrees</option>
            <option value="180">180 degrees</option>
            <option value="270">270 degrees</option>
          </select>
        </label>
        <p className="quiet-copy">Selected: {selectedCount}. Use All, Odd, Even, or click thumbnails.</p>
      </div>
    );
  }

  if (toolId === "delete-pages") {
    return <p className="quiet-copy">Click pages to mark them for removal. Selected pages show a removal overlay before export.</p>;
  }

  return <p className="quiet-copy">Click pages to include them in the extracted PDF. Use range buttons for faster batch selection.</p>;
}

function SortablePageTile(props: Parameters<typeof PageTile>[0]) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.page.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "page-sort-shell is-sorting" : "page-sort-shell"}>
      <button className="page-drag-handle" type="button" aria-label={`Drag page ${props.page.pageNumber}`} {...attributes} {...listeners}>
        <Icon name="GripVertical" size={16} />
      </button>
      <PageTile {...props} />
    </div>
  );
}

function PageTile({
  page,
  isActive,
  previewRotation,
  showRemovedOverlay,
  onToggle,
  onSelect
}: {
  page: PageItem;
  isActive: boolean;
  previewRotation: number;
  showRemovedOverlay: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const isRemoved = page.deleted || showRemovedOverlay;

  return (
    <button
      className={`page-tile ${page.selected ? "is-selected" : ""} ${isRemoved ? "is-deleted" : ""} ${isActive ? "is-active" : ""}`}
      type="button"
      onClick={() => onToggle(page.id)}
      onFocus={() => onSelect(page.id)}
    >
      <div className="page-tile-canvas" style={{ transform: `rotate(${previewRotation}deg)` }}>
        {page.status === "ready" && page.thumbnail ? (
          <PageCanvas page={page.thumbnail} pageNumber={page.pageNumber} />
        ) : page.status === "error" ? (
          <Icon name="FileWarning" size={24} />
        ) : (
          <Icon name="Loader2" className="spin" size={22} />
        )}
      </div>
      {isRemoved && <span className="page-delete-overlay">Removed</span>}
      {page.selected && !isRemoved && <span className="page-selected-badge"><Icon name="Check" size={14} /></span>}
      <span className="page-tile-footer">Page {page.pageNumber}</span>
    </button>
  );
}

function PageCanvas({ page, pageNumber }: { page: RenderedPage; pageNumber: number }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!container) return;
    page.canvas.className = "page-thumbnail-canvas";
    page.canvas.setAttribute("aria-label", `Page ${pageNumber} preview`);
    container.replaceChildren(page.canvas);
  }, [container, page, pageNumber]);

  return <div ref={setContainer} />;
}

function validateRun(toolId: PageToolId, pages: PageItem[], splitMode: SplitMode, ranges: string): string {
  if (pages.length === 0) return "Add a PDF first.";
  const selected = selectedPageIndexes(pages);

  if (toolId === "split-pdf") {
    if (splitMode === "selected" && selected.length === 0) return "Select at least one page to split out.";
    if (splitMode === "ranges" && ranges.trim().length === 0) return "Enter at least one split range.";
    return "";
  }

  if (toolId === "organize-pdf") {
    if (pages.every((page) => page.deleted)) return "At least one page must remain in the organized PDF.";
    return "";
  }

  if (selected.length === 0) return "Select at least one page.";
  if (toolId === "delete-pages" && selected.length >= pages.length) return "Deleting every page would create an empty PDF.";
  return "";
}

function primaryActionLabel(toolId: PageToolId, splitMode: SplitMode): string {
  if (toolId === "split-pdf") return splitMode === "every" ? "Split Every Page" : "Split PDF";
  if (toolId === "extract-pages") return "Extract Selected Pages";
  if (toolId === "delete-pages") return "Remove Selected Pages";
  if (toolId === "organize-pdf") return "Organize PDF";
  return "Rotate Selected Pages";
}
