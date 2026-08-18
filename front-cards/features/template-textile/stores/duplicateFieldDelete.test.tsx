/**
 * @jest-environment jsdom
 *
 * Regression tests for duplicate-field deletion:
 * dropping two elements with the SAME vCard fieldId must still allow
 * selecting and deleting either one (issue: "unable to delete a selected
 * element when 2 elements share the same field name").
 */

import * as fabric from 'fabric';
import { useTemplateStore } from '../stores/templateStore';
import { useCanvasStore } from '../stores/canvasStore';
import type { TextElement } from '../types';

/** Minimal 2D context so fabric.Canvas can construct in jsdom. */
function installCanvas2DContextMock() {
  const noop = () => {};
  const ctx = {
    fillRect: noop, clearRect: noop, getImageData: (x: number, y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: noop, createImageData: (w: number, h: number) => ({ width: w, height: h }),
    setTransform: noop, drawImage: noop, save: noop, fillText: noop, restore: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, stroke: noop, fill: noop,
    translate: noop, scale: noop, rotate: noop, arc: noop, ellipse: noop, rect: noop,
    measureText: (t: string) => ({ width: t.length * 8 }),
    canvas: null,
  };
  HTMLCanvasElement.prototype.getContext = (() => ctx as unknown as CanvasRenderingContext2D) as never;
}

function makeFieldElement(id: string, fieldId: string, x: number): TextElement {
  return {
    id,
    type: 'text',
    text: `${fieldId} placeholder`,
    x,
    y: 50,
    fontSize: 16,
    fontFamily: 'Arial',
    color: '#000000',
    textAlign: 'left',
    rotation: 0,
    opacity: 1,
    locked: false,
    fieldId,
  };
}

/** Same ids + fields the DesignCanvas delete handler uses. */
function getElementIdsFromActiveObjects(canvas: fabric.Canvas): string[] {
  return canvas
    .getActiveObjects()
    .map((o) => (o as unknown as { elementId?: string }).elementId)
    .filter((id: string | undefined): id is string => Boolean(id));
}

describe('duplicate-field elements: selection + deletion', () => {
  beforeAll(() => {
    installCanvas2DContextMock();
  });

  beforeEach(() => {
    useTemplateStore.setState({
      elements: [],
      selectedElementIds: [],
      history: [],
      historyIndex: -1,
    } as never);
    useCanvasStore.setState({ selectedElementIds: [] } as never);
  });

  it('removes exactly the selected element when two share the same fieldId', () => {
    const store = useTemplateStore.getState();
    store.addElement(makeFieldElement('el-a', 'work_phone', 10));
    store.addElement(makeFieldElement('el-b', 'work_phone', 200));

    const els = useTemplateStore.getState().elements as TextElement[];
    expect(els).toHaveLength(2);
    expect(els[0].fieldId).toBe(els[1].fieldId); // same field, distinct ids

    // Simulate the keyboard-delete path: remove the SELECTED id only
    useTemplateStore.getState().removeElements(['el-a']);

    const remaining = useTemplateStore.getState().elements.map((el) => el.id);
    expect(remaining).toEqual(['el-b']);
  });

  it('canvas active-object ids stay distinct for same-fieldId elements', () => {
    const canvas = new fabric.Canvas(document.createElement('canvas'));

    const a = new fabric.Textbox('work_phone placeholder', { left: 10, top: 50 });
    const b = new fabric.Textbox('work_phone placeholder', { left: 200, top: 50 });
    (a as unknown as { elementId: string }).elementId = 'el-a';
    (b as unknown as { elementId: string }).elementId = 'el-b';

    canvas.add(a, b);
    canvas.setActiveObject(a);

    const ids = getElementIdsFromActiveObjects(canvas);
    expect(ids).toEqual(['el-a']);

    // Switch selection to the other element — ids must not collide
    canvas.setActiveObject(b);
    expect(getElementIdsFromActiveObjects(canvas)).toEqual(['el-b']);
  });

  it('deleting one same-field element leaves the other selectable and deletable', () => {
    const store = useTemplateStore.getState();
    store.addElement(makeFieldElement('el-a', 'work_phone', 10));
    store.addElement(makeFieldElement('el-b', 'work_phone', 200));

    const canvas = new fabric.Canvas(document.createElement('canvas'));
    const a = new fabric.Textbox('work_phone placeholder', { left: 10, top: 50 });
    const b = new fabric.Textbox('work_phone placeholder', { left: 200, top: 50 });
    (a as unknown as { elementId: string }).elementId = 'el-a';
    (b as unknown as { elementId: string }).elementId = 'el-b';
    canvas.add(a, b);

    // Select + delete el-a (mirrors the DesignCanvas Delete key handler)
    canvas.setActiveObject(a);
    const ids = getElementIdsFromActiveObjects(canvas);
    if (ids.length > 0) {
      useTemplateStore.getState().removeElements(ids);
      canvas.discardActiveObject();
    }

    expect(useTemplateStore.getState().elements.map((el) => el.id)).toEqual(['el-b']);

    // The remaining element still resolves its fabric object + can be deleted
    canvas.setActiveObject(b);
    const ids2 = getElementIdsFromActiveObjects(canvas);
    expect(ids2).toEqual(['el-b']);
    useTemplateStore.getState().removeElements(ids2);
    expect(useTemplateStore.getState().elements).toHaveLength(0);
  });
});
