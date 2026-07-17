import * as fabric from 'fabric';

export type ImageClipShape = 'rectangle' | 'circle' | 'ellipse';

/**
 * Apply (or clear) a clip mask on a Fabric image.
 * Clip geometry uses the object's local (unscaled) width/height so it scales with the image.
 */
export function applyImageClipShape(
  fabricImg: fabric.Image | fabric.Object,
  clipShape?: ImageClipShape | string | null
): void {
  if (!clipShape || clipShape === 'rectangle') {
    fabricImg.set('clipPath', undefined);
    return;
  }

  const ow = fabricImg.width ?? 100;
  const oh = fabricImg.height ?? 100;
  const cx = ow / 2;
  const cy = oh / 2;

  const clipPath =
    clipShape === 'circle'
      ? new fabric.Circle({
          radius: Math.min(cx, cy),
          originX: 'center',
          originY: 'center',
        })
      : new fabric.Ellipse({
          rx: cx,
          ry: cy,
          originX: 'center',
          originY: 'center',
        });

  fabricImg.set('clipPath', clipPath);
}
