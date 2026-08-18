/**
 * @jest-environment jsdom
 *
 * Field-mapping export tests (operator issue: "work_phone is not exporting"):
 * every vCard field that can be dropped onto the designer must be carried
 * through parse → record → applyRecordData → exported card content.
 *
 * Coverage:
 *  1. Inventory parity — every palette fieldId resolves through
 *     FIELD_ID_TO_PROPERTY_MAP (catches missing map entries).
 *  2. End-to-end demo parse → record → template population for ALL fields.
 *  3. Exported-image content — the same element-creation path the exporter
 *     uses (recreateElements) renders every populated field on the canvas.
 */

import * as fabric from 'fabric';
import { vcardFields } from '../utils/vcardFields';
import { parseCsvText, mapRowToContactFields } from '@/features/demo/demoSpreadsheetParser';
import { applyRecordData, type BatchRecord } from './batchExportService';
import { recreateElements } from './canvasRenderer';
import type { Template, TemplateElement, TextElement } from '../types';

/** Minimal 2D context so fabric.Canvas can construct + render in jsdom.
 *  Proxy returns a no-op for any function property and sensible defaults for
 *  the few data-returning members fabric reads. */
function installCanvas2DContextMock() {
  const noop = () => {};
  const dataProps: Record<string, unknown> = {
    canvas: document.createElement('canvas'),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    shadowBlur: 0,
    shadowColor: 'transparent',
  };
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(target, prop) {
      if (prop in dataProps) return dataProps[prop as string];
      if (typeof prop === 'string') {
        if (prop === 'measureText') return (t: string) => ({ width: t.length * 8 });
        if (prop === 'getImageData') return (x: number, y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) });
        if (prop === 'createImageData') return (w: number, h: number) => ({ width: w, height: h });
        if (prop === 'getContextAttributes') return () => ({} as never);
        // Every other member is a method — make it a no-op so fabric's render
        // pipeline (transform, clip, setLineDash, ...) never throws.
        return noop;
      }
      return undefined;
    },
    set() {
      return true; // swallow any style/state writes
    },
  });
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
}

/** Sample value per palette field — distinct per field so a swap/miss is obvious. */
const SAMPLE_VALUES: Record<string, string> = {
  full_name: 'Ada Lovelace',
  first_name: 'Ada',
  last_name: 'Lovelace',
  work_phone: '+1 (555) 123-4567',
  work_phone_ext: '123',
  mobile_phone: '+1 (555) 987-6543',
  email: 'ada@example.com',
  address_street: '12 Analytical Engine Rd',
  address_city: 'London',
  address_state: 'EN',
  address_postal: 'SW1A 1AA',
  address_country: 'United Kingdom',
  social_instagram: '@ada.codes',
  social_twitter: '@ada_loves',
  social_facebook: 'ada.lovelace.profile',
  business_name: 'Analytical Engines Ltd',
  business_title: 'Chief Mathematician',
  business_department: 'Computing',
  business_url: 'https://analytical-engines.example',
  business_hours: 'Mon-Fri 9AM-5PM',
  business_address_street: '8 Babbage Way',
  business_address_city: 'Cambridge',
  business_address_state: 'CB',
  business_address_postal: 'CB2 1TN',
  business_address_country: 'United Kingdom',
  business_linkedin: 'linkedin.com/in/ada-lovelace',
  business_twitter: '@analytical_ltd',
  personal_url: 'https://ada.example',
  personal_bio: 'First programmer',
  personal_birthday: '1815-12-10',
};

const CANONICAL_HEADERS = Object.keys(SAMPLE_VALUES);

