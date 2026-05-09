import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ToolOptions } from "../types";

type ImageRegionSelectorProps = {
  file: File | undefined;
  label: string;
  mode: "single" | "multi";
  optionName: string;
  options: ToolOptions;
  onChange: (options: ToolOptions) => void;
};

type DragState = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type PercentRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function ImageRegionSelector({ file, label, mode, optionName, options, onChange }: ImageRegionSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setUrl("");
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  const regions = useMemo(() => parsePercentRegions(String(options[optionName] ?? "")), [optionName, options]);
  const dragRegion = drag ? normalizeDrag(drag) : null;

  if (!url) return null;

  const commitRegion = (state: DragState) => {
    const normalized = normalizeDrag(state);
    if (normalized.width < 1 || normalized.height < 1) return;

    const value = formatPercentRegion(normalized);
    const previous = String(options[optionName] ?? "").trim();
    const nextValue = mode === "multi" && previous ? `${previous}; ${value}` : value;
    onChange({ ...options, [optionName]: nextValue });
  };

  const pointerToPercent = (event: React.PointerEvent): { x: number; y: number } => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100)
    };
  };

  return (
    <section className="region-selector" aria-label={label}>
      <div className="section-heading">
        <h2>{label}</h2>
        <button className="button" type="button" onClick={() => onChange({ ...options, [optionName]: "" })}>
          Clear
        </button>
      </div>
      <div
        ref={containerRef}
        className="region-canvas"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = pointerToPercent(event);
          setDrag({ startX: point.x, startY: point.y, currentX: point.x, currentY: point.y });
        }}
        onPointerMove={(event) => {
          if (!drag) return;
          const point = pointerToPercent(event);
          setDrag({ ...drag, currentX: point.x, currentY: point.y });
        }}
        onPointerUp={(event) => {
          if (!drag) return;
          const point = pointerToPercent(event);
          const finalDrag = { ...drag, currentX: point.x, currentY: point.y };
          commitRegion(finalDrag);
          setDrag(null);
        }}
        onPointerCancel={() => setDrag(null)}
      >
        <img src={url} alt="" draggable={false} />
        {regions.map((region, index) => (
          <span className="region-box" key={`${region.x}-${region.y}-${index}`} style={regionStyle(region)} />
        ))}
        {dragRegion && <span className="region-box active" style={regionStyle(dragRegion)} />}
      </div>
      <p className="quiet-copy">Drag on the image to set {mode === "single" ? "the region" : "one or more regions"}.</p>
    </section>
  );
}

function parsePercentRegions(value: string): PercentRegion[] {
  return value
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map<PercentRegion | null>((part) => {
      const values = part.split(",").map((token) => Number(token.trim().replace("%", "")));
      if (values.length !== 4 || values.some((number) => !Number.isFinite(number))) return null;
      const [x, y, width, height] = values;
      return { x, y, width, height };
    })
    .filter((region): region is PercentRegion => region !== null);
}

function normalizeDrag(drag: DragState): PercentRegion {
  const x = Math.min(drag.startX, drag.currentX);
  const y = Math.min(drag.startY, drag.currentY);
  const width = Math.abs(drag.currentX - drag.startX);
  const height = Math.abs(drag.currentY - drag.startY);
  return { x, y, width, height };
}

function regionStyle(region: PercentRegion): CSSProperties {
  return {
    left: `${region.x}%`,
    top: `${region.y}%`,
    width: `${region.width}%`,
    height: `${region.height}%`
  };
}

function formatPercentRegion(region: PercentRegion): string {
  return [region.x, region.y, region.width, region.height].map((value) => `${clamp(value, 0, 100).toFixed(1)}%`).join(",");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
