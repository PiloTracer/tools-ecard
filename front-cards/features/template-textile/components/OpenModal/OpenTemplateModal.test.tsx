import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OpenTemplateModal } from './OpenTemplateModal';
import { templateService, type TemplateMetadata } from '../../services/templateService';
import { bundledTemplatesService } from '../../services/bundledTemplatesService';

jest.mock('../../services/templateService', () => ({
  templateService: {
    listTemplates: jest.fn(),
    deleteTemplate: jest.fn(),
  },
}));

jest.mock('../../services/bundledTemplatesService', () => ({
  bundledTemplatesService: {
    listBundledTemplates: jest.fn(),
  },
}));

const mockListTemplates = templateService.listTemplates as jest.Mock;
const mockDeleteTemplate = templateService.deleteTemplate as jest.Mock;
const mockListBundled = bundledTemplatesService.listBundledTemplates as jest.Mock;

function makeItem(id: string, name: string, kind: 'template' | 'design'): TemplateMetadata {
  return {
    id,
    userId: 'user-1',
    name,
    storageUrl: `local://${id}`,
    storageMode: 'LOCAL_ONLY',
    resourceUrls: [],
    version: 1,
    kind,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
  };
}

const ITEMS = [
  makeItem('tpl-1', 'Base Card', 'template'),
  makeItem('d-1', 'Base Card copy', 'design'),
  makeItem('d-2', 'Winter Promo', 'design'),
];

describe('OpenTemplateModal gallery kind filter (Pass 4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListTemplates.mockResolvedValue(ITEMS);
    mockListBundled.mockResolvedValue([]);
  });

  it('shows all items with kind badges by default', async () => {
    render(<OpenTemplateModal isOpen onClose={jest.fn()} onOpen={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Winter Promo')).toBeInTheDocument());
    expect(screen.getByText('Base Card')).toBeInTheDocument();
    expect(screen.getByText('Base Card copy')).toBeInTheDocument();

    // Kind badges: 1 template + 2 designs
    expect(screen.getAllByText('Template')).toHaveLength(1);
    expect(screen.getAllByText('Design')).toHaveLength(2);
  });

  it('filters to templates only on the "Templates" tab', async () => {
    render(<OpenTemplateModal isOpen onClose={jest.fn()} onOpen={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Winter Promo')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));

    expect(screen.getByText('Base Card')).toBeInTheDocument();
    expect(screen.queryByText('Base Card copy')).not.toBeInTheDocument();
    expect(screen.queryByText('Winter Promo')).not.toBeInTheDocument();
  });

  it('filters to designs only on the "My designs" tab', async () => {
    render(<OpenTemplateModal isOpen onClose={jest.fn()} onOpen={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Winter Promo')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'My designs' }));

    expect(screen.queryByText('Base Card')).not.toBeInTheDocument();
    expect(screen.getByText('Base Card copy')).toBeInTheDocument();
    expect(screen.getByText('Winter Promo')).toBeInTheDocument();
  });

  it('treats items without a kind as designs (legacy entries)', async () => {
    mockListTemplates.mockResolvedValue([
      { ...makeItem('legacy-1', 'Legacy Card', 'design'), kind: undefined },
    ]);

    render(<OpenTemplateModal isOpen onClose={jest.fn()} onOpen={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Legacy Card')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'My designs' }));
    expect(screen.getByText('Legacy Card')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Templates' }));
    expect(screen.queryByText('Legacy Card')).not.toBeInTheDocument();
  });
});

describe('OpenTemplateModal — globals (Pass 5)', () => {
  const API_GLOBAL = { ...makeItem('g-1', 'Corporate Global', 'template'), isPublic: true };
  const BUNDLED_GLOBAL = {
    ...makeItem('bundled:card.zip', 'Bundled Card', 'template'),
    isBundled: true,
    previewUrl: '/templates/globals/card.png',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockListTemplates.mockResolvedValue([makeItem('d-1', 'My Design', 'design'), API_GLOBAL]);
    mockListBundled.mockResolvedValue([BUNDLED_GLOBAL]);
  });

  it('merges bundled globals into the gallery and badges API + bundled globals', async () => {
    render(<OpenTemplateModal isOpen onClose={jest.fn()} onOpen={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Bundled Card')).toBeInTheDocument());
    expect(screen.getByText('Corporate Global')).toBeInTheDocument();
    expect(screen.getByText('My Design')).toBeInTheDocument();

    // Global badge on the API global and the bundled global only
    expect(screen.getAllByText('Global')).toHaveLength(2);
  });

  it('hides the delete affordance from regular users (deny by default)', async () => {
    render(<OpenTemplateModal isOpen onClose={jest.fn()} onOpen={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Corporate Global')).toBeInTheDocument());

    expect(
      screen.queryByRole('button', { name: /delete global template/i })
    ).not.toBeInTheDocument();
  });

  it('shows the delete affordance to supers on API globals only (not bundled)', async () => {
    render(
      <OpenTemplateModal isOpen onClose={jest.fn()} onOpen={jest.fn()} canManageGlobalTemplates />
    );
    await waitFor(() => expect(screen.getByText('Corporate Global')).toBeInTheDocument());

    const deleteButtons = screen.getAllByRole('button', { name: /delete global template/i });
    expect(deleteButtons).toHaveLength(1);
    expect(deleteButtons[0]).toHaveAccessibleName('Delete global template Corporate Global');
  });

  it('deletes an API global after confirmation and refreshes the list', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockDeleteTemplate.mockResolvedValue(undefined);

    render(
      <OpenTemplateModal isOpen onClose={jest.fn()} onOpen={jest.fn()} canManageGlobalTemplates />
    );
    await waitFor(() => expect(screen.getByText('Corporate Global')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Delete global template Corporate Global' }));

    await waitFor(() => expect(mockDeleteTemplate).toHaveBeenCalledWith('g-1'));
    // List refreshed after delete
    await waitFor(() => expect(mockListTemplates).toHaveBeenCalledTimes(2));

    (window.confirm as jest.Mock).mockRestore?.();
  });
});
