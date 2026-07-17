import JSZip from 'jszip';
import {
  applyWorkPhonePrefix,
  findHeaderRowIndex,
  isUsefulDemoContactRow,
  mapRowToContactFields,
  matrixToTable,
  parseCsvText,
  parseDemoSpreadsheetFile,
} from './demoSpreadsheetParser';

describe('demoSpreadsheetParser', () => {
  describe('parseCsvText', () => {
    it('parses comma CSV with header', () => {
      const table = parseCsvText('fullName,email\nAda Lovelace,ada@example.com\n');
      expect(table.headers).toEqual(['fullName', 'email']);
      expect(table.rows).toEqual([['Ada Lovelace', 'ada@example.com']]);
    });

    it('parses semicolon CSV (locale Excel exports)', () => {
      const table = parseCsvText('nombre;correo\nAna;ana@ejemplo.com\n');
      expect(table.headers).toEqual(['nombre', 'correo']);
      expect(table.rows[0]).toEqual(['Ana', 'ana@ejemplo.com']);
    });

    it('skips title/section preamble before the real header row', () => {
      const table = parseCsvText(
        [
          'BASE DE DATOS COLABORADORES,,,,',
          'INFORMACION GENERAL,2,,,',
          'Nombre Completo,Correo Electrónico,Teléfono,,',
          'Sofia Rodriguez Oviedo,srodriguez@code-cr.com,555-0100,,',
          'Ada Lovelace,ada@example.com,555-0101,,',
        ].join('\n')
      );
      expect(table.headers[0]).toMatch(/Nombre Completo/i);
      expect(table.headers).toEqual(
        expect.arrayContaining([expect.stringMatching(/Correo/i)])
      );
      expect(findHeaderRowIndex([
        ['BASE DE DATOS COLABORADORES'],
        ['INFORMACION GENERAL', '2'],
        ['Nombre Completo', 'Correo Electrónico', 'Teléfono'],
        ['Sofia Rodriguez Oviedo', 'srodriguez@code-cr.com', '555-0100'],
      ])).toBe(2);

      const useful = table.rows.filter((cols) =>
        isUsefulDemoContactRow(table.headers, cols)
      );
      expect(useful).toHaveLength(2);
      expect(useful[0][0]).toBe('Sofia Rodriguez Oviedo');
    });

    it('parses key-value paste (label: value lines)', () => {
      const table = parseCsvText(
        [
          'nombre: Pilo Montaneno Pulmoclas',
          'puesto: Manager',
          'telefono: 12341234',
          'whatsapp: 12341234',
          'website: www.logicbison.com',
        ].join('\n')
      );
      expect(table.rows).toHaveLength(1);
      const fields = mapRowToContactFields(table.headers, table.rows[0]);
      expect(fields.fullName).toBe('Pilo Montaneno Pulmoclas');
      expect(fields.businessTitle).toBe('Manager');
      expect(fields.workPhone).toBe('12341234');
      expect(fields.mobilePhone).toBe('12341234');
      expect(fields.businessUrl).toBe('www.logicbison.com');
      expect(isUsefulDemoContactRow(table.headers, table.rows[0])).toBe(true);
    });

    it('parses tab-separated paste with Ext column holding full phone numbers', () => {
      const table = parseCsvText(
        'Nombre\tPuesto\tCorreo\tExt\nCamila Castro Cordero\tAsistente de Ingeniería\tccastro@code-cr.com\t2459-7578\n'
      );
      expect(table.rows).toHaveLength(1);
      const fields = mapRowToContactFields(table.headers, table.rows[0]);
      expect(fields.fullName).toBe('Camila Castro Cordero');
      expect(fields.email).toBe('ccastro@code-cr.com');
      expect(fields.workPhone).toBe('2459-7578');
    });

    it('merges multiple pasted table sections and skips repeated header rows', () => {
      const table = parseCsvText(
        [
          'Nombre\tPuesto\tCorreo\tNumero de teléfono',
          'Jimena Rojas Arias\tAuxiliar de compras\tjrojas@code-cr.com\t2459-6068',
          'Veronica Mora  Herrera\tAsistente de Contabilidad\tvmora@code-cr.com\t2459-6073',
          '',
          'Nombre\tPuesto\tCorreo\tExt',
          'Brandon Alvarez Quiros\tAuxiliar de Logistica y Compras\tbalavez@code-cr.com\t6088',
          'Luis Angel Arispe Córdoba\tSupervisor de Contabilidad\tlarispe@code-cr.com\t7582',
        ].join('\n')
      );
      expect(table.rows).toHaveLength(4);
      const brandon = mapRowToContactFields(table.headers, table.rows[2]);
      expect(brandon.fullName).toBe('Brandon Alvarez Quiros');
      expect(brandon.email).toBe('balavez@code-cr.com');
    });
  });

  describe('matrixToTable', () => {
    it('does not treat section titles as headers', () => {
      const table = matrixToTable([
        ['BASE DE DATOS COLABORADORES'],
        ['INFORMACION GENERAL', '2'],
        ['fullName', 'email'],
        ['Sofia Rodriguez Oviedo', 'srodriguez@code-cr.com'],
      ]);
      expect(table.headers).toEqual(['fullName', 'email']);
      expect(table.rows).toEqual([['Sofia Rodriguez Oviedo', 'srodriguez@code-cr.com']]);
    });
  });

  describe('mapRowToContactFields', () => {
    it('maps Spanish headers', () => {
      const fields = mapRowToContactFields(
        ['Nombre', 'Apellidos', 'Correo'],
        ['Ada', 'Lovelace', 'ada@example.com']
      );
      expect(fields.firstName).toBe('Ada');
      expect(fields.lastName).toBe('Lovelace');
      expect(fields.email).toBe('ada@example.com');
      expect(fields.fullName).toBe('Ada Lovelace');
    });

    it('recovers the name positionally when only OTHER headers are recognized', () => {
      // Regression: "Email"/"Puesto" being recognized used to disable ALL
      // positional fallback (all-or-nothing gate), so an unrecognized name
      // column like "Nombre y Apellido" left the contact with no name at
      // all even though the row clearly has one — cards rendered blank.
      const headers = ['Nombre y Apellido', 'Email', 'Puesto'];
      const fields = mapRowToContactFields(headers, [
        'Juan Perez',
        'juan@example.com',
        'Manager',
      ]);
      expect(fields.fullName).toBe('Juan Perez');
      expect(fields.email).toBe('juan@example.com');
      expect(fields.businessTitle).toBe('Manager');
    });

    it('does not resurrect positional fallback on rows with recognized name headers', () => {
      const headers = ['Nombre', 'Apellidos', 'Correo'];
      const fields = mapRowToContactFields(headers, ['Ada', 'Lovelace', 'ada@example.com']);
      // firstName/lastName came from headers — positional cols[0] must not
      // overwrite them with the raw first-name value as a "full name".
      expect(fields.fullName).toBe('Ada Lovelace');
    });

    describe('fuzzy header fallback (label mismatches)', () => {
      it('maps a header that only partially matches a known alias', () => {
        const headers = ['Nombre', 'Correo', 'Teléfono Oficina 2'];
        const fields = mapRowToContactFields(headers, [
          'Ada Lovelace',
          'ada@example.com',
          '2222-1111',
        ]);
        expect(fields.workPhone).toBe('2222-1111');
      });

      it('resolves a header via exact-token match even when not the whole string', () => {
        const headers = ['Nombre', 'Numero de Extension'];
        const fields = mapRowToContactFields(headers, ['Ada Lovelace', '105']);
        expect(fields.workPhoneExt).toBe('105');
      });

      it('does not guess on a genuinely ambiguous/compound header', () => {
        // "nombre" (firstName) and "apellido" (lastName) tokens both present —
        // must stay ambiguous so the existing positional-name fallback (not a
        // wrong guess) is what resolves it, same as before this feature.
        const headers = ['Nombre y Apellido', 'Correo'];
        const fields = mapRowToContactFields(headers, ['Juan Perez', 'juan@example.com']);
        expect(fields.fullName).toBe('Juan Perez');
      });

      it('does not overwrite a field already set by an exact header match', () => {
        const headers = ['Phone', 'Teléfono Oficina'];
        const fields = mapRowToContactFields(headers, ['2222-1111', '8888-9999']);
        expect(fields.workPhone).toBe('2222-1111');
      });

      it('never maps an unrelated short/unknown header', () => {
        const headers = ['Nombre', 'Fax'];
        const fields = mapRowToContactFields(headers, ['Ada Lovelace', '2222-3333']);
        expect(fields.workPhone).toBeUndefined();
        expect(fields.workPhoneExt).toBeUndefined();
      });
    });

    describe('phone/extension value reconciliation', () => {
      it('swaps a phone and extension that were entered under the wrong header', () => {
        const headers = ['Nombre', 'Teléfono', 'Ext'];
        const fields = mapRowToContactFields(headers, ['Ada Lovelace', '105', '22334455']);
        expect(fields.workPhone).toBe('22334455');
        expect(fields.workPhoneExt).toBe('105');
      });

      it('moves a short phone-column value into extension when extension is empty', () => {
        const headers = ['Nombre', 'Teléfono'];
        const fields = mapRowToContactFields(headers, ['Ada Lovelace', '105']);
        expect(fields.workPhone).toBeUndefined();
        expect(fields.workPhoneExt).toBe('105');
      });

      it('moves a long extension-column value into phone when phone is empty', () => {
        const headers = ['Nombre', 'Ext'];
        const fields = mapRowToContactFields(headers, ['Ada Lovelace', '22334455']);
        expect(fields.workPhone).toBe('22334455');
        expect(fields.workPhoneExt).toBeUndefined();
      });

      it('leaves ambiguous middle-length values (e.g. 6-digit local numbers) untouched', () => {
        const headers = ['Nombre', 'Teléfono'];
        const fields = mapRowToContactFields(headers, ['Ada Lovelace', '123456']);
        expect(fields.workPhone).toBe('123456');
        expect(fields.workPhoneExt).toBeUndefined();
      });

      it('never reclassifies an E.164-formatted phone number', () => {
        const headers = ['Nombre', 'Teléfono', 'Ext'];
        const fields = mapRowToContactFields(headers, ['Ada Lovelace', '+50622334455', '105']);
        expect(fields.workPhone).toBe('+50622334455');
        expect(fields.workPhoneExt).toBe('105');
      });

      it('applies Work Phone Prefix to 4-digit Ext values that are local numbers', () => {
        const headers = ['Nombre', 'Correo', 'Ext'];
        const fields = mapRowToContactFields(headers, ['Brandon Alvarez', 'b@example.com', '6088'], {
          workPhonePrefix: '2459',
        });
        expect(fields.workPhone).toBe('24596088');
        expect(fields.workPhoneExt).toBeUndefined();
      });
    });

    describe('applyWorkPhonePrefix', () => {
      it('prefixes a bare 4-digit work phone', () => {
        const fields = { workPhone: '6088' };
        applyWorkPhonePrefix(fields, '2459');
        expect(fields.workPhone).toBe('24596088');
      });
    });
  });

  describe('parseDemoSpreadsheetFile', () => {
    it('parses a minimal .xlsx via JSZip', async () => {
      const zip = new JSZip();
      zip.file(
        'xl/sharedStrings.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
         <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="6" uniqueCount="6">
           <si><t>fullName</t></si><si><t>email</t></si>
           <si><t>Ada Lovelace</t></si><si><t>ada@example.com</t></si>
           <si><t>Grace Hopper</t></si><si><t>grace@example.com</t></si>
         </sst>`
      );
      zip.file(
        'xl/worksheets/sheet1.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
         <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
           <sheetData>
             <row r="1">
               <c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c>
             </row>
             <row r="2">
               <c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c>
             </row>
             <row r="3">
               <c r="A3" t="s"><v>4</v></c><c r="B3" t="s"><v>5</v></c>
             </row>
           </sheetData>
         </worksheet>`
      );
      const blob = await zip.generateAsync({ type: 'uint8array' });
      const file = new File([blob], 'staff.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const table = await parseDemoSpreadsheetFile(file);
      expect(table.headers).toEqual(['fullName', 'email']);
      expect(table.rows).toEqual([
        ['Ada Lovelace', 'ada@example.com'],
        ['Grace Hopper', 'grace@example.com'],
      ]);
    });

    it('rejects legacy .xls with a clear error', async () => {
      const file = new File([new Uint8Array([0xd0, 0xcf])], 'legacy.xls', {
        type: 'application/vnd.ms-excel',
      });
      await expect(parseDemoSpreadsheetFile(file)).rejects.toThrow(/cannot parse legacy \.xls/i);
    });

    it('does not treat zip binary as CSV rows', async () => {
      const zip = new JSZip();
      zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData/></worksheet>');
      const blob = await zip.generateAsync({ type: 'uint8array' });
      // Misnamed .csv that is actually zip should use xlsx path (empty sheet → empty table)
      const file = new File([blob], 'bad.csv', { type: 'text/csv' });
      const table = await parseDemoSpreadsheetFile(file);
      expect(table.rows).toEqual([]);
    });

    it('does not lose a header cell that follows self-closing empty cells (real-world export shape)', async () => {
      // Regression: LibreOffice/Excel routinely emit self-closing cells for
      // empty-but-styled columns (`<c r="D4" s="2"/>`). The cell-matching
      // regex used to try the open/close alternative FIRST, so at a
      // self-closing cell it matched the trailing `/` as part of the
      // attributes, then its lazy `([\s\S]*?)<\/c>` scanned forward for the
      // NEXT `</c>` anywhere in the document — silently swallowing every
      // subsequent self-closing cell PLUS the next real cell's contents
      // (here, the "Nombre" header two rows down) as if they were "inside"
      // the empty cell, and skipping them entirely.
      const zip = new JSZip();
      zip.file(
        'xl/sharedStrings.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
         <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
           <si><t>Nombre</t></si><si><t>Correo</t></si>
           <si><t>Ada Lovelace</t></si><si><t>ada@example.com</t></si>
         </sst>`
      );
      zip.file(
        'xl/worksheets/sheet1.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
         <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
           <sheetData>
             <row r="4"><c r="D4" s="2"/><c r="E4" s="2"/><c r="F4" s="2"/></row>
             <row r="5"/>
             <row r="6">
               <c r="C6" t="s"><v>0</v></c><c r="D6" t="s"><v>1</v></c>
             </row>
             <row r="7">
               <c r="C7" t="s"><v>2</v></c><c r="D7" t="s"><v>3</v></c>
             </row>
           </sheetData>
         </worksheet>`
      );
      const blob = await zip.generateAsync({ type: 'uint8array' });
      const file = new File([blob], 'real.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const table = await parseDemoSpreadsheetFile(file);
      expect(table.headers).toEqual(['', '', 'Nombre', 'Correo', '', '']);
      expect(table.rows).toEqual([['', '', 'Ada Lovelace', 'ada@example.com', '', '']]);

      const fields = mapRowToContactFields(table.headers, table.rows[0]);
      expect(fields.fullName).toBe('Ada Lovelace');
      expect(fields.email).toBe('ada@example.com');
    });
  });
});
