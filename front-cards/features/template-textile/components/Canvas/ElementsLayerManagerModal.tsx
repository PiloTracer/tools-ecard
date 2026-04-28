'use client';

import * as fabric from 'fabric';
import { useMemo } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { useTemplateStore } from '../../stores/templateStore';
import type { TemplateElement, TextElement } from '../../types';
import { isImageElement, isQRElement, isShapeElement, isTextElement } from '../../types';

type Props = {
  open: boolean;
  onClose: () => void;
};

function elementSummary(el: TemplateElement): string {
  if (isTextElement(el)) {
    const t = (el as TextElement).text?.trim().slice(0, 36) || '(empty)';
    return t.length >= 36 ? `${t}…` : t;
  }
  if (isImageElement(el)) return el.imageUrl ? 'Image' : 'Image (no file)';
  if (isQRElement(el)) return 'QR code';
  if (isShapeElement(el)) return `Shape: ${el.shapeType}`;
  return el.type;
}

function approxSize(el: TemplateElement): { w: number; h: number } {
  if (isQRElement(el)) {
    const s = el.size || 100;
    return { w: s, h: s };
  }
  const w = 'width' in el && typeof el.width === 'number' && el.width > 0 ? el.width : 80;
  const h = 'height' in el && typeof el.height === 'number' && el.height > 0 ? el.height : 40;
  if (isTextElement(el)) {
    return { w: Math.max(w, 40), h: Math.max(h, (el as TextElement).fontSize * 1.25) };
  }
  return { w, h };
}

function centerOnCanvas(
  cw: number,
  ch: number,
  w: number,
  h: number
): { x: number; y: number } {
  const nx = Math.round(Math.max(0, Math.min(cw / 2 - w / 2, cw - w)));
  const ny = Math.round(Math.max(0, Math.min(ch / 2 - h / 2, ch - h)));
  return { x: nx, y: ny };
}

function storeBBoxIntersectsCanvas(el: TemplateElement, cw: number, ch: number): boolean {
  const { w, h } = approxSize(el);
  const r = el.x + w;
  const b = el.y + h;
  return !(el.x >= cw || r <= 0 || el.y >= ch || b <= 0);
}

function analyze(
  el: TemplateElement,
  fabricObj: fabric.Object | undefined,
  cw: number,
  ch: number
): { flags: string[]; onScreen: boolean } {
  const flags: string[] = [];
  const op = el.opacity ?? 1;
  if (op < 0.05) flags.push('opacity ~0');

  if (fabricObj) {
    if (fabricObj.visible === false) flags.push('visible=false');
    if (fabricObj.selectable === false) flags.push('not selectable');
    fabricObj.setCoords();
    const br = fabricObj.getBoundingRect();
    const onScreen = !(
      br.left >= cw ||
      br.left + br.width <= 0 ||
      br.top >= ch ||
      br.top + br.height <= 0
    );
    if (!onScreen) flags.push('off canvas (Fabric bbox)');
    if (br.width < 2 && br.height < 2) flags.push('bbox nearly zero');
    if (flags.length === 0) flags.push('on canvas');
    return { flags, onScreen };
  }

  if (!storeBBoxIntersectsCanvas(el, cw, ch)) flags.push('off canvas (approx. data)');
  flags.unshift('no object on canvas');
  return { flags, onScreen: storeBBoxIntersectsCanvas(el, cw, ch) };
}

