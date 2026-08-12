import type { TemplateKind } from '../types';
import { resolveUniqueTemplateName } from './importTemplateNaming';

/**
 * Pass 4 save semantics: opening a template and hitting Save must fork a NEW
 * design (never overwrite the template); opening a design saves in place.
 * "Save as new template" always creates a NEW template item.
 */

export interface SaveIntentInput {
  /** Name requested by the caller (modal input or current name on quick-save). */
  requestedName: string;
  /** Explicit "Save as new template" choice from the save modal. */
  saveAsTemplate: boolean;
  /** Set when the open document was opened from a template (fork source). */
  openedFromTemplate: { id: string; name: string } | null;
  /** Names of all existing saved items (for `(n)` dedup). */
  existingNames: string[];
}

export interface SaveIntent {
  /** Final name to persist (deduped when forking / saving as new template). */
  name: string;
  kind: TemplateKind;
  /** True when the save creates a new item instead of updating in place. */
  fork: boolean;
}

export function resolveSaveIntent(input: SaveIntentInput): SaveIntent {
  const { requestedName, saveAsTemplate, openedFromTemplate, existingNames } = input;

  // Explicit "Save as new template": always a new item, never an in-place
  // conversion/overwrite of the source.
  if (saveAsTemplate) {
    return {
      name: resolveUniqueTemplateName(requestedName, existingNames),
      kind: 'template',
      fork: true,
    };
  }

  // Opened from a template: fork a new design. The untouched default name is
  // the source template's own name (quick-save) — suggest "<name> copy".
  if (openedFromTemplate) {
    const baseName =
      requestedName === openedFromTemplate.name
        ? `${openedFromTemplate.name} copy`
        : requestedName;
    return {
      name: resolveUniqueTemplateName(baseName, existingNames),
      kind: 'design',
      fork: true,
    };
  }

  // Design (or brand-new document): save in place, current behavior.
  return { name: requestedName, kind: 'design', fork: false };
}
