/** Bake crop, scaling and colour treatments once, outside the frame loop. */
export class RenderCache {
  private images = new Map<string, HTMLCanvasElement>();
  builds = 0;
  get size() {
    return this.images.size;
  }
  clear() {
    this.images.clear();
  }
  surface(
    key: string,
    width: number,
    height: number,
    paint: (c: CanvasRenderingContext2D) => void,
    scale = 2,
  ): HTMLCanvasElement {
    const cached = this.images.get(key);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const c = canvas.getContext("2d")!;
    c.scale(scale, scale);
    paint(c);
    this.images.set(key, canvas);
    this.builds++;
    return canvas;
  }
  sprite(
    key: string,
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    width: number,
    height: number,
    filter = "",
  ) {
    return this.surface(
      key + (filter ? ":" + filter : ""),
      width,
      height,
      (c) => {
        c.filter = filter || "none";
        c.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
      },
    );
  }
}
