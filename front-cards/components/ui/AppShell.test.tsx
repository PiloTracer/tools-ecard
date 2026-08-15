/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders header and main landmarks with content', () => {
    render(
      <AppShell header={<h1>Title</h1>} banner={<div>demo banner</div>}>
        <p>body</p>
      </AppShell>,
    );
    expect(screen.getByRole('banner')).toHaveTextContent('Title');
    expect(screen.getByRole('main')).toHaveTextContent('body');
    expect(screen.getByText('demo banner')).toBeInTheDocument();
  });

  it('renders footer only when provided', () => {
    const { rerender } = render(<AppShell header="h">c</AppShell>);
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    rerender(
      <AppShell header="h" footer={<span>foot</span>}>
        c
      </AppShell>,
    );
    expect(screen.getByRole('contentinfo')).toHaveTextContent('foot');
  });
});
