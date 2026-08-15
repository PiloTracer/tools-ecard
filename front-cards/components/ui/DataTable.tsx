'use client';

import { useState, type ReactNode } from 'react';
import { cn } from './cn';

export interface DataTableColumn<T> {
  id: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  /** raw value used for sorting (default: stringify of render or row field) */
  sortValue?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  data: T[];
  rowKey: (row: T) => string;
  caption?: string;
  emptyState?: ReactNode;
  className?: string;
}

/**
 * DataTable — accessible table primitive (native <table>, caption/scope headers,
 * client-side sort when a column is sortable). Tokens only.
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  caption,
  emptyState,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);

  const sorted = [...data];
  if (sort) {
    const col = columns.find((c) => c.id === sort.col);
    if (col) {
      const get =
        col.sortValue ?? ((row: T) => String((row as Record<string, unknown>)[col.id] ?? ''));
      sorted.sort((a, b) => {
        const av = get(a);
        const bv = get(b);
        const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
  }

  const toggleSort = (col: DataTableColumn<T>) => {
    if (!col.sortable) return;
    setSort((prev) =>
      prev?.col === col.id && prev.dir === 'asc' ? { col: col.id, dir: 'desc' } : { col: col.id, dir: 'asc' },
    );
  };

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border-subtle', className)}>
      <table className="w-full border-collapse text-sm" data-testid="ui-datatable">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-border-subtle bg-surface-inset">
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                aria-sort={
                  sort?.col === col.id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
                }
                className={cn(
                  'px-4 py-2 text-left font-medium text-text-secondary',
                  col.sortable && 'cursor-pointer select-none hover:text-text-primary',
                )}
                onClick={col.sortable ? () => toggleSort(col) : undefined}
              >
                {col.label}
                {col.sortable && sort?.col === col.id ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)} className="border-b border-border-subtle last:border-b-0 hover:bg-surface-inset">
              {columns.map((col) => (
                <td key={col.id} className="px-4 py-2 text-text-primary">
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.id] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div className="p-6 text-center text-sm text-text-muted">{emptyState ?? 'No rows'}</div>
      )}
    </div>
  );
}
