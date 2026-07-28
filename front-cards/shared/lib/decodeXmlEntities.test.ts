import { decodeXmlEntities } from './decodeXmlEntities';

describe('decodeXmlEntities', () => {
  it('decodes decimal numeric entities (Excel sharedStrings)', () => {
    expect(decodeXmlEntities('Pedro Elena L&#243;pez Ram&#237;rez')).toBe(
      'Pedro Elena López Ramírez'
    );
  });

  it('decodes hex numeric entities', () => {
    expect(decodeXmlEntities('Sof&#xED;a')).toBe('Sofía');
  });

  it('decodes named entities and leaves plain text unchanged', () => {
    expect(decodeXmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(decodeXmlEntities('Arquitecto')).toBe('Arquitecto');
  });

  it('returns early when no ampersand is present', () => {
    const input = 'López';
    expect(decodeXmlEntities(input)).toBe(input);
  });
});
