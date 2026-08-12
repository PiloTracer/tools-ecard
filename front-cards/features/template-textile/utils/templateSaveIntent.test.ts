import { resolveSaveIntent } from './templateSaveIntent';

describe('resolveSaveIntent (Pass 4)', () => {
  it('forks a new design with "<name> copy" when saving an opened template (quick-save name)', () => {
    const intent = resolveSaveIntent({
      requestedName: 'Base Card',
      saveAsTemplate: false,
      openedFromTemplate: { id: 'tpl-1', name: 'Base Card' },
      existingNames: ['Base Card'],
    });

    expect(intent).toEqual({ name: 'Base Card copy', kind: 'design', fork: true });
  });

  it('never returns the source template name when forking (source untouched)', () => {
    const intent = resolveSaveIntent({
      requestedName: 'Base Card',
      saveAsTemplate: false,
      openedFromTemplate: { id: 'tpl-1', name: 'Base Card' },
      existingNames: ['Base Card', 'Base Card copy'],
    });

    expect(intent.name).toBe('Base Card copy (1)');
    expect(intent.kind).toBe('design');
    expect(intent.fork).toBe(true);
    expect(intent.name).not.toBe('Base Card');
  });

  it('respects a custom name typed in the modal when forking (deduped)', () => {
    const intent = resolveSaveIntent({
      requestedName: 'Winter Promo',
      saveAsTemplate: false,
      openedFromTemplate: { id: 'tpl-1', name: 'Base Card' },
      existingNames: ['Base Card', 'Winter Promo'],
    });

    expect(intent).toEqual({ name: 'Winter Promo (1)', kind: 'design', fork: true });
  });

  it('"Save as new template" creates a new template item and never overwrites the source', () => {
    const intent = resolveSaveIntent({
      requestedName: 'Base Card',
      saveAsTemplate: true,
      openedFromTemplate: { id: 'tpl-1', name: 'Base Card' },
      existingNames: ['Base Card'],
    });

    expect(intent).toEqual({ name: 'Base Card (1)', kind: 'template', fork: true });
  });

  it('"Save as new template" from a design also forks (no in-place conversion)', () => {
    const intent = resolveSaveIntent({
      requestedName: 'My Design',
      saveAsTemplate: true,
      openedFromTemplate: null,
      existingNames: ['My Design'],
    });

    expect(intent).toEqual({ name: 'My Design (1)', kind: 'template', fork: true });
  });

  it('saves in place when a design is open (current behavior)', () => {
    const intent = resolveSaveIntent({
      requestedName: 'My Design',
      saveAsTemplate: false,
      openedFromTemplate: null,
      existingNames: ['My Design'],
    });

    expect(intent).toEqual({ name: 'My Design', kind: 'design', fork: false });
  });
});
