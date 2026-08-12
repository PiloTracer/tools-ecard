/**
 * @jest-environment jsdom
 */
import { demoTemplateRepository } from './demoTemplateRepository';
import { demoStore } from './demoStore';
import { enterDemoMode } from './isDemoMode';
import { resolveDemoStorageUserId } from './demoStorageUserId';
import type { Template } from '@/features/template-textile/types';

describe('demoTemplateRepository persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    enterDemoMode();
    demoStore.setActiveUserId(resolveDemoStorageUserId({ id: 'test-oauth-user', email: 't@example.com' }));
    demoStore.setTemplates([]);
  });

  it('saves and lists a template via IndexedDB-backed store', async () => {
    const template: Template = {
      id: 'tpl-test-1',
      name: 'Persisted Card',
      width: 400,
      height: 300,
      backgroundColor: '#ffffff',
      elements: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const meta = await demoTemplateRepository.saveTemplate({
      name: template.name,
      templateData: template,
    });

    expect(meta.name).toBe('Persisted Card');

    const listed = await demoTemplateRepository.listTemplates();
    expect(listed.some((t) => t.name === 'Persisted Card')).toBe(true);

    const loaded = await demoTemplateRepository.loadTemplate(meta.id);
    expect(loaded.data.name).toBe('Persisted Card');
  });

  it('defaults kind to "design" on save and persists an explicit kind', async () => {
    const design = await demoTemplateRepository.saveTemplate({
      name: 'Plain Card',
      templateData: makeTemplate('design'),
    });
    expect(design.kind).toBe('design');

    const template = await demoTemplateRepository.saveTemplate({
      name: 'Reusable Card',
      templateData: makeTemplate('tpl'),
      kind: 'template',
    });
    expect(template.kind).toBe('template');

    const loaded = await demoTemplateRepository.loadTemplate(template.id);
    expect(loaded.metadata.kind).toBe('template');
  });

  it('filters listTemplates by kind', async () => {
    await demoTemplateRepository.saveTemplate({ name: 'A design', templateData: makeTemplate('d1') });
    await demoTemplateRepository.saveTemplate({ name: 'A template', templateData: makeTemplate('t1'), kind: 'template' });

    const all = await demoTemplateRepository.listTemplates();
    expect(all).toHaveLength(2);

    const templates = await demoTemplateRepository.listTemplates('template');
    expect(templates.map((t) => t.name)).toEqual(['A template']);

    const designs = await demoTemplateRepository.listTemplates('design');
    expect(designs.map((t) => t.name)).toEqual(['A design']);
  });

  it('reads legacy records without kind as "design" (backward compatible)', async () => {
    // Simulate a record written before the kind field existed
    const now = new Date().toISOString();
    demoStore.setTemplates([
      {
        id: 'legacy-1',
        name: 'Legacy Card',
        data: makeTemplate('legacy-1'),
        resources: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const listed = await demoTemplateRepository.listTemplates();
    expect(listed[0].kind).toBe('design');

    const loaded = await demoTemplateRepository.loadTemplate('legacy-1');
    expect(loaded.metadata.kind).toBe('design');

    // And it appears in the designs filter, not the templates filter
    expect((await demoTemplateRepository.listTemplates('design')).map((t) => t.id)).toEqual(['legacy-1']);
    expect(await demoTemplateRepository.listTemplates('template')).toHaveLength(0);
  });
});

function makeTemplate(seed: string): Template {
  return {
    id: `tpl-${seed}`,
    name: `Card ${seed}`,
    width: 400,
    height: 300,
    backgroundColor: '#ffffff',
    elements: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
