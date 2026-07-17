import {
  resolveUniqueTemplateName,
  stemFromImportFileName,
} from '@/features/template-textile/utils/importTemplateNaming';

const BATCH_EXTENSIONS = /\.(csv|txt|vcf|xls|xlsx)$/i;

/** Default label when batch content is pasted from the clipboard (no real file name). */
export const PASTED_BATCH_DEFAULT_STEM = 'Pasted batch';

/**
 * Derive a human-readable batch label from a file name.
 * Strips batch extensions and unsafe path characters.
 */
export function stemFromBatchFileName(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, '').trim();
  const withoutExt = base.replace(BATCH_EXTENSIONS, '').trim();
  const cleaned = withoutExt.replace(/[<>:"/\\|?*]/g, '_').trim();
  if (cleaned.toLowerCase() === 'pasted-content') {
    return PASTED_BATCH_DEFAULT_STEM;
  }
  return cleaned.slice(0, 100) || PASTED_BATCH_DEFAULT_STEM;
}

/** File extension from a batch file name, including the dot (defaults to `.txt`). */
export function batchFileExtension(fileName: string): string {
  const match = fileName.match(/(\.[a-z0-9]+)$/i);
  if (match && BATCH_EXTENSIONS.test(match[1])) {
    return match[1].toLowerCase();
  }
  return '.txt';
}

/**
 * Pick a unique batch display name among existing batches.
 * Returns the full file name including extension.
 */
export function resolveUniqueBatchFileName(
  stem: string,
  extension: string,
  existingFileNames: string[]
): string {
  const existingStems = existingFileNames.map((n) => stemFromBatchFileName(n));
  const uniqueStem = resolveUniqueTemplateName(stem, existingStems);
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return `${uniqueStem}${ext}`;
}

/**
 * Suggested batch file name from an upload/paste source file.
 */
export function suggestBatchFileName(
  sourceFile: File,
  existingFileNames: string[]
): string {
  const stem = stemFromBatchFileName(sourceFile.name);
  const ext = batchFileExtension(sourceFile.name);
  return resolveUniqueBatchFileName(stem, ext, existingFileNames);
}

/** Build a new File with a user-chosen display name while preserving content and type. */
export function fileWithDisplayName(file: File, displayFileName: string): File {
  const safeName = displayFileName.trim().replace(/[<>:"/\\|?*]/g, '_').slice(0, 120);
  if (!safeName) {
    throw new Error('Batch name is required');
  }
  return new File([file], safeName, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

/** Re-export for convenience when import naming applies to pasted template files. */
export { stemFromImportFileName };
