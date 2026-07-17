import {
  PASTED_BATCH_DEFAULT_STEM,
  batchFileExtension,
  resolveUniqueBatchFileName,
  stemFromBatchFileName,
  suggestBatchFileName,
} from './batchNaming';

describe('batchNaming', () => {
  describe('stemFromBatchFileName', () => {
    it('strips spreadsheet extensions', () => {
      expect(stemFromBatchFileName('staff_real.xlsx')).toBe('staff_real');
    });

    it('maps pasted-content placeholder to a friendly label', () => {
      expect(stemFromBatchFileName('pasted-content.txt')).toBe(PASTED_BATCH_DEFAULT_STEM);
    });
  });

  describe('resolveUniqueBatchFileName', () => {
    it('deduplicates with numeric suffix', () => {
      expect(
        resolveUniqueBatchFileName('Staff', '.csv', ['Staff.csv', 'Other.csv'])
      ).toBe('Staff (1).csv');
    });
  });

  describe('suggestBatchFileName', () => {
    it('combines stem, extension, and dedup', () => {
      const file = new File(['a'], 'contacts.csv', { type: 'text/csv' });
      expect(suggestBatchFileName(file, ['contacts.csv'])).toBe('contacts (1).csv');
    });
  });

  describe('batchFileExtension', () => {
    it('preserves known batch extensions', () => {
      expect(batchFileExtension('data.XLSX')).toBe('.xlsx');
    });

    it('defaults to .txt for unknown extensions', () => {
      expect(batchFileExtension('pasted-content')).toBe('.txt');
    });
  });
});
