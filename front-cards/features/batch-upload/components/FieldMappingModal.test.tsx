/**
 * FieldMappingModal (Pass 3): preselection from auto-mapping/preset, ignore
 * option, save-as-preset checkbox, confirm payload.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldMappingModal } from './FieldMappingModal';
import type { CanonicalTargetField, ColumnMappingAnalysis } from '../types';

const TARGET_FIELDS: CanonicalTargetField[] = [
  { id: 'full_name', labelEn: 'Full name', labelEs: 'Nombre completo', category: 'core' },
  { id: 'email', labelEn: 'Email', labelEs: 'Correo electrónico', category: 'core' },
  { id: 'work_phone', labelEn: 'Work phone', labelEs: 'Teléfono trabajo', category: 'core' },
];

const COLUMNS: ColumnMappingAnalysis[] = [
  { sourceColumn: 'Correo', autoField: 'email', confidence: 'alias', sampleValues: ['ana@example.com'] },
  { sourceColumn: 'Employee ID', autoField: null, confidence: 'none', sampleValues: ['EMP-0042', 'EMP-0043'] },
];

function renderModal(overrides: Partial<Parameters<typeof FieldMappingModal>[0]> = {}) {
  const onConfirm = jest.fn().mockResolvedValue(undefined);
  const onClose = jest.fn();
  render(
    <FieldMappingModal
      isOpen
      columns={COLUMNS}
      targetFields={TARGET_FIELDS}
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />
  );
  return { onConfirm, onClose };
}

describe('FieldMappingModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <FieldMappingModal
        isOpen={false}
        columns={COLUMNS}
        targetFields={TARGET_FIELDS}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('preselects the auto-mapped field and defaults unmapped columns to Ignore', () => {
    renderModal();
    expect(screen.getByLabelText('Map column Correo')).toHaveValue('email');
    expect(screen.getByLabelText('Map column Employee ID')).toHaveValue('ignore');
    // Sample values shown (max 3)
    expect(screen.getByText('EMP-0042 · EMP-0043')).toBeInTheDocument();
  });

  it('lists canonical fields with EN/ES labels plus Ignore', () => {
    renderModal();
    const select = screen.getByLabelText('Map column Correo');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options[0]).toBe('— Ignore —');
    expect(options).toContain('Full name / Nombre completo');
    expect(options).toContain('Email / Correo electrónico');
  });

  it('preselects from the suggested preset before the auto-mapping', () => {
    renderModal({
      suggestedPreset: {
        id: 'p1',
        name: 'HR export',
        signature: 'sig',
        mapping: [
          { sourceColumn: 'Correo', targetField: 'work_phone' },
          { sourceColumn: 'Employee ID', targetField: 'ignore' },
        ],
      },
    });
    expect(screen.getByLabelText('Map column Correo')).toHaveValue('work_phone');
    expect(screen.getByText(/Suggested preset: HR export/)).toBeInTheDocument();
  });

  it('confirms the full explicit mapping including user changes', async () => {
    const { onConfirm } = renderModal();
    fireEvent.change(screen.getByLabelText('Map column Employee ID'), {
      target: { value: 'full_name' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply mapping' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm).toHaveBeenCalledWith(
      [
        { sourceColumn: 'Correo', targetField: 'email' },
        { sourceColumn: 'Employee ID', targetField: 'full_name' },
      ],
      undefined
    );
  });

  it('reveals the preset name field via the checkbox and requires it', async () => {
    const { onConfirm } = renderModal();
    expect(screen.queryByPlaceholderText('Preset name')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Save this mapping as preset' }));
    fireEvent.change(screen.getByPlaceholderText('Preset name'), { target: { value: 'HR export' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply mapping' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls[0][1]).toBe('HR export');
  });

  it('blocks confirm when the preset name is empty', async () => {
    const { onConfirm } = renderModal();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Save this mapping as preset' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply mapping' }));

    expect(await screen.findByText('Preset name is required')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
