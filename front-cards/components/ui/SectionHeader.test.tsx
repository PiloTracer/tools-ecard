/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionHeader } from './SectionHeader';

describe('SectionHeader', () => {
  it('renders title at requested heading level', () => {
    render(<SectionHeader title="Subscription" level={2} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Subscription' })).toBeInTheDocument();
  });

  it('toggle exposes aria-expanded + aria-controls and fires callback', () => {
    const onToggle = jest.fn();
    render(
      <SectionHeader
        title="Settings"
        toggle={{ open: false, onToggle, controls: 'settings-body', collapsedLabel: 'Show settings' }}
      />,
    );
    const btn = screen.getByTestId('ui-section-toggle');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(btn).toHaveAttribute('aria-controls', 'settings-body');
    expect(btn).toHaveTextContent('Show settings');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
