/**
 * Derive a human-readable template name from an import file name.
 * Strips common template extensions and unsafe path characters.
 */
export function stemFromImportFileName(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, '').trim();
  const withoutExt = base.replace(/\.(zip|json|ZIP|JSON)$/i, '').trim();
  const cleaned = withoutExt.replace(/[<>:"/\\|?*]/g, '_').trim();
  return cleaned.slice(0, 100) || 'Imported template';
}

/**
 * Pick a unique display name among existing saved templates.
 * "Card" → "Card (1)" → "Card (2)" when prior names are taken.
 */
export function resolveUniqueTemplateName(
  baseName: string,
  existingNames: string[]
): string {
  const base = baseName.trim().slice(0, 100) || 'Imported template';
  const lower = existingNames.map((n) => n.trim().toLowerCase());

  if (!lower.includes(base.toLowerCase())) {
    return base;
  }

  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const suffixRe = new RegExp(`^${escaped} \\((\\d+)\\)$`, 'i');
  let maxSuffix = 0;

  for (const name of existingNames) {
    const trimmed = name.trim();
    if (trimmed.toLowerCase() === base.toLowerCase()) {
      maxSuffix = Math.max(maxSuffix, 0);
      continue;
    }
    const match = trimmed.match(suffixRe);
    if (match) {
      maxSuffix = Math.max(maxSuffix, parseInt(match[1], 10));
    }
  }

  return `${base} (${maxSuffix + 1})`;
}
