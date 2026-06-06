import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ToolOptions } from "../types";
import {
  applyAspectRatio,
  clampPercentRegion,
  formatPercentRegion,
  formatPercentRegions,
  movePercentRegion,
  normalizeDragRegion,
  parsePercentRegions,
  replacePercentRegion,
  resizePercentRegion,
  ratioFromOption,
  type PercentRegion,
  type RegionResizeHandle
} from "../utils/regions";

type ImageRegionSelectorProps = {
  file: File | undefined;
  label: string;
  mode: "single" | "multi";
  optionName: string;
  aspectRatio?: string;
  defaultRegion?: PercentRegion;
  options: ToolOptions;
  onChange: (options: ToolOptions) => void;
};

type Point = {
  x: number;
  y: number;
};

type Interaction =
  | {
    type: "draw";
    start: Point;
    current: Point;
  }
  | {
    type: "move";
    index: number;
    start: Point;
    region: PercentRegion;
  }
  | {
    type: "resize";
    index: number;
    handle: RegionResizeHandle;
    start: Point;
    region: PercentRegion;
  };

type DragState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

export function ImageRegionSelector({
  file,
  label,
  mode,
  optionName,
  aspectRatio,
  defaultRegion,
  options,
  onChange
}: ImageRegionSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [url, setUrl] = useState("");
  const [interaction, setInteraction] = useState<Interaction | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [didApplyDefault, setDidApplyDefault] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!file || !isBrowserSupportedImage(file)) {
      setUrl("");
      setImageSize(null);
      setDidApplyDefault(false);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    setImageSize(null);
    setDidApplyDefault(false);
    const image = new Image();
    image.onload = () => {
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.src = nextUrl;
    return () => {
      image.onload = null;
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  const regions = useMemo(() => parsePercentRegions(String(options[optionName] ?? "")), [optionName, options]);
  const ratio = ratioFromOption(aspectRatio);
  const sourceAspectRatio = imageSize && imageSize.width > 0 && imageSize.height > 0 ? imageSize.width / imageSize.height : 1;
  const drawRegion = interaction?.type === "draw"
    ? applyAspectRatio(
      normalizeDragRegion({
        startX: interaction.start.x,
        startY: interaction.start.y,
        currentX: interaction.current.x,
        currentY: interaction.current.y
      }),
      ratio,
      sourceAspectRatio
    )
    : null;
  const activeRegion = regions[activeIndex];

  const setInteractionState = (next: Interaction | null) => {
    interactionRef.current = next;
    setInteraction(next);
  };

  useEffect(() => {
    if (!url || didApplyDefault || mode !== "single" || regions.length > 0 || !defaultRegion) return;
    onChange({ ...options, [optionName]: formatPercentRegion(defaultRegion) });
    setDidApplyDefault(true);
  }, [defaultRegion, didApplyDefault, mode, onChange, optionName, options, regions.length, url]);

  useEffect(() => {
    if (activeIndex < regions.length) return;
    setActiveIndex(Math.max(0, regions.length - 1));
  }, [activeIndex, regions.length]);

  const setRegions = (nextRegions: PercentRegion[]) => {
    const next = mode === "single" ? nextRegions.slice(0, 1) : nextRegions;
    onChange({ ...options, [optionName]: formatPercentRegions(next) });
  };

  const addRegion = () => {
    const region = clampPercentRegion(defaultRegion ?? {
      x: 10,
      y: 10,
      width: mode === "single" ? 80 : 35,
      height: mode === "single" ? 80 : 20
    });
    const next = mode === "multi" ? [...regions, region] : [region];
    setRegions(next);
    setActiveIndex(next.length - 1);
  };

  const commitRegion = (state: DragState) => {
    const normalized = applyAspectRatio(normalizeDragRegion(state), ratio, sourceAspectRatio);
    if (normalized.width < 1 || normalized.height < 1) return;

    const next = mode === "multi" ? [...regions, normalized] : [normalized];
    setRegions(next);
    setActiveIndex(next.length - 1);
  };

  const clientPointToPercent = (clientX: number, clientY: number): Point => {
    const imageRect = imageRef.current?.getBoundingClientRect();
    const rect = imageRect && imageRect.width > 0 && imageRect.height > 0
      ? imageRect
      : containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100, 0, 100)
    };
  };

  const pointerToPercent = (event: React.PointerEvent): Point => clientPointToPercent(event.clientX, event.clientY);

  const applyInteraction = (point: Point, finish = false) => {
    const currentInteraction = interactionRef.current;
    if (!currentInteraction) return;

    if (currentInteraction.type === "draw") {
      if (finish) {
        commitRegion({
          startX: currentInteraction.start.x,
          startY: currentInteraction.start.y,
          currentX: point.x,
          currentY: point.y
        });
        setInteractionState(null);
      } else {
        setInteractionState({ ...currentInteraction, current: point });
      }
      return;
    }

    const deltaX = point.x - currentInteraction.start.x;
    const deltaY = point.y - currentInteraction.start.y;
    const nextRegion = currentInteraction.type === "move"
      ? movePercentRegion(currentInteraction.region, deltaX, deltaY)
      : resizePercentRegion(currentInteraction.region, currentInteraction.handle, deltaX, deltaY, ratio, sourceAspectRatio);
    setRegions(replacePercentRegion(regions, currentInteraction.index, nextRegion));
    if (finish) setInteractionState(null);
  };

  const beginRegionInteraction = (nextInteraction: Extract<Interaction, { type: "move" | "resize" }>) => {
    setInteractionState(nextInteraction);

    const handlePointerMove = (event: PointerEvent | MouseEvent) => {
      const point = clientPointToPercent(event.clientX, event.clientY);
      const deltaX = point.x - nextInteraction.start.x;
      const deltaY = point.y - nextInteraction.start.y;
      const nextRegion = nextInteraction.type === "move"
        ? movePercentRegion(nextInteraction.region, deltaX, deltaY)
        : resizePercentRegion(nextInteraction.region, nextInteraction.handle, deltaX, deltaY, ratio, sourceAspectRatio);
      setRegions(replacePercentRegion(regions, nextInteraction.index, nextRegion));
    };

    const endInteraction = (event: PointerEvent | MouseEvent) => {
      handlePointerMove(event);
      setInteractionState(null);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", endInteraction);
      window.removeEventListener("pointercancel", endInteraction);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", endInteraction);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", endInteraction);
    window.addEventListener("pointercancel", endInteraction);
    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", endInteraction);
  };

  const beginExistingRegionInteraction = (target: HTMLElement, point: Point): boolean => {
    const regionElement = target.closest<HTMLElement>("[data-region-index]");
    if (!regionElement) return false;

    const index = Number(regionElement.dataset.regionIndex);
    const region = regions[index];
    if (!region) return false;

    const handleElement = target.closest<HTMLElement>("[data-region-handle]");
    setActiveIndex(index);
    if (handleElement) {
      beginRegionInteraction({
        type: "resize",
        index,
        handle: handleElement.dataset.regionHandle as RegionResizeHandle,
        start: point,
        region
      });
      return true;
    }

    beginRegionInteraction({ type: "move", index, start: point, region });
    return true;
  };

  const updateActiveRegion = (region: PercentRegion) => {
    if (!activeRegion) return;
    setRegions(replacePercentRegion(regions, activeIndex, applyAspectRatio(clampPercentRegion(region), ratio, sourceAspectRatio)));
  };

  const updateActiveRegionSize = (dimension: "width" | "height", value: number) => {
    if (!activeRegion) return;
    if (!ratio) {
      setRegions(replacePercentRegion(regions, activeIndex, clampPercentRegion({ ...activeRegion, [dimension]: value })));
      return;
    }

    const percentRatio = ratio / Math.max(sourceAspectRatio, 0.0001);
    const next = dimension === "width"
      ? { ...activeRegion, width: value, height: value / percentRatio }
      : { ...activeRegion, height: value, width: value * percentRatio };
    setRegions(replacePercentRegion(regions, activeIndex, clampPercentRegion(next)));
  };

  const removeActiveRegion = () => {
    if (!activeRegion) return;
    const next = regions.filter((_, index) => index !== activeIndex);
    setRegions(next);
    setActiveIndex(Math.max(0, activeIndex - 1));
  };

  const duplicateActiveRegion = () => {
    if (!activeRegion || mode !== "multi") return;
    const next = [
      ...regions,
      movePercentRegion(activeRegion, 3, 3)
    ];
    setRegions(next);
    setActiveIndex(next.length - 1);
  };

  if (!url) return null;

  return (
    <section className="region-selector" aria-label={label}>
      <div className="section-heading">
        <h2>{label}</h2>
        <div className="region-toolbar">
          <button className="button compact-button" type="button" onClick={addRegion}>
            Add region
          </button>
          {mode === "multi" && (
            <button className="button compact-button" type="button" disabled={!activeRegion} onClick={duplicateActiveRegion}>
              Duplicate
            </button>
          )}
          <button className="button compact-button danger-button" type="button" disabled={!activeRegion} onClick={removeActiveRegion}>
            Delete
          </button>
          <button className="button compact-button" type="button" onClick={() => onChange({ ...options, [optionName]: "" })}>
            Clear
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="region-canvas"
        onPointerDown={(event) => {
          if (beginExistingRegionInteraction(event.target as HTMLElement, pointerToPercent(event))) {
            event.preventDefault();
            return;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = pointerToPercent(event);
          setInteractionState({ type: "draw", start: point, current: point });
        }}
        onMouseDown={(event) => {
          const point = clientPointToPercent(event.clientX, event.clientY);
          if (beginExistingRegionInteraction(event.target as HTMLElement, point)) {
            event.preventDefault();
            return;
          }
          if (!interactionRef.current) {
            setInteractionState({ type: "draw", start: point, current: point });
          }
          const handleMouseMove = (moveEvent: MouseEvent) => {
            applyInteraction(clientPointToPercent(moveEvent.clientX, moveEvent.clientY));
          };
          const endMouseDraw = (upEvent: MouseEvent) => {
            applyInteraction(clientPointToPercent(upEvent.clientX, upEvent.clientY), true);
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", endMouseDraw);
          };
          window.addEventListener("mousemove", handleMouseMove);
          window.addEventListener("mouseup", endMouseDraw);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          applyInteraction(pointerToPercent(event));
        }}
        onPointerUp={(event) => {
          applyInteraction(pointerToPercent(event), true);
        }}
        onPointerCancel={() => setInteractionState(null)}
      >
        <img
          ref={imageRef}
          src={url}
          alt=""
          draggable={false}
          onLoad={(event) => {
            setImageSize({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight
            });
          }}
        />
        {regions.map((region, index) => (
          <button
            aria-label={`${label} region ${index + 1}`}
            className={`region-box ${activeIndex === index ? "active" : ""}`}
            data-region-control="true"
            data-region-index={index}
            key={`${region.x}-${region.y}-${index}`}
            style={regionStyle(region)}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setActiveIndex(index);
            }}
          >
            {(["nw", "ne", "sw", "se"] as const).map((handle) => (
              <span
                aria-hidden="true"
                className={`region-handle ${handle}`}
                data-region-control="true"
                data-region-handle={handle}
                key={handle}
              />
            ))}
          </button>
        ))}
        {drawRegion && <span className="region-box drawing" style={regionStyle(drawRegion)} />}
      </div>
      {activeRegion && (
        <div className="region-details" aria-label="Selected region details">
          <label className="field">
            <span>X</span>
            <input type="number" value={round(activeRegion.x)} min={0} max={100} step={0.1} onChange={(event) => updateActiveRegion({ ...activeRegion, x: Number(event.currentTarget.value) })} />
          </label>
          <label className="field">
            <span>Y</span>
            <input type="number" value={round(activeRegion.y)} min={0} max={100} step={0.1} onChange={(event) => updateActiveRegion({ ...activeRegion, y: Number(event.currentTarget.value) })} />
          </label>
          <label className="field">
            <span>W</span>
            <input type="number" value={round(activeRegion.width)} min={1} max={100} step={0.1} onChange={(event) => updateActiveRegionSize("width", Number(event.currentTarget.value))} />
          </label>
          <label className="field">
            <span>H</span>
            <input type="number" value={round(activeRegion.height)} min={1} max={100} step={0.1} onChange={(event) => updateActiveRegionSize("height", Number(event.currentTarget.value))} />
          </label>
        </div>
      )}
      {regions.length > 1 && (
        <div className="region-list" aria-label={`${label} regions`}>
          {regions.map((region, index) => (
            <button className={activeIndex === index ? "active" : ""} type="button" key={`${region.x}-${region.y}-${index}`} onClick={() => setActiveIndex(index)}>
              {index + 1}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function isBrowserSupportedImage(file: File): boolean {
  return /^image\/(png|jpeg|webp|gif)$/i.test(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

function regionStyle(region: PercentRegion): CSSProperties {
  return {
    left: `${region.x}%`,
    top: `${region.y}%`,
    width: `${region.width}%`,
    height: `${region.height}%`
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
