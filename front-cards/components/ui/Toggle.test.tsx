/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { Toggle } from './Toggle';

describe('Toggle', () => {
  it('exposes switch role + aria-checked and toggles', () => {
    const onChange = jest.fn();
    render(<Toggle checked={false} onCheckedChange={onChange} label="Grid" />);
    const btn = screen.getByRole('switch', { name: 'Grid' });
    expect(btn).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders On/Off text (never color-only) and checked styling', () => {
    render(<Toggle checked onCheckedChange={jest.fn()} label="Snap" />);
    expect(screen.getByRole('switch')).toHaveTextContent('On');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
});
