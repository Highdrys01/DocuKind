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

declare module "upng-js" {
  type DecodedPng = {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    data: ArrayBuffer;
    tabs: Record<string, unknown>;
    frames: Array<Record<string, unknown>>;
  };

  const UPNG: {
    encode(imgs: ArrayBuffer[], width: number, height: number, colors: number, delays?: number[]): ArrayBuffer;
    decode(buffer: ArrayBuffer): DecodedPng;
    toRGBA8(image: DecodedPng): ArrayBuffer[];
  };

  export default UPNG;
}
