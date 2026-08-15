/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders children with elevated surface + elevation-2 shadow by default', () => {
    const { container } = render(<Card>hello</Card>);
    expect(screen.getByTestId('ui-card')).toHaveTextContent('hello');
    expect(container.firstChild).toHaveClass('bg-surface-elevated', 'shadow-elevation-2');
  });

  it('supports elevation and interactive variants', () => {
    const { container, rerender } = render(<Card elevation={1}>a</Card>);
    expect(container.firstChild).toHaveClass('shadow-elevation-1');
    rerender(<Card elevation={3} variant="interactive">b</Card>);
    expect(container.firstChild).toHaveClass('shadow-elevation-3', 'cursor-pointer', 'hover:border-accent');
  });
});
