import {
  capitalizeName,
  capitalizeIfNameField,
  PERSON_NAME_FIELD_IDS,
  DEMO_PERSON_NAME_KEYS,
} from './nameCapitalize';

describe('capitalizeName', () => {
  it('title-cases simple names', () => {
    expect(capitalizeName('sofía rodríguez')).toBe('Sofía Rodríguez');
  });

  it('keeps particles lowercase after the first word', () => {
    expect(capitalizeName('maría de los ángeles')).toBe('María de los Ángeles');
  });

  it('capitalizes the first word even if it is a particle', () => {
    expect(capitalizeName('de la cruz')).toBe('De la Cruz');
  });

  it('returns empty/falsy input unchanged', () => {
    expect(capitalizeName('')).toBe('');
  });
});

describe('capitalizeIfNameField', () => {
  it('capitalizes person name fields', () => {
    expect(capitalizeIfNameField('full_name', 'jane doe')).toBe('Jane Doe');
  });

  it('leaves non-name fields unchanged (email, business_name, title)', () => {
    expect(capitalizeIfNameField('email', 'jane doe')).toBe('jane doe');
    expect(capitalizeIfNameField('business_name', 'acme LLC')).toBe('acme LLC');
    expect(capitalizeIfNameField('business_title', 'director de ventas')).toBe(
      'director de ventas'
    );
  });

  it('excludes business_name from person-name set', () => {
    expect(PERSON_NAME_FIELD_IDS.has('business_name')).toBe(false);
    expect(DEMO_PERSON_NAME_KEYS.has('businessName')).toBe(false);
  });
});