export function ElementsLayerManagerModal({ open, onClose }: Props) {
  const fabricCanvas = useCanvasStore((s) => s.fabricCanvas);
  const setSelectedElements = useCanvasStore((s) => s.setSelectedElements);
  const requestCanvasRebindForElementIds = useCanvasStore((s) => s.requestCanvasRebindForElementIds);
  const elements = useTemplateStore((s) => s.elements);
  const canvasWidth = useTemplateStore((s) => s.canvasWidth);
  const canvasHeight = useTemplateStore((s) => s.canvasHeight);
  const updateElement = useTemplateStore((s) => s.updateElement);
  const removeElements = useTemplateStore((s) => s.removeElements);

  const rows = useMemo(() => {
    return elements.map((el) => {
      const fo = fabricCanvas
        ?.getObjects()
        .find((o) => (o as { elementId?: string }).elementId === el.id) as fabric.Object | undefined;
      const { flags, onScreen } = analyze(el, fo, canvasWidth, canvasHeight);
      return { el, fabricObj: fo, flags, onScreen };
    });
  }, [elements, fabricCanvas, canvasWidth, canvasHeight]);

  const orphanFabricObjects = useMemo(() => {
    if (!fabricCanvas) return [] as fabric.Object[];
    const ids = new Set(elements.map((e) => e.id));
    return fabricCanvas
      .getObjects()
      .filter((o) => {
        const id = (o as { elementId?: string }).elementId;
        return Boolean(id) && !ids.has(id as string) && !(o as { isGrid?: boolean }).isGrid;
      });
  }, [fabricCanvas, elements]);

  if (!open) return null;

  const selectRow = (fabricObj: fabric.Object | undefined, id: string) => {
    if (!fabricCanvas) return;
    fabricCanvas.discardActiveObject();
    if (fabricObj) {
      fabricCanvas.setActiveObject(fabricObj);
    }
    setSelectedElements([id]);
    fabricCanvas.requestRenderAll?.();
    fabricCanvas.renderAll();
  };

  const bringIntoCanvas = (id: string, el: TemplateElement, fo: fabric.Object | undefined) => {
    if (fabricCanvas && fo) {
      fo.setCoords();
      const br = fo.getBoundingRect();
      const bx = br.left + br.width / 2;
      const by = br.top + br.height / 2;
      const dcx = canvasWidth / 2 - bx;
      const dcy = canvasHeight / 2 - by;
      const newX = Math.round((fo.left || 0) + dcx);
      const newY = Math.round((fo.top || 0) + dcy);
      updateElement(id, { x: newX, y: newY });
      selectRow(fo, id);
    } else {
      const { w, h } = approxSize(el);
      const { x: nx, y: ny } = centerOnCanvas(canvasWidth, canvasHeight, w, h);
      updateElement(id, { x: nx, y: ny });
      requestCanvasRebindForElementIds([id]);
      setSelectedElements([id]);
    }
  };

  const deleteRow = (id: string) => {
    removeElements([id]);
    fabricCanvas?.discardActiveObject();
    setSelectedElements([]);
    fabricCanvas?.requestRenderAll?.();
    fabricCanvas?.renderAll();
  };

  const deleteAllOffscreen = () => {
    const ids = rows.filter((r) => !r.onScreen).map((r) => r.el.id);
    if (ids.length === 0) return;
    const ok = window.confirm(
      `Delete ${ids.length} element(s) that do not intersect the canvas (${canvasWidth}×${canvasHeight})? You can undo with Undo.`
    );
    if (!ok) return;
    removeElements(ids);
    fabricCanvas?.discardActiveObject();
    setSelectedElements([]);
    fabricCanvas?.requestRenderAll?.();
    fabricCanvas?.renderAll();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="elements-layer-manager-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-600 bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 id="elements-layer-manager-title" className="text-lg font-semibold text-white">
            Canvas elements
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Close
          </button>
        </div>
        <p className="border-b border-slate-800 px-4 py-2 text-xs text-slate-400">
          Lists everything stored in the template. If something is not visible, it may be outside the area ({canvasWidth}×
          {canvasHeight}), have near-zero opacity, or be out of sync. Use <strong className="text-slate-200">Select</strong>,{' '}
          <strong className="text-slate-200">Bring</strong> to center the element on the canvas, or{' '}
          <strong className="text-slate-200">Delete</strong>.
        </p>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-sm text-slate-200">
            <thead className="sticky top-0 bg-slate-800 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Summary</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ el, fabricObj, flags, onScreen }) => (
                <tr key={el.id} className={onScreen ? 'border-t border-slate-800' : 'border-t border-amber-900/40 bg-amber-950/20'}>
                  <td className="px-3 py-2 font-medium capitalize">{el.type}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-slate-300" title={elementSummary(el)}>
                    {elementSummary(el)}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">{flags.join(' · ')}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button
                      type="button"
                      className="mr-1 rounded border border-slate-600 px-2 py-0.5 text-xs hover:bg-slate-800"
                      onClick={() => selectRow(fabricObj, el.id)}
                    >
                      Select
                    </button>
                    <button
                      type="button"
                      className="mr-1 rounded border border-slate-600 px-2 py-0.5 text-xs hover:bg-slate-800"
                      onClick={() => bringIntoCanvas(el.id, el, fabricObj)}
                    >
                      Bring
                    </button>
                    <button
                      type="button"
                      className="rounded border border-red-800 px-2 py-0.5 text-xs text-red-200 hover:bg-red-950"
                      onClick={() => deleteRow(el.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-slate-500">No elements in this template.</p>
          )}
        </div>
        {orphanFabricObjects.length > 0 && (
          <div className="border-t border-amber-800 bg-amber-950/30 px-4 py-2 text-xs text-amber-100">
            There {orphanFabricObjects.length === 1 ? 'is' : 'are'} {orphanFabricObjects.length} Fabric object(s) with no
            matching template entry (anomaly). Close and reopen the template or use Undo; if it persists, contact support.
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-700 px-4 py-3">
          <button
            type="button"
            className="rounded border border-amber-700 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-950/50"
            onClick={deleteAllOffscreen}
            disabled={!rows.some((r) => !r.onScreen)}
          >
            Delete all not visible on canvas
          </button>
          <span className="text-xs text-slate-500">{rows.length} element(s)</span>
        </div>
      </div>
    </div>
  );
}
