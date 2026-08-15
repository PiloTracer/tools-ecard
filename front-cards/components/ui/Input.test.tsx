/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('associates label with input via htmlFor/id', () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('data-testid', 'ui-input');
    expect(input).toHaveClass('bg-surface-inset');
  });

  it('exposes error state with aria-invalid and alert message', () => {
    render(<Input label="Name" error="Required" />);
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
    expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('error'));
  });

  it('renders a textarea when multiline', () => {
    render(<Input multiline label="Notes" />);
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
  });

  it('forwards change events', () => {
    let captured = '';
    render(<Input label="Q" onChange={(e) => (captured = e.target.value)} />);
    fireEvent.change(screen.getByLabelText('Q'), { target: { value: 'abc' } });
    expect(captured).toBe('abc');
  });
});
