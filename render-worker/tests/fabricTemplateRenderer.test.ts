import { renderTemplateToPng } from '../src/services/fabricTemplateRenderer';

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
});
