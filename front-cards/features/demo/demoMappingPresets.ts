/**
 * Demo-mode field-mapping presets (Pass 3) — localStorage, namespaced per user
 * like every other demo store. Normal mode uses the API presets instead.
 */

import { demoStore, newDemoId } from './demoStore';
import { computeMappingSignature } from '../batch-upload/utils/mappingSignature';
import type { FieldMappingEntry, FieldMappingPreset } from '@/features/batch-upload/types';

export function listDemoMappingPresets(): FieldMappingPreset[] {
  return demoStore.getMappingPresets<FieldMappingPreset>();
}

export function saveDemoMappingPreset(
  name: string,
  mapping: FieldMappingEntry[]
): FieldMappingPreset {
  const preset: FieldMappingPreset = {
    id: newDemoId('preset'),
    name: name.trim(),
    signature: computeMappingSignature(mapping.map((m) => m.sourceColumn)),
    mapping,
  };
  const presets = listDemoMappingPresets();
  presets.unshift(preset);
  demoStore.setMappingPresets(presets);
  return preset;
}

export function deleteDemoMappingPreset(id: string): void {
  demoStore.setMappingPresets(listDemoMappingPresets().filter((p) => p.id !== id));
}

/** Auto-suggest: most recently saved preset whose header signature matches. */
export function suggestDemoMappingPreset(headers: string[]): FieldMappingPreset | null {
  const signature = computeMappingSignature(headers);
  return listDemoMappingPresets().find((p) => p.signature === signature) ?? null;
}
