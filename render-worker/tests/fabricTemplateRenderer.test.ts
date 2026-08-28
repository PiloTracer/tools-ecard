import * as fs from 'fs';
import { createCanvas, registerFont, CanvasRenderingContext2D } from 'canvas';
import { computeFitScale, renderTemplateToPng, resolveText, type RecordFieldValues } from '../src/services/fabricTemplateRenderer';

/** Every fieldId the designer palette can drop — must resolve to a record value. */
const ALL_FIELD_IDS = [
  'full_name', 'first_name', 'last_name',
  'work_phone', 'work_phone_ext', 'mobile_phone', 'email',
  'address_street', 'address_city', 'address_state', 'address_postal', 'address_country',
  'social_instagram', 'social_twitter', 'social_facebook',
  'business_name', 'business_title', 'business_department', 'business_url', 'business_hours',
  'business_address_street', 'business_address_city', 'business_address_state',
  'business_address_postal', 'business_address_country',
  'business_linkedin', 'business_twitter',
  'personal_url', 'personal_bio', 'personal_birthday',
];

const FIELD_ID_TO_VALUE: Record<string, string> = {
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

const ALL_FIELD_VALUES: RecordFieldValues = {
  fullName: FIELD_ID_TO_VALUE.full_name,
  firstName: FIELD_ID_TO_VALUE.first_name,
  lastName: FIELD_ID_TO_VALUE.last_name,
  workPhone: FIELD_ID_TO_VALUE.work_phone,
  workPhoneExt: FIELD_ID_TO_VALUE.work_phone_ext,
  mobilePhone: FIELD_ID_TO_VALUE.mobile_phone,
  email: FIELD_ID_TO_VALUE.email,
  addressStreet: FIELD_ID_TO_VALUE.address_street,
  addressCity: FIELD_ID_TO_VALUE.address_city,
  addressState: FIELD_ID_TO_VALUE.address_state,
  addressPostal: FIELD_ID_TO_VALUE.address_postal,
  addressCountry: FIELD_ID_TO_VALUE.address_country,
  socialInstagram: FIELD_ID_TO_VALUE.social_instagram,
  socialTwitter: FIELD_ID_TO_VALUE.social_twitter,
  socialFacebook: FIELD_ID_TO_VALUE.social_facebook,
  businessName: FIELD_ID_TO_VALUE.business_name,
  businessTitle: FIELD_ID_TO_VALUE.business_title,
  businessDepartment: FIELD_ID_TO_VALUE.business_department,
  businessUrl: FIELD_ID_TO_VALUE.business_url,
  businessHours: FIELD_ID_TO_VALUE.business_hours,
  businessAddressStreet: FIELD_ID_TO_VALUE.business_address_street,
  businessAddressCity: FIELD_ID_TO_VALUE.business_address_city,
  businessAddressState: FIELD_ID_TO_VALUE.business_address_state,
  businessAddressPostal: FIELD_ID_TO_VALUE.business_address_postal,
  businessAddressCountry: FIELD_ID_TO_VALUE.business_address_country,
  businessLinkedin: FIELD_ID_TO_VALUE.business_linkedin,
  businessTwitter: FIELD_ID_TO_VALUE.business_twitter,
  personalUrl: FIELD_ID_TO_VALUE.personal_url,
  personalBio: FIELD_ID_TO_VALUE.personal_bio,
  personalBirthday: FIELD_ID_TO_VALUE.personal_birthday,
};



describe('fabricTemplateRenderer', () => {
  it('renders text and background to a PNG buffer', async () => {
    const { buffer, width, height } = await renderTemplateToPng(
      {
        width: 400,
        height: 200,
        backgroundColor: '#ffffff',
        elements: [
          {
            id: 't1',
            type: 'text',
            x: 20,
            y: 30,
            text: 'Hello',
            fontSize: 24,
            fontFamily: 'sans-serif',
            color: '#111111',
          },
        ],
      },
      { fullName: 'Ada Lovelace' }
    );

    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(width).toBe(400);
    expect(height).toBe(200);
  });

  it('substitutes fieldId text from record values', async () => {
    const { buffer } = await renderTemplateToPng(
      {
        width: 300,
        height: 150,
        elements: [
          {
            id: 'name',
            type: 'text',
            x: 10,
            y: 10,
            fieldId: 'full_name',
            fontSize: 18,
          },
        ],
      },
      { fullName: 'Sofía Rodríguez Oviedo' }
    );

    expect(buffer.length).toBeGreaterThan(100);
  });

  it('decodes numeric XML entities in stored record values', async () => {
    const { buffer } = await renderTemplateToPng(
      {
        width: 400,
        height: 120,
        elements: [
          {
            id: 'name',
            type: 'text',
            x: 10,
            y: 10,
            fieldId: 'full_name',
            fontSize: 18,
          },
        ],
      },
      { fullName: 'Pedro Elena L&#243;pez Ram&#237;rez' }
    );

    expect(buffer.length).toBeGreaterThan(100);
  });

  it('renders QR code elements', async () => {
    const { buffer } = await renderTemplateToPng({
      width: 200,
      height: 200,
      elements: [
        {
          id: 'qr1',
          type: 'qr',
          x: 20,
          y: 20,
          size: 80,
          data: 'https://example.com',
        },
      ],
    });

    expect(buffer.length).toBeGreaterThan(200);
  });

  it('renders a QR element at explicit width × height when they differ from size', async () => {
    const drawImageSpy = jest.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    try {
      await renderTemplateToPng({
        width: 400,
        height: 300,
        elements: [
          {
            id: 'qr1',
            type: 'qr',
            x: 10,
            y: 20,
            size: 80,
            width: 120,
            height: 60,
            data: 'https://example.com',
          },
        ],
      });

      const qrCall = drawImageSpy.mock.calls.find((c) => c[1] === 10 && c[2] === 20);
      expect(qrCall).toBeDefined();
      expect(qrCall![3]).toBe(120);
      expect(qrCall![4]).toBe(60);
    } finally {
      drawImageSpy.mockRestore();
    }
  });

  it('builds a bold ctx.font for string and numeric 700 fontWeight (browser parity)', async () => {
    // drawText is not exported; capture the ctx.font string at measureText
    // time (drawText sets ctx.font before measuring).
    const fontByText: Record<string, string> = {};
    const origMeasure = CanvasRenderingContext2D.prototype.measureText;
    const measureSpy = jest
      .spyOn(CanvasRenderingContext2D.prototype, 'measureText')
      .mockImplementation(function (this: CanvasRenderingContext2D, text: string) {
        fontByText[text] = this.font;
        return origMeasure.call(this, text);
      });
    try {
      await renderTemplateToPng({
        width: 300,
        height: 120,
        elements: [
          { id: 't1', type: 'text', x: 10, y: 10, text: 'BoldStr', fontSize: 20, fontWeight: '700' },
          { id: 't2', type: 'text', x: 10, y: 50, text: 'BoldNum', fontSize: 20, fontWeight: 700 as unknown as string },
          { id: 't3', type: 'text', x: 10, y: 90, text: 'Plain', fontSize: 20 },
        ],
      });

      expect(fontByText['BoldStr']).toContain(' bold ');
      expect(fontByText['BoldNum']).toContain(' bold ');
      expect(fontByText['Plain']).toContain(' normal ');
    } finally {
      measureSpy.mockRestore();
    }
  });

  it('resolves EVERY droppable vCard fieldId from the record (export consistency)', () => {
    for (const fieldId of ALL_FIELD_IDS) {
      const resolved = resolveText({ id: `el-${fieldId}`, type: 'text', fieldId, fontSize: 12 }, ALL_FIELD_VALUES);
      expect(resolved).toBe(FIELD_ID_TO_VALUE[fieldId]);
    }
  });

  it('renders an empty string when a bound field value is missing (no placeholder fallback)', () => {
    // New contract (parity with the browser batch export): a bound field with
    // a missing/empty record value renders blank — the design-time placeholder
    // is never emitted for a bound field.
    const resolved = resolveText(
      { id: 't1', type: 'text', fieldId: 'work_phone', text: '+1 (555) 000-0000 ', fontSize: 12 },
      { workPhone: null }
    );
    expect(resolved).toBe('');
  });

  it('renders an empty string when a bound fieldId is unresolvable', () => {
    const resolved = resolveText(
      { id: 't1', type: 'text', fieldId: 'unknown_field', text: 'placeholder', fontSize: 12 },
      ALL_FIELD_VALUES
    );
    expect(resolved).toBe('');
  });

  it('resolves alias and case-variant fieldIds via the ingest alias table', () => {
    expect(
      resolveText({ id: 'a', type: 'text', fieldId: 'Mobile Phone', fontSize: 12 }, ALL_FIELD_VALUES)
    ).toBe(FIELD_ID_TO_VALUE.mobile_phone);
    expect(
      resolveText({ id: 'b', type: 'text', fieldId: 'celular', fontSize: 12 }, ALL_FIELD_VALUES)
    ).toBe(FIELD_ID_TO_VALUE.mobile_phone);
    expect(
      resolveText({ id: 'c', type: 'text', fieldId: 'Móvil', fontSize: 12 }, ALL_FIELD_VALUES)
    ).toBe(FIELD_ID_TO_VALUE.mobile_phone);
  });

  it('keeps the static text for an element without fieldId', () => {
    const resolved = resolveText(
      { id: 't1', type: 'text', text: 'STATIC LABEL', fontSize: 12 },
      ALL_FIELD_VALUES
    );
    expect(resolved).toBe('STATIC LABEL');
  });

  it('fills every element sharing a fieldId, including numeric duplicate suffixes', () => {
    // Dropping the same field twice (or hand-edited/imported JSON carrying
    // "work_phone_1") must resolve each element from the same record value.
    const dup = { id: 'a', type: 'text' as const, fieldId: 'work_phone', fontSize: 12 };
    const dupSuffixed = { id: 'b', type: 'text' as const, fieldId: 'work_phone_1', fontSize: 12 };
    const dupSuffixed2 = { id: 'c', type: 'text' as const, fieldId: 'work_phone_2', fontSize: 12 };
    expect(resolveText(dup, ALL_FIELD_VALUES)).toBe(FIELD_ID_TO_VALUE.work_phone);
    expect(resolveText(dupSuffixed, ALL_FIELD_VALUES)).toBe(FIELD_ID_TO_VALUE.work_phone);
    expect(resolveText(dupSuffixed2, ALL_FIELD_VALUES)).toBe(FIELD_ID_TO_VALUE.work_phone);
  });

  it('does not mistake a canonical field for a suffixed duplicate', () => {
    // "work_phone_ext" must keep resolving to the extension, not work_phone.
    const resolved = resolveText(
      { id: 't2', type: 'text', fieldId: 'work_phone_ext', fontSize: 12 },
      ALL_FIELD_VALUES
    );
    expect(resolved).toBe(FIELD_ID_TO_VALUE.work_phone_ext);
  });
});

describe('computeFitScale (fit-to-width parity)', () => {
  it('keeps the design size (1.0) when the text fits', () => {
    expect(computeFitScale(100, 160)).toBe(1.0);
    expect(computeFitScale(160, 160)).toBe(1.0);
  });

  it('shrinks proportionally when the text overflows', () => {
    expect(computeFitScale(320, 160)).toBe(0.5);
    expect(computeFitScale(200, 160)).toBeCloseTo(0.8);
  });

  it('never scales below the 0.5 floor', () => {
    expect(computeFitScale(1000, 160)).toBe(0.5);
  });

  it('never scales up and ignores a non-positive available width', () => {
    expect(computeFitScale(100, 500)).toBe(1.0);
    expect(computeFitScale(100, 0)).toBe(1.0);
    expect(computeFitScale(100, -10)).toBe(1.0);
  });
});

// The running dev container predates the Dockerfile font packages, so the
// size-dependent cases below only run when a real TTF is present.
const FONT_CANDIDATES = [
  '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/TTF/DejaVuSans.ttf',
];
const REAL_FONT_PATH = FONT_CANDIDATES.find((p) => fs.existsSync(p));
const describeWithRealFont = REAL_FONT_PATH ? describe : describe.skip;

describeWithRealFont('fit-to-width with a real registered font', () => {
  beforeAll(() => {
    registerFont(REAL_FONT_PATH!, { family: 'FitTestFont' });
  });

  it('renders overflowing text at a reduced size', () => {
    const ctx = createCanvas(200, 100).getContext('2d');
    const text = 'This line of text is far too long to fit';
    const available = 200 - 10 - 30; // canvasWidth - element.x - 30px safe padding

    ctx.font = 'normal normal 40px FitTestFont';
    const measured = ctx.measureText(text).width;
    expect(measured).toBeGreaterThan(available);

    const scale = computeFitScale(measured, available);
    expect(scale).toBeLessThan(1.0);
    expect(scale).toBeGreaterThanOrEqual(0.5);

    ctx.font = `normal normal ${40 * scale}px FitTestFont`;
    expect(ctx.measureText(text).width).toBeLessThan(measured);
  });

  it('keeps the design size for non-overflowing text', () => {
    const ctx = createCanvas(400, 100).getContext('2d');
    ctx.font = 'normal normal 12px FitTestFont';
    const measured = ctx.measureText('Hi').width;
    expect(computeFitScale(measured, 400 - 10 - 30)).toBe(1.0);
  });

  it('renders an overflowing element end-to-end without errors', async () => {
    const { buffer, width } = await renderTemplateToPng({
      width: 200,
      height: 100,
      elements: [
        {
          id: 't1',
          type: 'text',
          x: 10,
          y: 10,
          text: 'This line of text is far too long to fit',
          fontSize: 40,
          fontFamily: 'FitTestFont',
        },
      ],
    });
    expect(width).toBe(200);
    expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});
