/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { StatePanel } from './StatePanel';
import { Button } from './Button';

describe('StatePanel', () => {
  it('loading: role=status, aria-busy, spinner', () => {
    render(<StatePanel kind="loading" title="Loading projects" />);
    const panel = screen.getByTestId('ui-statepanel');
    expect(panel).toHaveAttribute('role', 'status');
    expect(panel).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading projects')).toBeInTheDocument();
  });

  it('error: role=alert with retry action slot', () => {
    render(<StatePanel kind="error" title="Failed" action={<Button>Retry</Button>} />);
    expect(screen.getByTestId('ui-statepanel')).toHaveAttribute('role', 'alert');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('empty: renders title + description', () => {
    render(<StatePanel kind="empty" title="No batches" description="Upload one to start" />);
    expect(screen.getByText('No batches')).toBeInTheDocument();
    expect(screen.getByText('Upload one to start')).toBeInTheDocument();
  });
});