/** Build a template with one text element per palette field (all dropped fields). */
function templateWithAllFields(): Template {
  const elements: TemplateElement[] = vcardFields.map((f, i) => ({
    id: `el-${f.id}`,
    type: 'text',
    x: 10 + (i % 5) * 40,
    y: 10 + Math.floor(i / 5) * 30,
    text: f.placeholder.trim(),
    fontSize: 12,
    fontFamily: 'Arial',
    color: '#000000',
    textAlign: 'left',
    rotation: 0,
    opacity: 1,
    locked: false,
    fieldId: f.id,
  }));
  return {
    id: 'tpl-1',
    name: 'all-fields',
    width: 1200,
    height: 800,
    elements,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Build a demo-mode record (camelCase keys, like mapDemoRecord produces). */
function recordFromFields(fields: Record<string, string | null>): BatchRecord {
  return {
    batchRecordId: 'rec-1',
    batchId: 'batch-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    fullName: fields.fullName ?? null,
    firstName: fields.firstName ?? null,
    lastName: fields.lastName ?? null,
    workPhone: fields.workPhone ?? null,
    workPhoneExt: fields.workPhoneExt ?? null,
    mobilePhone: fields.mobilePhone ?? null,
    email: fields.email ?? null,
    addressStreet: fields.addressStreet ?? null,
    addressCity: fields.addressCity ?? null,
    addressState: fields.addressState ?? null,
    addressPostal: fields.addressPostal ?? null,
    addressCountry: fields.addressCountry ?? null,
    socialInstagram: fields.socialInstagram ?? null,
    socialTwitter: fields.socialTwitter ?? null,
    socialFacebook: fields.socialFacebook ?? null,
    businessName: fields.businessName ?? null,
    businessTitle: fields.businessTitle ?? null,
    businessDepartment: fields.businessDepartment ?? null,
    businessUrl: fields.businessUrl ?? null,
    businessHours: fields.businessHours ?? null,
    businessAddressStreet: fields.businessAddressStreet ?? null,
    businessAddressCity: fields.businessAddressCity ?? null,
    businessAddressState: fields.businessAddressState ?? null,
    businessAddressPostal: fields.businessAddressPostal ?? null,
    businessAddressCountry: fields.businessAddressCountry ?? null,
    businessLinkedin: fields.businessLinkedin ?? null,
    businessTwitter: fields.businessTwitter ?? null,
    personalUrl: fields.personalUrl ?? null,
    personalBio: fields.personalBio ?? null,
    personalBirthday: fields.personalBirthday ?? null,
  };
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

describe('batch export field mapping (all palette fields)', () => {
  beforeAll(() => {
    installCanvas2DContextMock();
  });

  it('covers every droppable vCard field id', () => {
    // applyRecordData maps fieldId → record key via FIELD_ID_TO_PROPERTY_MAP with
    // the fieldId itself as fallback. Every palette field must resolve to a real
    // camelCase record key, otherwise the value silently resolves to undefined.
    const template = templateWithAllFields();
    const record = recordFromFields(
      Object.fromEntries(CANONICAL_HEADERS.map((h) => [snakeToCamel(h), SAMPLE_VALUES[h]]))
    );

    const populated = applyRecordData(template, record);
    const textEls = populated.elements.filter((el) => el.type === 'text') as TextElement[];

    expect(textEls).toHaveLength(vcardFields.length);
    for (const el of textEls) {
      expect(el.fieldId).toBeTruthy();
      expect(el.text).toBe(SAMPLE_VALUES[el.fieldId!]);
    }
  });

  it('carries every field through the demo CSV parse → record → export mapping', () => {
    // A realistic uploaded sheet with all canonical columns.
    const csv = [
      CANONICAL_HEADERS.join(','),
      CANONICAL_HEADERS.map((h) => SAMPLE_VALUES[h]).join(','),
    ].join('\n');

    const table = parseCsvText(csv);
    expect(table.headers).toHaveLength(CANONICAL_HEADERS.length);

    const fields = mapRowToContactFields(table.headers, table.rows[0], {});
    const record = recordFromFields(fields);

    // work_phone specifically (the operator-reported field) must survive
    expect(record.workPhone).toBe(SAMPLE_VALUES.work_phone);

    const populated = applyRecordData(templateWithAllFields(), record);
    const byField = new Map(
      (populated.elements.filter((el) => el.type === 'text') as TextElement[]).map((el) => [el.fieldId, el.text])
    );

    for (const fieldId of CANONICAL_HEADERS) {
      expect(byField.get(fieldId)).toBe(SAMPLE_VALUES[fieldId]);
    }
  });

  it('fills EVERY element sharing the same fieldId (duplicate drops both get the value)', () => {
    // Operator requirement: dropping the same field twice (e.g. two work_phone
    // elements) must fill BOTH from the batch value — no dedupe, no suffixing.
    const record = recordFromFields(
      Object.fromEntries(CANONICAL_HEADERS.map((h) => [snakeToCamel(h), SAMPLE_VALUES[h]]))
    );

    const template: Template = {
      id: 'tpl-dup',
      name: 'duplicate-fields',
      width: 1200,
      height: 800,
      createdAt: new Date(),
      updatedAt: new Date(),
      elements: [
        {
          id: 'el-wp-1',
          type: 'text',
          x: 10, y: 10,
          text: 'placeholder ',
          fontSize: 12,
          fontFamily: 'Arial',
          color: '#000000',
          textAlign: 'left',
          rotation: 0,
          opacity: 1,
          locked: false,
          fieldId: 'work_phone',
        },
        {
          id: 'el-wp-2',
          type: 'text',
          x: 200, y: 10,
          text: 'placeholder ',
          fontSize: 12,
          fontFamily: 'Arial',
          color: '#000000',
          textAlign: 'left',
          rotation: 0,
          opacity: 1,
          locked: false,
          fieldId: 'work_phone',
        },
      ],
    };

    const populated = applyRecordData(template, record);
    const texts = (populated.elements.filter((el) => el.type === 'text') as TextElement[]).map((el) => el.text);
    expect(texts).toEqual([SAMPLE_VALUES.work_phone, SAMPLE_VALUES.work_phone]);
  });

  it('renders every populated field on the exported card (recreateElements path)', async () => {
    const canvas = new fabric.Canvas(document.createElement('canvas'), { width: 1200, height: 800 });

    const record = recordFromFields(
      Object.fromEntries(CANONICAL_HEADERS.map((h) => [snakeToCamel(h), SAMPLE_VALUES[h]]))
    );
    const populated = applyRecordData(templateWithAllFields(), record);

    // This is the exact element-creation path exportTemplate uses for the
    // offscreen export canvas — asserting on its objects is asserting on the
    // content of the exported image.
    await recreateElements(canvas, populated.elements, { loadImages: false });


    const objects = canvas.getObjects();
    // Fabric 6 reports Textbox/IText objects with type 'i-text'
    const textObjects = objects.filter((o) => o.type === 'textbox' || o.type === 'i-text' || o.type === 'text');
    expect(textObjects).toHaveLength(vcardFields.length);

    const renderedByField = new Map<string, string>();
    for (const obj of textObjects) {
      const el = populated.elements.find((e) => e.id === (obj as unknown as { elementId?: string }).elementId);
      if (el && el.type === 'text') {
        renderedByField.set(el.fieldId!, (obj as fabric.Textbox).text ?? '');
      }
    }

    for (const fieldId of CANONICAL_HEADERS) {
      expect(renderedByField.get(fieldId)).toBe(SAMPLE_VALUES[fieldId]);
    }
  });
});
