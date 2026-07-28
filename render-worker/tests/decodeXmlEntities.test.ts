import { decodeXmlEntities } from '../src/utils/decodeXmlEntities';

describe('decodeXmlEntities', () => {
  it('decodes decimal numeric entities from record fields', () => {
    expect(decodeXmlEntities('L&#243;pez Ram&#237;rez')).toBe('López Ramírez');
  });
});
