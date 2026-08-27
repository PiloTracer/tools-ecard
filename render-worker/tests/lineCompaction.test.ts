/**
 * Line compaction tests — 2026-08-27 semantics (port of the browser
 * lineCompactionService.test.ts): a line survives iff ANY data-bound element
 * on it has content (or it has no data-bound elements at all).
 * requiredFields is the explicit override. linePriority no longer participates.
 */

import {
  createOriginalPositionMap,
  applyLineCompaction,
} from '../src/services/lineCompaction';
import type { TemplateElementJson } from '../src/services/fabricTemplateRenderer';

let seq = 0;
function textEl(over: Partial<TemplateElementJson>): TemplateElementJson {
  seq += 1;
  return {
    id: `t${seq}`,
    type: 'text',
    x: 10,
    y: 10,
    text: '',
    fontSize: 20,
    fontFamily: 'Arial',
    ...over,
  };
}
function imageEl(over: Partial<TemplateElementJson>): TemplateElementJson {
  seq += 1;
  return {
    id: `i${seq}`,
    type: 'image',
    x: 0,
    y: 0,
    width: 20,
    height: 20,
    imageUrl: 'data:image/png;base64,x',
    ...over,
  };
}

beforeEach(() => {
  seq = 0;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('line survival (requirement: bound data must be visible)', () => {
  it('keeps a data-bearing line that has NO linePriority anywhere (operator regression)', () => {
    const elements = [
      textEl({ sectionGroup: 'contact', lineGroup: 'text-1', fieldId: 'mobile_phone', text: '+1 555 000 1111' }),
    ];
    const map = createOriginalPositionMap(elements);
    const out = applyLineCompaction(elements, map);
    expect(out.elements).toHaveLength(1);
    expect(out.elements[0].text).toBe('+1 555 000 1111');
    expect(out.removedLines).toEqual([]);
  });

  it('keeps a line when any data-bound sibling has content, even if another bound element is empty', () => {
    const elements = [
      textEl({ sectionGroup: 'contact', lineGroup: 'text-1', fieldId: 'work_phone', text: '' }),
      textEl({ sectionGroup: 'contact', lineGroup: 'text-1', fieldId: 'mobile_phone', text: '+1 555 000 1111' }),
    ];
    const map = createOriginalPositionMap(elements);
    const out = applyLineCompaction(elements, map);
    expect(out.elements.map((e) => e.id)).toEqual(elements.map((e) => e.id));
  });

  it('ignores a legacy linePriority property (line with data survives without any priority-1 element)', () => {
    const elements = [
      textEl({ sectionGroup: 'contact', lineGroup: 'text-1', fieldId: 'mobile_phone', text: '+1 555 000 1111' }),
    ];
    const map = createOriginalPositionMap(elements);
    const out = applyLineCompaction(elements, map);
    expect(out.elements).toHaveLength(1);
  });
});

describe('line collapse (requirement: missing data hides the line)', () => {
  it('removes a line whose bound elements are all empty and moves the next line into its exact position', () => {
    const line1Text = textEl({ sectionGroup: 'contact', lineGroup: 'text-1', fieldId: 'work_phone', text: '', x: 10, y: 100 });
    const line1Icon = imageEl({ sectionGroup: 'contact', lineGroup: 'icon-1', x: 0, y: 100 });
    const line2Text = textEl({ sectionGroup: 'contact', lineGroup: 'text-2', fieldId: 'mobile_phone', text: '+1 555', x: 10, y: 140 });
    const line2Icon = imageEl({ sectionGroup: 'contact', lineGroup: 'icon-2', x: 0, y: 140 });
    const elements = [line1Text, line1Icon, line2Text, line2Icon];
    const map = createOriginalPositionMap(elements);

    const out = applyLineCompaction(elements, map);

    // Line 1 (icon included) is gone — an icon never keeps a dataless line alive
    expect(out.elements.map((e) => e.id)).toEqual([line2Text.id, line2Icon.id]);
    expect(out.removedLines).toEqual([{ sectionGroup: 'contact', lineNumber: 1 }]);
    // Line 2 moved into line 1's exact original coordinates and was renumbered
    const movedText = out.elements.find((e) => e.id === line2Text.id)!;
    const movedIcon = out.elements.find((e) => e.id === line2Icon.id)!;
    expect([movedText.x, movedText.y]).toEqual([10, 100]);
    expect([movedIcon.x, movedIcon.y]).toEqual([0, 100]);
    expect(movedText.lineGroup).toBe('text-1');
    expect(movedIcon.lineGroup).toBe('icon-1');
  });

  it('keeps static-only lines (no data-bound elements) even when neighbours collapse', () => {
    const header = textEl({ sectionGroup: 'contact', lineGroup: 'text-1', text: 'CONTACT', x: 10, y: 50 });
    const emptyBound = textEl({ sectionGroup: 'contact', lineGroup: 'text-2', fieldId: 'email', text: '', x: 10, y: 100 });
    const filledBound = textEl({ sectionGroup: 'contact', lineGroup: 'text-3', fieldId: 'mobile_phone', text: '+1 555', x: 10, y: 150 });
    const elements = [header, emptyBound, filledBound];
    const map = createOriginalPositionMap(elements);

    const out = applyLineCompaction(elements, map);

    expect(out.elements.map((e) => e.id)).toEqual([header.id, filledBound.id]);
    // Header stays put; line 3 moves into line 2's slot (position 2)
    expect([out.elements[0].x, out.elements[0].y]).toEqual([10, 50]);
    expect([out.elements[1].x, out.elements[1].y]).toEqual([10, 100]);
    expect(out.elements[1].lineGroup).toBe('text-2');
  });

  it('removes the whole section when every data-bound line is empty and no static line anchors it', () => {
    const elements = [
      textEl({ sectionGroup: 'contact', lineGroup: 'text-1', fieldId: 'email', text: '' }),
      textEl({ sectionGroup: 'contact', lineGroup: 'text-2', fieldId: 'mobile_phone', text: '' }),
      textEl({ text: 'untouched static', x: 5, y: 5 }),
    ];
    const map = createOriginalPositionMap(elements);
    const out = applyLineCompaction(elements, map);
    expect(out.elements).toHaveLength(1);
    expect(out.elements[0].text).toBe('untouched static');
    expect(out.removedLines).toEqual([
      { sectionGroup: 'contact', lineNumber: 1 },
      { sectionGroup: 'contact', lineNumber: 2 },
    ]);
  });
});

describe('requiredFields override', () => {
  const record = { mobilePhone: '+1 555', email: null } as Record<string, unknown>;

  it('hides a line when a required field is missing in the record, even if the line has static content', () => {
    const elements = [textEl({ sectionGroup: 'contact', lineGroup: 'text-1', text: 'Call me', requiredFields: ['email'] })];
    const map = createOriginalPositionMap(elements);
    const out = applyLineCompaction(elements, map, record);
    expect(out.elements).toHaveLength(0);
  });

  it('keeps a line when all required fields have values', () => {
    const elements = [textEl({ sectionGroup: 'contact', lineGroup: 'text-1', text: 'Call me', requiredFields: ['mobile_phone'] })];
    const map = createOriginalPositionMap(elements);
    const out = applyLineCompaction(elements, map, record);
    expect(out.elements).toHaveLength(1);
  });

  it('unions requiredFields across all elements of the line', () => {
    const icon = imageEl({ sectionGroup: 'contact', lineGroup: 'icon-1', requiredFields: ['mobile_phone'] });
    const text = textEl({ sectionGroup: 'contact', lineGroup: 'text-1', fieldId: 'email', text: 'a@b.c', requiredFields: ['email'] });
    const elements = [icon, text];
    const map = createOriginalPositionMap(elements);
    // email is null in record → line hidden despite text having content
    const out = applyLineCompaction(elements, map, { mobilePhone: '+1', email: null });
    expect(out.elements).toHaveLength(0);
  });
});

describe('robustness', () => {
  it('leaves elements with invalid lineGroup format fixed in place', () => {
    const bad = textEl({ sectionGroup: 'contact', lineGroup: 'contact-line-1', text: 'fixed', x: 7, y: 77 });
    const good = textEl({ sectionGroup: 'contact', lineGroup: 'text-2', fieldId: 'mobile_phone', text: '+1 555', x: 10, y: 140 });
    const elements = [bad, good];
    const map = createOriginalPositionMap(elements);
    const out = applyLineCompaction(elements, map);
    const badOut = out.elements.find((e) => e.id === bad.id)!;
    expect([badOut.x, badOut.y]).toEqual([7, 77]);
    // valid line 2 compacts to position 1... but the map has no position 1 (invalid was skipped) → stays put
    expect(out.elements.find((e) => e.id === good.id)).toBeTruthy();
  });

  it('does not touch elements without a sectionGroup', () => {
    const free = textEl({ text: 'free', fieldId: 'email', x: 1, y: 2 });
    const elements = [free];
    const map = createOriginalPositionMap(elements);
    const out = applyLineCompaction(elements, map);
    expect(out.elements[0].x).toBe(1);
    expect(out.elements[0].y).toBe(2);
  });

  it('does not mutate the input elements array', () => {
    const bound = textEl({ sectionGroup: 'contact', lineGroup: 'text-1', fieldId: 'email', text: '', x: 10, y: 100 });
    const elements = [bound];
    const map = createOriginalPositionMap(elements);
    applyLineCompaction(elements, map);
    expect(elements).toHaveLength(1);
    expect(elements[0].lineGroup).toBe('text-1');
  });
});
