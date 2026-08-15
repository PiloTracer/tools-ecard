/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { Progress } from './Progress';

describe('Progress', () => {
  it('renders readout and bar with aria values', () => {
    render(<Progress value={7} max={10} label="Cards generated" />);
    const bar = screen.getByTestId('ui-progress');
    expect(bar).toHaveAttribute('role', 'progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '7');
    expect(bar).toHaveAttribute('aria-valuemax', '10');
    expect(screen.getByText('Cards generated')).toBeInTheDocument();
    expect(screen.getByText('7 / 10')).toBeInTheDocument();
  });

  it('clamps width to 100% and supports tones', () => {
    const { container } = render(<Progress value={120} max={100} tone="warning" />);
    const fill = container.querySelector('[style*="width"]');
    expect(fill).toHaveStyle('width: 100%');
    expect(container.querySelector('.bg-status-warning')).toBeInTheDocument();
  });
});
