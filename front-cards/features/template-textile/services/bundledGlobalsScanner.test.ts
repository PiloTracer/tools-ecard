/**
 * bundledGlobalsScanner — live directory listing for bundled global templates:
 * ZIP pairing with preview/sidecar, per-site groups, resilience to garbage.
 */

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { scanBundledGlobals } from './bundledGlobalsScanner';

async function makeEmbeddedZip(
  stem: string,
  name: string,
  description?: string,
  legacyNames = false
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('template.json', JSON.stringify({ name: 'Embedded', width: 100, height: 100, elements: [] }));
  zip.file('package.json', JSON.stringify({ version: '1.0', exportDate: new Date().toISOString() }));
  const previewName = legacyNames ? 'preview.png' : `${stem}.png`;
  const sidecarName = legacyNames ? 'sidecar.json' : `${stem}.json`;
  zip.file(previewName, Buffer.from('fake-png'));
  zip.file(sidecarName, JSON.stringify({ name, description }, null, 2));
  return Buffer.from(await zip.generateAsync({ type: 'arraybuffer' }));
}

async function makeFixture(): Promise<string> {
  const base = mkdtempSync(join(tmpdir(), 'bundled-globals-'));
  // Shared root: one full external trio, one bare zip, one orphan preview, one non-zip.
  writeFileSync(join(base, 'cumpleanos-2026.zip'), 'PK');
  writeFileSync(join(base, 'cumpleanos-2026.png'), 'png');
  writeFileSync(
    join(base, 'cumpleanos-2026.json'),
    JSON.stringify({ name: 'Cumpleaños 2026', description: 'Tarjeta de cumpleaños' })
  );
  writeFileSync(join(base, 'plain.zip'), 'PK');
  writeFileSync(join(base, 'orphan.png'), 'png');
  writeFileSync(join(base, 'notes.txt'), 'not a template');
  // Shared root: one ZIP with stem-named embedded sidecars only (no external files).
  writeFileSync(
    join(base, 'embedded-only.zip'),
    await makeEmbeddedZip('embedded-only', 'Embedded Only', 'From inside ZIP')
  );
  // Shared root: one ZIP with legacy embedded sidecar names (backward compat).
  writeFileSync(
    join(base, 'legacy.zip'),
    await makeEmbeddedZip('legacy', 'Legacy', 'Legacy names', true)
  );
  // Per-site dirs.
  mkdirSync(join(base, 'demo'));
  writeFileSync(join(base, 'demo', 'a.zip'), 'PK');
  mkdirSync(join(base, 'prd'));
  writeFileSync(join(base, 'prd', 'c.zip'), 'PK');
  writeFileSync(join(base, 'prd', 'c.json'), '{corrupt json');
  return base;
}

describe('scanBundledGlobals', () => {
  it('pairs zips with previews and sidecars, grouped by site', async () => {
    const listing = await scanBundledGlobals(await makeFixture());

    expect(listing.shared).toEqual([
      {
        name: 'Cumpleaños 2026',
        file: 'cumpleanos-2026.zip',
        preview: 'cumpleanos-2026.png',
        description: 'Tarjeta de cumpleaños',
      },
      {
        name: 'Embedded Only',
        file: 'embedded-only.zip',
        previewInZip: true,
        previewInZipFile: 'embedded-only.png',
        description: 'From inside ZIP',
      },
      {
        name: 'Legacy',
        file: 'legacy.zip',
        previewInZip: true,
        previewInZipFile: 'preview.png',
        description: 'Legacy names',
      },
      { name: 'plain', file: 'plain.zip' },
    ]);
    expect(listing.demo).toEqual([{ name: 'a', file: 'demo/a.zip' }]);
    // Corrupt sidecar must not kill the entry — falls back to the filename stem.
    expect(listing.prd).toEqual([{ name: 'c', file: 'prd/c.zip' }]);
  });

  it('returns empty groups for a missing directory (never throws)', async () => {
    const listing = await scanBundledGlobals(join(tmpdir(), 'definitely-does-not-exist-ecards'));
    expect(listing).toEqual({ shared: [], demo: [], prd: [] });
  });
});
