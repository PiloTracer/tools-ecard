/**
 * @jest-environment jsdom
 */
import { demoTemplateRepository } from './demoTemplateRepository';
import { demoStore } from './demoStore';
import type { Template } from '@/features/template-textile/types';

describe('demoTemplateRepository persistence', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
