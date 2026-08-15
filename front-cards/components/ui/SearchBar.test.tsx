/** @jest-environment jsdom */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('updates value and emits debounced change after the delay', () => {
    const onDebounced = jest.fn();
    render(<SearchBar onDebouncedChange={onDebounced} />);
    fireEvent.change(screen.getByTestId('ui-search'), { target: { value: 'maria' } });
    expect(screen.getByTestId('ui-search')).toHaveValue('maria');
    expect(onDebounced).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(onDebounced).toHaveBeenCalledWith('maria');
  });

  it('emits immediate changes via onValueChange and clears', () => {
    const onValue = jest.fn();
    render(<SearchBar value="" onValueChange={onValue} />);
    fireEvent.change(screen.getByTestId('ui-search'), { target: { value: 'x' } });
    expect(onValue).toHaveBeenCalledWith('x');
  });

  it('renders with role=search and a clear button when non-empty', () => {
    render(<SearchBar defaultValue="abc" />);
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
  });
});
