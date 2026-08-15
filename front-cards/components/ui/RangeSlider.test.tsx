/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { RangeSlider } from './RangeSlider';

describe('RangeSlider', () => {
  it('renders label + value readout and reports changes', () => {
    const onChange = jest.fn();
    render(<RangeSlider label="Opacity" value={50} min={0} max={100} onChange={onChange} />);
    expect(screen.getByLabelText('Opacity')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('ui-rangeslider'), { target: { value: '75' } });
    expect(onChange).toHaveBeenCalledWith(75);
  });

  it('formats the readout and clamps range attrs', () => {
    render(
      <RangeSlider label="Zoom" value={1} min={0.1} max={5} step={0.1} formatValue={(v) => `${Math.round(v * 100)}%`} onChange={jest.fn()} />,
    );
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByTestId('ui-rangeslider')).toHaveAttribute('max', '5');
  });
});
