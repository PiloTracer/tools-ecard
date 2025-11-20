'use client';

import { useTemplateStore } from '../../stores/templateStore';
import type { TableElement } from '../../types';

interface TablePropertiesProps {
  element: TableElement;
}

export function TableProperties({ element }: TablePropertiesProps) {
  const { updateElement, elements } = useTemplateStore();

  const handleChange = (updates: Partial<TableElement>) => {
    updateElement(element.id, updates);
  };

  const handleRowsChange = (newRows: number) => {
    if (newRows === element.rows) return;

    const oldRows = element.rows;

    // Remove cells that are now outside bounds
    const newCells = element.cells.filter(cell => cell.row < newRows);

    // Resize rowHeights array
    const newRowHeights = [...element.rowHeights];
    if (newRows > oldRows) {
      // Adding rows - extend with default height
      const defaultHeight = element.minCellHeight || element.cellHeight || 50;
      for (let i = oldRows; i < newRows; i++) {
        newRowHeights[i] = defaultHeight;
      }
    } else {
      // Removing rows - shrink array
      newRowHeights.length = newRows;
    }

    updateElement(element.id, {
      rows: newRows,
      cells: newCells,
      rowHeights: newRowHeights,
      needsRecalculation: true  // Flag for DesignCanvas to recalculate
    });
  };

  const handleColumnsChange = (newColumns: number) => {
    if (newColumns === element.columns) return;

    const oldColumns = element.columns;

    // Remove cells that are now outside bounds
    const newCells = element.cells.filter(cell => cell.column < newColumns);

    // Resize columnWidths array
    const newColumnWidths = [...element.columnWidths];
    if (newColumns > oldColumns) {
      // Adding columns - extend with default width
      const defaultWidth = element.minCellWidth || element.cellWidth || 60;
      for (let i = oldColumns; i < newColumns; i++) {
        newColumnWidths[i] = defaultWidth;
      }
    } else {
      // Removing columns - shrink array
      newColumnWidths.length = newColumns;
    }

    updateElement(element.id, {
      columns: newColumns,
      cells: newCells,
      columnWidths: newColumnWidths,
      needsRecalculation: true  // Flag for DesignCanvas to recalculate
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Rows</label>
          <input
            type="number"
            value={element.rows}
            onChange={(e) => handleRowsChange(parseInt(e.target.value) || 1)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            min={1}
            max={20}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Columns</label>
          <input
            type="number"
            value={element.columns}
            onChange={(e) => handleColumnsChange(parseInt(e.target.value) || 1)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            min={1}
            max={20}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Cell Width</label>
          <input
            type="number"
            value={element.cellWidth}
            onChange={(e) => handleChange({ cellWidth: parseInt(e.target.value) || 50 })}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            min={20}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Cell Height</label>
          <input
            type="number"
            value={element.cellHeight}
            onChange={(e) => handleChange({ cellHeight: parseInt(e.target.value) || 50 })}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
            min={20}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Border Color</label>
        <input
          type="color"
          value={element.borderColor || '#cccccc'}
          onChange={(e) => handleChange({ borderColor: e.target.value })}
          className="h-10 w-full rounded border border-gray-300 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Border Width</label>
        <input
          type="number"
          value={element.borderWidth || 1}
          onChange={(e) => handleChange({ borderWidth: parseInt(e.target.value) || 1 })}
          className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          min={0}
          max={10}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Opacity</label>
        <input
          type="range"
          value={(element.opacity || 1) * 100}
          onChange={(e) => handleChange({ opacity: parseInt(e.target.value) / 100 })}
          className="w-full"
          min={0}
          max={100}
        />
        <div className="text-xs text-gray-500 text-right">{Math.round((element.opacity || 1) * 100)}%</div>
      </div>
    </div>
  );
}
