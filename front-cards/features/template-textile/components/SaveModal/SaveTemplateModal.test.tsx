import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SaveTemplateModal } from './SaveTemplateModal';

jest.mock('../../stores/templateStore', () => ({
  useTemplateStore: () => ({}),
}));

describe('SaveTemplateModal', () => {
  it('syncs the template name field when the modal opens', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <SaveTemplateModal
        isOpen={false}
        onClose={jest.fn()}
        onSave={onSave}
        currentTemplateName="First name"
        currentProjectName="Project A"
      />
    );

    rerender(
      <SaveTemplateModal
        isOpen
        onClose={jest.fn()}
        onSave={onSave}
        currentTemplateName="Updated name"
        currentProjectName="Project B"
      />
    );

    expect(screen.getByLabelText(/Template Name/i)).toHaveValue('Updated name');
    expect(screen.getByLabelText(/Project Name/i)).toHaveValue('Project B');
  });

  it('submits the edited template name', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();

    render(
      <SaveTemplateModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        currentTemplateName="Holiday Card"
        currentProjectName="Marketing"
      />
    );

    fireEvent.change(screen.getByLabelText(/Template Name/i), {
      target: { value: 'Holiday Card v2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Template/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('Holiday Card v2', 'Marketing', { saveAsTemplate: false });
    });
  });

  it('passes saveAsTemplate when "Save as new template" is checked (Pass 4)', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <SaveTemplateModal
        isOpen
        onClose={jest.fn()}
        onSave={onSave}
        currentTemplateName="Holiday Card"
        currentProjectName="Marketing"
      />
    );

    fireEvent.click(screen.getByLabelText(/Save as new template/i));
    fireEvent.click(screen.getByRole('button', { name: /Save Template/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('Holiday Card', 'Marketing', { saveAsTemplate: true });
    });
  });

  it('suggests "<template> copy" and shows the fork hint when opened from a template (Pass 4)', () => {
    render(
      <SaveTemplateModal
        isOpen
        onClose={jest.fn()}
        onSave={jest.fn().mockResolvedValue(undefined)}
        currentTemplateName="Base Card"
        currentProjectName="Marketing"
        openedFromTemplateName="Base Card"
      />
    );

    expect(screen.getByLabelText(/Template Name/i)).toHaveValue('Base Card copy');
    expect(screen.getByText(/leaves the template unchanged/i)).toBeInTheDocument();
  });

  it('hides the "Global (all users)" option without the role (Pass 5, deny by default)', () => {
    render(
      <SaveTemplateModal
        isOpen
        onClose={jest.fn()}
        onSave={jest.fn().mockResolvedValue(undefined)}
        currentTemplateName="Holiday Card"
        currentProjectName="Marketing"
      />
    );

    fireEvent.click(screen.getByLabelText(/Save as new template/i));
    expect(screen.queryByLabelText(/Global \(all users\)/i)).not.toBeInTheDocument();
  });

  it('offers "Global (all users)" to supers and sends saveAsGlobal (Pass 5)', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <SaveTemplateModal
        isOpen
        onClose={jest.fn()}
        onSave={onSave}
        currentTemplateName="Holiday Card"
        currentProjectName="Marketing"
        canManageGlobalTemplates
      />
    );

    // Hidden until "Save as new template" is checked
    expect(screen.queryByLabelText(/Global \(all users\)/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Save as new template/i));
    fireEvent.click(screen.getByLabelText(/Global \(all users\)/i));
    fireEvent.click(screen.getByRole('button', { name: /Save Template/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('Holiday Card', 'Marketing', {
        saveAsTemplate: true,
        saveAsGlobal: true,
      });
    });
  });

  it('clears saveAsGlobal when "Save as new template" is unchecked (Pass 5)', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <SaveTemplateModal
        isOpen
        onClose={jest.fn()}
        onSave={onSave}
        currentTemplateName="Holiday Card"
        currentProjectName="Marketing"
        canManageGlobalTemplates
      />
    );

    fireEvent.click(screen.getByLabelText(/Save as new template/i));
    fireEvent.click(screen.getByLabelText(/Global \(all users\)/i));
    fireEvent.click(screen.getByLabelText(/Save as new template/i)); // uncheck
    fireEvent.click(screen.getByRole('button', { name: /Save Template/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('Holiday Card', 'Marketing', { saveAsTemplate: false });
    });
  });
});
