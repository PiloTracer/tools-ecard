/**
 * Canonical 30-field target list for the mapping modal (Pass 3), loaded from the
 * duplicated snapshot fixture (the dev container mounts only front-cards/, so the
 * shared-types copy is unreachable at runtime — see vcardFieldsParity.test.ts).
 */

import snapshot from '@/features/demo/fixtures/vcard-fields.snapshot.json';
import type { CanonicalTargetField } from '../types';

export function getCanonicalTargetFields(): CanonicalTargetField[] {
  return snapshot as CanonicalTargetField[];
}
