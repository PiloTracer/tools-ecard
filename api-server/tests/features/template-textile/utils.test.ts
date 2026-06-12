import { describe, it, expect } from '@jest/globals';
import { decodeBase64Data } from '../../../src/features/template-textile/utils/base64Helper';

describe('Base64 Helper', () => {
  describe('decodeBase64Data', () => {
    it('should decode plain base64 data', () => {
      const base64 = Buffer.from('hello world').toString('base64');
      const result = decodeBase64Data(base64);
      expect(result.toString()).toBe('hello world');
    });

    it('should decode data URL format', () => {
      const base64 = Buffer.from('hello world').toString('base64');
      const dataUrl = `data:image/svg+xml;base64,${base64}`;
      const result = decodeBase64Data(dataUrl);
      expect(result.toString()).toBe('hello world');
    });

    it('should decode complex data URL', () => {
      const base64 = Buffer.from('<svg><text>Test</text></svg>').toString('base64');
      const dataUrl = `data:image/svg+xml;charset=utf-8;base64,${base64}`;
      const result = decodeBase64Data(dataUrl);
      expect(result.toString()).toBe('<svg><text>Test</text></svg>');
    });

    it('should handle empty base64 string', () => {
      const result = decodeBase64Data('');
      expect(result.toString()).toBe('');
    });

    it('should decode binary data', () => {
      const binary = Buffer.from([0x00, 0x01, 0x02, 0xFF]);
      const base64 = binary.toString('base64');
      const result = decodeBase64Data(base64);
      expect(result).toEqual(binary);
    });

    it('should handle base64 with padding', () => {
      const base64 = Buffer.from('hi').toString('base64'); // 'aGk='
      const result = decodeBase64Data(base64);
      expect(result.toString()).toBe('hi');
    });
  });
});
