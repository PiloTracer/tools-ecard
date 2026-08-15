/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders nothing when single page', () => {
    render(<Pagination page={1} totalPages={1} onPageChange={jest.fn()} />);
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('marks current page with aria-current and fires callbacks', () => {
    const onChange = jest.fn();
    render(<Pagination page={2} totalPages={5} onPageChange={onChange} />);
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(onChange).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('disables prev on first page and next on last page', () => {
    const { rerender } = render(<Pagination page={1} totalPages={3} onPageChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    rerender(<Pagination page={3} totalPages={3} onPageChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
