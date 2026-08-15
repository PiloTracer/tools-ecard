/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { Select } from './Select';

describe('Select', () => {
  it('associates label and renders options', () => {
    render(
      <Select label="Project">
        <option value="p1">Project 1</option>
      </Select>,
    );
    const select = screen.getByLabelText('Project');
    expect(select).toHaveClass('bg-surface-inset');
    expect(screen.getByRole('option', { name: 'Project 1' })).toBeInTheDocument();
  });

  it('marks error with aria-invalid and forwards change', () => {
    render(
      <Select label="S" error="Pick one">
        <option value="">—</option>
      </Select>,
    );
    expect(screen.getByLabelText('S')).toHaveAttribute('aria-invalid', 'true');
  });

  it('forwards refs to the native element', () => {
    const ref = jest.fn();
    render(<Select ref={ref} aria-label="X" />);
    expect(ref).toHaveBeenCalled();
  });
});
