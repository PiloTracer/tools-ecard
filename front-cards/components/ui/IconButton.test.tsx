/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('requires an accessible label and fires clicks', () => {
    const onClick = jest.fn();
    render(
      <IconButton aria-label="Undo" onClick={onClick}>
        <span>↶</span>
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies size + danger variants and disabled state', () => {
    const { rerender } = render(
      <IconButton aria-label="Delete" size="sm" variant="danger">
        x
      </IconButton>,
    );
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn).toHaveClass('h-8', 'w-8', 'hover:bg-error-subtle');
    rerender(
      <IconButton aria-label="Delete" disabled>
        x
      </IconButton>,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});
