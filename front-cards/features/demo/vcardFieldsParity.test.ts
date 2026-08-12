/**
 * Parity guard for the canonical vCard field list (30 fields).
 *
 * The canonical list lives in packages/shared-types/src/domain/vcard-fields.ts with a
 * JSON snapshot; the snapshot is duplicated into fixtures/ per repo convention (see
 * golden_expected.json) because the dev container only mounts front-cards/. The Python
 * side asserts FIELD_MAPPING ≡ snapshot in api-server/batch-parsing/test_batch_parsing.py.
 * These tests fail loudly if vcardFields.ts or the Demo parser's DemoContactFields
 * targets drift from the snapshot.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { vcardFields } from '../template-textile/utils/vcardFields';
import { HEADER_ALIASES } from './demoSpreadsheetParser';

const snapshot = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/vcard-fields.snapshot.json'), 'utf-8')
) as Array<{ id: string }>;
const snapshotIds = snapshot.map((entry) => entry.id).sort();

const camelToSnake = (s: string): string =>
  s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

describe('canonical vCard field list parity', () => {
  it('vcardFields.ts ids match the canonical snapshot', () => {
    expect(vcardFields.map((f) => f.id).sort()).toEqual(snapshotIds);
  });

  it('demo HEADER_ALIASES targets match the canonical snapshot', () => {
    const targets = [...new Set(Object.values(HEADER_ALIASES).map(camelToSnake))].sort();
    expect(targets).toEqual(snapshotIds);
  });
});
