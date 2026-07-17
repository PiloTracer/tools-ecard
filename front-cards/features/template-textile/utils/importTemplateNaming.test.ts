import {
  resolveUniqueTemplateName,
  stemFromImportFileName,
} from './importTemplateNaming';

describe('importTemplateNaming', () => {
  describe('stemFromImportFileName', () => {
    it('strips .zip extension', () => {
      expect(stemFromImportFileName('Holiday Card.zip')).toBe('Holiday Card');
    });

    it('strips .json extension', () => {
      expect(stemFromImportFileName('business-card.json')).toBe('business-card');
    });

    it('sanitizes unsafe characters', () => {
      expect(stemFromImportFileName('bad:name?.zip')).toBe('bad_name_');
    });
  });

  describe('resolveUniqueTemplateName', () => {
    it('returns the base name when unused', () => {
      expect(resolveUniqueTemplateName('Holiday Card', ['Other'])).toBe('Holiday Card');
    });

    it('appends (1) when the base name exists', () => {
      expect(resolveUniqueTemplateName('Holiday Card', ['Holiday Card'])).toBe(
        'Holiday Card (1)'
      );
    });

    it('increments the suffix for consecutive conflicts', () => {
      expect(
        resolveUniqueTemplateName('Holiday Card', [
          'Holiday Card',
          'Holiday Card (1)',
        ])
      ).toBe('Holiday Card (2)');
    });

    it('is case-insensitive when detecting conflicts', () => {
      expect(resolveUniqueTemplateName('holiday card', ['Holiday Card'])).toBe(
        'holiday card (1)'
      );
    });
  });
});
