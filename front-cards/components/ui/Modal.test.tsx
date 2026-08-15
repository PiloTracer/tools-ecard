/** @jest-environment jsdom */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={() => {}} title="T">body</Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog with labelled title and closes via Esc', () => {
    const onClose = jest.fn();
    render(
      <Modal open onClose={onClose} title="Confirm">
        body
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Confirm');
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll while open and restores on close', () => {
    const { rerender } = render(<Modal open onClose={() => {}} title="T">x</Modal>);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Modal open={false} onClose={() => {}} title="T">x</Modal>);
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
