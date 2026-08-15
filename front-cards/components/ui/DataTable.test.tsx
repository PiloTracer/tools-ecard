/** @jest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable } from './DataTable';

interface Row {
  id: string;
  name: string;
  qty: number;
}

const rows: Row[] = [
  { id: 'a', name: 'zeta', qty: 2 },
  { id: 'b', name: 'alpha', qty: 1 },
];

function Table() {
  return (
    <DataTable<Row>
      caption="items"
      columns={[
        { id: 'name', label: 'Name', sortable: true },
        { id: 'qty', label: 'Qty', sortable: true, sortValue: (r) => r.qty },
      ]}
      data={rows}
      rowKey={(r) => r.id}
    />
  );
}

describe('DataTable', () => {
  it('renders header cells with scope and row cells', () => {
    render(<Table />);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('scope', 'col');
    expect(screen.getByText('zeta')).toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument();
  });

  it('sorts asc then desc on sortable header click', () => {
    render(<Table />);
    const header = screen.getByRole('columnheader', { name: /Name/ });
    fireEvent.click(header);
    const names = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(names[0]).toContain('alpha');
    fireEvent.click(header);
    const namesDesc = screen.getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(namesDesc[0]).toContain('zeta');
  });

  it('renders empty state when no rows', () => {
    render(
      <DataTable
        columns={[{ id: 'a', label: 'A' }]}
        data={[]}
        rowKey={() => ''}
        emptyState={<span>nothing here</span>}
      />,
    );
    expect(screen.getByText('nothing here')).toBeInTheDocument();
  });
});
