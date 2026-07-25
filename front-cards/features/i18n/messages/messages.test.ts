import { enMessages, esMessages } from './index';
import type { MessageTree } from '../types';

function flattenKeys(tree: MessageTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : flattenKeys(value, path);
  });
}

describe('locale messages', () => {
  const enKeys = flattenKeys(enMessages).sort();
  const esKeys = flattenKeys(esMessages).sort();

  it('es covers exactly the same keys as en', () => {
    expect(esKeys).toEqual(enKeys);
  });

  it('has no empty message values', () => {
    for (const messages of [enMessages, esMessages]) {
      for (const key of flattenKeys(messages)) {
        const value = key.split('.').reduce<string | MessageTree>(
          (node, part) => (typeof node === 'object' ? node[part] : ''),
          messages
        );
        expect(typeof value).toBe('string');
        expect((value as string).trim().length).toBeGreaterThan(0);
      }
    }
  });
});
