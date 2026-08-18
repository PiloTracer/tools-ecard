/**
 * TemplatePackageService — ZIP package export/import with embedded sidecars.
 */

import JSZip from 'jszip';
import { templatePackageService } from './templatePackageService';
import type { Template } from '../types';

function makeTemplate(name = 'Test Template'): Template {
  return {
    id: 'test-id',
    name,
    width: 1000,
    height: 600,
    canvasWidth: 1000,
    canvasHeight: 600,
    backgroundColor: '#ffffff',
    elements: [],
    createdAt: new Date('2026-08-18T00:00:00Z'),
    updatedAt: new Date('2026-08-18T00:00:00Z'),
  };
}

describe('TemplatePackageService', () => {
  it('embeds preview.png and sidecar.json in the exported ZIP', async () => {
    const template = makeTemplate('Sidecar Test');
    const sidecar = { name: 'Published Name', description: 'Published description' };
    const previewDataUrl = 'data:image/png;base64,iVBORw0KGgo=';

    const blob = await templatePackageService.exportPackage(template, {
      previewDataUrl,
      sidecar,
    });

    const zip = await JSZip.loadAsync(blob);
    expect(zip.file('template.json')).not.toBeNull();
    expect(zip.file('package.json')).not.toBeNull();

    const previewFile = zip.file('preview.png');
    expect(previewFile).not.toBeNull();
    const previewData = await previewFile!.async('uint8array');
    // data:image/png;base64,iVBORw0KGgo= decodes to the PNG magic bytes (0x89 0x50 0x4e 0x47 ...).
    expect(previewData.length).toBeGreaterThanOrEqual(4);
    expect(previewData[0]).toBe(0x89);
    expect(previewData[1]).toBe(0x50);
    expect(previewData[2]).toBe(0x4e);
    expect(previewData[3]).toBe(0x47);

    const sidecarFile = zip.file('sidecar.json');
    expect(sidecarFile).not.toBeNull();
    const sidecarData = JSON.parse(await sidecarFile!.async('string'));
    expect(sidecarData).toEqual(sidecar);
  });

  it('exports a ZIP without sidecars when none are provided', async () => {
    const template = makeTemplate('No Sidecars');
    const blob = await templatePackageService.exportPackage(template);

    const zip = await JSZip.loadAsync(blob);
    expect(zip.file('template.json')).not.toBeNull();
    expect(zip.file('package.json')).not.toBeNull();
    expect(zip.file('preview.png')).toBeNull();
    expect(zip.file('sidecar.json')).toBeNull();
  });
});
