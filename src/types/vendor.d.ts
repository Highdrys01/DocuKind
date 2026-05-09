declare module "pica" {
  type PicaCanvas = HTMLCanvasElement | OffscreenCanvas;
  type PicaInstance = {
    resize(from: CanvasImageSource, to: PicaCanvas, options?: Record<string, unknown>): Promise<PicaCanvas>;
    toBlob(canvas: PicaCanvas, mimeType: string, quality?: number): Promise<Blob>;
  };

  export default function pica(config?: Record<string, unknown>): PicaInstance;
}

declare module "gifenc" {
  export type GifPalette = number[][];

  export function GIFEncoder(options?: Record<string, unknown>): {
    writeFrame(index: Uint8Array, width: number, height: number, options?: Record<string, unknown>): void;
    finish(): void;
    bytes(): Uint8Array;
  };

  export function quantize(data: Uint8Array | Uint8ClampedArray, maxColors: number, options?: Record<string, unknown>): GifPalette;
  export function applyPalette(data: Uint8Array | Uint8ClampedArray, palette: GifPalette, format?: string): Uint8Array;
}
