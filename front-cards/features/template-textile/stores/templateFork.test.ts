/**
 * Pass 4 — store-level fork semantics: opening a template arms fork-on-save,
 * saving forks a NEW design (source template untouched); opening a design
 * keeps in-place saves. Mirrors the CanvasControls.handleSaveTemplate flow.
 */
import { useTemplateStore } from './templateStore';
import { resolveSaveIntent } from '../utils/templateSaveIntent';
import { templateService } from '../services/templateService';
import type { Template } from '../types';

jest.mock('../services/exportService', () => ({
  preloadTemplateFonts: jest.fn(async () => undefined),
}));

jest.mock('./canvasStore', () => ({
  useCanvasStore: {
    getState: () => ({ bumpTemplateFabricBindingEpoch: jest.fn() }),
  },
}));

jest.mock('../services/templateService', () => ({
  templateService: {
    saveTemplate: jest.fn(),
    listTemplates: jest.fn(),
  },
}));

const mockSaveTemplate = templateService.saveTemplate as jest.Mock;
const mockListTemplates = templateService.listTemplates as jest.Mock;

function makeTemplate(id: string, name: string): Template {
  return {
    id,
    name,
    width: 1000,
    height: 600,
    backgroundColor: '#ffffff',
    elements: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('templateStore fork semantics (Pass 4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTemplateStore.getState().createTemplate('Untitled Template', 1000, 600);
  });

  it('clears the fork source on createTemplate and loadTemplate', async () => {
    useTemplateStore.getState().setOpenedFromTemplate({ id: 'tpl-1', name: 'Base Card' });
    expect(useTemplateStore.getState().openedFromTemplate).not.toBeNull();

    useTemplateStore.getState().createTemplate('New Doc', 1000, 600);
    expect(useTemplateStore.getState().openedFromTemplate).toBeNull();

    useTemplateStore.getState().setOpenedFromTemplate({ id: 'tpl-1', name: 'Base Card' });
    await useTemplateStore.getState().loadTemplate(makeTemplate('tpl-1', 'Base Card'));
    expect(useTemplateStore.getState().openedFromTemplate).toBeNull();
  });

  it('open template → save forks a new design id; source template is never written', async () => {
    // Open a template (marker set by the open flow)
    await useTemplateStore.getState().loadTemplate(makeTemplate('tpl-source', 'Base Card'));
    useTemplateStore.getState().setOpenedFromTemplate({ id: 'tpl-source', name: 'Base Card' });

    mockListTemplates.mockResolvedValue([{ id: 'tpl-source', name: 'Base Card', kind: 'template' }]);
    mockSaveTemplate.mockResolvedValue({ id: 'design-new', name: 'Base Card copy', kind: 'design' });

    // Same glue as CanvasControls.handleSaveTemplate (quick-save passes the current name)
    const store = useTemplateStore.getState();
    const intent = resolveSaveIntent({
      requestedName: store.currentTemplateName!,
      saveAsTemplate: false,
      openedFromTemplate: store.openedFromTemplate,
      existingNames: (await templateService.listTemplates()).map((t: { name: string }) => t.name),
    });

    const metadata = await templateService.saveTemplate({
      name: intent.name,
      templateData: store.currentTemplate!,
      kind: intent.kind,
    });
    useTemplateStore.getState().updateTemplateId(metadata.id);
    useTemplateStore.getState().setSaveMetadata('Default Project', intent.name);
    useTemplateStore.getState().setOpenedFromTemplate(null);
    useTemplateStore.getState().markAsSaved();

    // Forked: persisted as a NEW design, never under the source name
    expect(mockSaveTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Base Card copy', kind: 'design' })
    );
    expect(mockSaveTemplate).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Base Card' })
    );

    const after = useTemplateStore.getState();
    expect(after.currentTemplate?.id).toBe('design-new');
    expect(after.currentTemplateName).toBe('Base Card copy');
    expect(after.openedFromTemplate).toBeNull();
    expect(after.hasUnsavedChanges).toBe(false);
  });

  it('open design → save in place (name unchanged, kind design)', async () => {
    await useTemplateStore.getState().loadTemplate(makeTemplate('design-1', 'My Design'));
    // Opening a design leaves the fork marker unset
    useTemplateStore.getState().setOpenedFromTemplate(null);

    mockListTemplates.mockResolvedValue([{ id: 'design-1', name: 'My Design', kind: 'design' }]);
    mockSaveTemplate.mockResolvedValue({ id: 'design-1', name: 'My Design', kind: 'design' });

    const store = useTemplateStore.getState();
    const intent = resolveSaveIntent({
      requestedName: store.currentTemplateName!,
      saveAsTemplate: false,
      openedFromTemplate: store.openedFromTemplate,
      existingNames: (await templateService.listTemplates()).map((t: { name: string }) => t.name),
    });

    expect(intent).toEqual({ name: 'My Design', kind: 'design', fork: false });

    await templateService.saveTemplate({
      name: intent.name,
      templateData: store.currentTemplate!,
      kind: intent.kind,
    });

    expect(mockSaveTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Design', kind: 'design' })
    );
  });

  it('"Save as new template" re-arms the fork marker on the new template', async () => {
    await useTemplateStore.getState().loadTemplate(makeTemplate('tpl-source', 'Base Card'));
    useTemplateStore.getState().setOpenedFromTemplate({ id: 'tpl-source', name: 'Base Card' });

    mockListTemplates.mockResolvedValue([{ id: 'tpl-source', name: 'Base Card', kind: 'template' }]);
    mockSaveTemplate.mockResolvedValue({ id: 'tpl-new', name: 'Base Card (1)', kind: 'template' });

    const store = useTemplateStore.getState();
    const intent = resolveSaveIntent({
      requestedName: 'Base Card',
      saveAsTemplate: true,
      openedFromTemplate: store.openedFromTemplate,
      existingNames: (await templateService.listTemplates()).map((t: { name: string }) => t.name),
    });

    const metadata = await templateService.saveTemplate({
      name: intent.name,
      templateData: store.currentTemplate!,
      kind: intent.kind,
    });
    useTemplateStore.getState().updateTemplateId(metadata.id);
    useTemplateStore.getState().setSaveMetadata('Default Project', intent.name);
    // Document is now a template again → future saves fork
    useTemplateStore.getState().setOpenedFromTemplate({ id: metadata.id, name: intent.name });

    const after = useTemplateStore.getState();
    expect(intent.kind).toBe('template');
    expect(after.openedFromTemplate).toEqual({ id: 'tpl-new', name: 'Base Card (1)' });
  });
});
