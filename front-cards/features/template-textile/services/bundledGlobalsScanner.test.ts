/**
 * bundledGlobalsScanner — live directory listing for bundled global templates:
 * ZIP pairing with preview/sidecar, per-site groups, resilience to garbage.
 */

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanBundledGlobals } from './bundledGlobalsScanner';

function makeFixture(): string {
  const base = mkdtempSync(join(tmpdir(), 'bundled-globals-'));
  // Shared root: one full trio, one bare zip, one orphan preview, one non-zip.
  writeFileSync(join(base, 'cumpleanos-2026.zip'), 'PK');
  writeFileSync(join(base, 'cumpleanos-2026.png'), 'png');
  writeFileSync(
    join(base, 'cumpleanos-2026.json'),
    JSON.stringify({ name: 'Cumpleaños 2026', description: 'Tarjeta de cumpleaños' })
  );
  writeFileSync(join(base, 'plain.zip'), 'PK');
  writeFileSync(join(base, 'orphan.png'), 'png');
  writeFileSync(join(base, 'notes.txt'), 'not a template');
  // Per-site dirs.
  mkdirSync(join(base, 'demo'));
  writeFileSync(join(base, 'demo', 'a.zip'), 'PK');
  mkdirSync(join(base, 'prd'));
  writeFileSync(join(base, 'prd', 'c.zip'), 'PK');
  writeFileSync(join(base, 'prd', 'c.json'), '{corrupt json');
  return base;
}

describe('scanBundledGlobals', () => {
  it('pairs zips with previews and sidecars, grouped by site', () => {
    const listing = scanBundledGlobals(makeFixture());

    expect(listing.shared).toEqual([
      {
        name: 'Cumpleaños 2026',
        file: 'cumpleanos-2026.zip',
        preview: 'cumpleanos-2026.png',
        description: 'Tarjeta de cumpleaños',
      },
      { name: 'plain', file: 'plain.zip' },
    ]);
    expect(listing.demo).toEqual([{ name: 'a', file: 'demo/a.zip' }]);
    // Corrupt sidecar must not kill the entry — falls back to the filename stem.
    expect(listing.prd).toEqual([{ name: 'c', file: 'prd/c.zip' }]);
  });

  it('returns empty groups for a missing directory (never throws)', () => {
    const listing = scanBundledGlobals(join(tmpdir(), 'definitely-does-not-exist-ecards'));
    expect(listing).toEqual({ shared: [], demo: [], prd: [] });
  });
});
