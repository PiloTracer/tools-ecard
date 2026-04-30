import * as fabric from 'fabric';

/**
 * Same geometry read as template save (`mergeLiveCanvasGeometryIntoTemplate`).
 * Raw `.left`/`.top` can disagree with the visual anchor for groups, ActiveSelection
 * children, or after Fabric layout passes — `getPointByOrigin('left','top')` is stable.
 */
export function readPersistedTemplateGeometry(obj: fabric.FabricObject): {
  x: number;
  y: number;
  rotation: number;
} {
  obj.setCoords();
  const p = obj.getPointByOrigin('left', 'top');
  const angle = typeof obj.angle === 'number' && !Number.isNaN(obj.angle) ? obj.angle : 0;
  return {
    x: Math.round(p.x),
    y: Math.round(p.y),
    rotation: angle,
  };
}

/**
 * Apply stored template x/y/rotation so reopen matches persist (inverse of read).
 */
export function applyPersistedTemplateGeometry(
  obj: fabric.FabricObject,
  x: number,
  y: number,
  rotation?: number
): void {
  if (rotation !== undefined && typeof rotation === 'number' && !Number.isNaN(rotation)) {
    obj.set({ angle: rotation });
  }
  obj.setPositionByOrigin(new fabric.Point(x, y), 'left', 'top');
  obj.setCoords();
}
