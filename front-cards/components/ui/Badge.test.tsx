/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders neutral badge by default', () => {
    render(<Badge>draft</Badge>);
    const badge = screen.getByTestId('ui-badge');
    expect(badge).toHaveTextContent('draft');
    expect(badge).toHaveClass('bg-surface-inset');
  });

  it('maps tones to semantic token classes', () => {
    render(<Badge tone="success">active</Badge>);
    expect(screen.getByTestId('ui-badge')).toHaveClass('bg-success-subtle', 'text-status-success');
  });

  it('renders an icon alongside the label', () => {
    render(<Badge tone="error" icon={<span data-testid="icon">!</span>}>failed</Badge>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByTestId('ui-badge')).toHaveTextContent('failed');
  });
});
