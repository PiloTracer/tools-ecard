/**
 * Demo-mode mapping presets: localStorage, per-user namespaced (Pass 3).
 */

import { demoStore } from './demoStore';
import { resolveDemoStorageUserId } from './demoStorageUserId';
import {
  listDemoMappingPresets,
  saveDemoMappingPreset,
  deleteDemoMappingPreset,
  suggestDemoMappingPreset,
} from './demoMappingPresets';

const MAPPING = [
  { sourceColumn: 'Nombre', targetField: 'full_name' },
  { sourceColumn: 'Employee ID', targetField: 'ignore' },
];

describe('demoMappingPresets', () => {
  beforeEach(() => {
    localStorage.clear();
    demoStore.setActiveUserId(
      resolveDemoStorageUserId({ id: 'preset-user-a', email: 'a@example.com' })
    );
  });

  it('saves and lists presets for the active user', () => {
    const preset = saveDemoMappingPreset('HR export', MAPPING);
    expect(preset.id).toBeTruthy();
    expect(preset.signature).toMatch(/^[0-9a-f]{8}$/);

    const presets = listDemoMappingPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0]).toMatchObject({ name: 'HR export', mapping: MAPPING });
  });

  it('suggests a preset when the header signature matches (order/case-insensitive)', () => {
    saveDemoMappingPreset('HR export', MAPPING);
    const suggested = suggestDemoMappingPreset(['employee id', 'NOMBRE']);
    expect(suggested?.name).toBe('HR export');
  });

  it('returns null when no preset matches the headers', () => {
    saveDemoMappingPreset('HR export', MAPPING);
    expect(suggestDemoMappingPreset(['different', 'headers'])).toBeNull();
  });

  it('deletes presets by id', () => {
    const preset = saveDemoMappingPreset('HR export', MAPPING);
    deleteDemoMappingPreset(preset.id);
    expect(listDemoMappingPresets()).toHaveLength(0);
  });

  it('keeps presets isolated per user', () => {
    saveDemoMappingPreset('HR export', MAPPING);
    demoStore.setActiveUserId(
      resolveDemoStorageUserId({ id: 'preset-user-b', email: 'b@example.com' })
    );
    expect(listDemoMappingPresets()).toHaveLength(0);
    expect(suggestDemoMappingPreset(['Nombre', 'Employee ID'])).toBeNull();
  });
});
