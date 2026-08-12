'use client';

/**
 * FieldMappingModal — user-defined column→field mapping (Pass 3).
 *
 * Shown during the upload/paste flow when some columns could not be
 * auto-mapped, or on demand via "Adjust mapping". Each source column gets a
 * dropdown of the 30 canonical vCard fields (plus "— Ignore —"), preselected
 * with the auto-mapped field (or the suggested preset's choice). Confirming
 * emits an explicit FieldMappingEntry[] that is threaded to the parser.
 */

import { useMemo, useState } from 'react';
import {
  MAPPING_IGNORE_TARGET,
  type CanonicalTargetField,
  type ColumnMappingAnalysis,
  type FieldMappingEntry,
  type FieldMappingPreset,
} from '../types';

interface FieldMappingModalProps {
  isOpen: boolean;
  columns: ColumnMappingAnalysis[];
  targetFields: CanonicalTargetField[];
  suggestedPreset?: FieldMappingPreset | null;
  onClose: () => void;
  onConfirm: (mapping: FieldMappingEntry[], savePresetName?: string) => Promise<void>;
}

export function FieldMappingModal(props: FieldMappingModalProps) {
  // Remount-on-open: the inner component initializes its state on mount, so
  // opening the modal always starts from fresh preselections (no reset effect).
  if (!props.isOpen) return null;
  return <FieldMappingModalInner {...props} />;
}

function FieldMappingModalInner({
  columns,
  targetFields,
  suggestedPreset,
  onClose,
  onConfirm,
}: FieldMappingModalProps) {
  const presetByColumn = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of suggestedPreset?.mapping ?? []) {
      map.set(entry.sourceColumn, entry.targetField);
    }
    return map;
  }, [suggestedPreset]);

  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const column of columns) {
      initial[column.sourceColumn] =
        presetByColumn.get(column.sourceColumn) ??
        column.autoField ??
        MAPPING_IGNORE_TARGET;
    }
    return initial;
  });
  const [savePreset, setSavePreset] = useState(false);
  const [presetName, setPresetName] = useState(suggestedPreset?.name ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (savePreset && !presetName.trim()) {
      setError('Preset name is required');
      return;
    }
    const mapping: FieldMappingEntry[] = columns.map((column) => ({
      sourceColumn: column.sourceColumn,
      targetField: selections[column.sourceColumn] ?? MAPPING_IGNORE_TARGET,
    }));

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(mapping, savePreset ? presetName.trim() : undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply mapping');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="mx-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg bg-slate-800 p-6 shadow-2xl pointer-events-auto"
          onKeyDown={handleKeyDown}
        >
          <h2 className="mb-1 text-xl font-bold text-white">Adjust Field Mapping</h2>
          <p className="mb-4 text-sm text-slate-400">
            Match each column to a contact field. Ignored columns are kept as extra data.
            {suggestedPreset ? ` Suggested preset: ${suggestedPreset.name}.` : ''}
          </p>

          <div className="mb-4 space-y-3">
            {columns.map((column) => (
              <div
                key={column.sourceColumn}
                className="flex items-center gap-3 rounded-md bg-slate-900 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {column.sourceColumn || '(blank header)'}
                  </p>
                  {column.sampleValues.length > 0 && (
                    <p className="truncate text-xs text-slate-400">
                      {column.sampleValues.slice(0, 3).join(' · ')}
                    </p>
                  )}
                </div>
                <select
                  aria-label={`Map column ${column.sourceColumn}`}
                  className="w-56 rounded-md border border-slate-600 bg-slate-700 px-2 py-1 text-sm text-white"
                  value={selections[column.sourceColumn] ?? MAPPING_IGNORE_TARGET}
                  onChange={(e) =>
                    setSelections((prev) => ({
                      ...prev,
                      [column.sourceColumn]: e.target.value,
                    }))
                  }
                >
                  <option value={MAPPING_IGNORE_TARGET}>— Ignore —</option>
                  {targetFields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.labelEn} / {field.labelEs}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={savePreset}
                onChange={(e) => setSavePreset(e.target.checked)}
              />
              Save this mapping as preset
            </label>
            {savePreset && (
              <input
                type="text"
                className="mt-2 w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white"
                placeholder="Preset name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
            )}
          </div>

          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md px-4 py-2 text-sm text-slate-300 hover:text-white"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={() => void handleConfirm()}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Uploading...' : 'Apply mapping'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
