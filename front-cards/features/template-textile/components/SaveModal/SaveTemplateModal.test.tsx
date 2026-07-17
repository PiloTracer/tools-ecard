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
      expect(onSave).toHaveBeenCalledWith('Holiday Card v2', 'Marketing');
    });
  });
});
