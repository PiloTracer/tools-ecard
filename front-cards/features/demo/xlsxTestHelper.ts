/**
 * Test-only helper: build a minimal .xlsx File (via JSZip) from a cell matrix.
 * Imported by the demo parser test files; jest only runs *.test.ts(x) files.
 */
import JSZip from 'jszip';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function colLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Empty cells are emitted as self-closing styled cells (`<c r="D4" s="2"/>`) —
 * the 2026-07-16 regression shape produced by real LibreOffice/Excel exports.
 */
export async function buildXlsxFile(matrix: string[][], name = 'test.xlsx'): Promise<File> {
  const shared: string[] = [];
  const sharedIndex = new Map<string, number>();

  const rowsXml = matrix
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const ref = `${colLetter(c)}${r + 1}`;
          if (!value) return `<c r="${ref}" s="2"/>`;
          let idx = sharedIndex.get(value);
          if (idx === undefined) {
            idx = shared.length;
            shared.push(value);
            sharedIndex.set(value, idx);
          }
          return `<c r="${ref}" t="s"><v>${idx}</v></c>`;
        })
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('\n');

  const zip = new JSZip();
  zip.file(
    'xl/sharedStrings.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared
       .map((s) => `<si><t>${escapeXml(s)}</t></si>`)
       .join('')}</sst>`
  );
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
     <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
       <sheetData>
         ${rowsXml}
       </sheetData>
     </worksheet>`
  );
  const blob = await zip.generateAsync({ type: 'uint8array' });
  return new File([new Uint8Array(blob)], name, { type: XLSX_MIME });
}
