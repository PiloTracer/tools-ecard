/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders primary accent button with correct default type', () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toHaveClass('bg-accent', 'text-text-on-accent');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('applies variant + size classes and disabled state', () => {
    const { rerender } = render(<Button variant="danger" size="sm">Delete</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-status-error', 'px-3', 'py-1.5');
    rerender(<Button disabled>X</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveClass('disabled:opacity-50');
  });

  it('forwards click handlers', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Go</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
