import JSZip from 'jszip';
import { TextDecoder as NodeTextDecoder } from 'util';
import operatorSamples from './fixtures/operator_batch_samples.json';

// This repo's jsdom predates a global TextDecoder; browsers always provide it.
(global as unknown as { TextDecoder?: unknown }).TextDecoder ??= NodeTextDecoder;

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

    it('parses usuario header alias and vertical stacked contacts', () => {
      const usuarioTable = parseCsvText(
        'usuario\tPuesto\tCorreo\text\nNatalia Sandi Flores\tAuxiliar de Tesorería\tnsandi@code-cr.com\t6064\n'
      );
      const usuarioFields = mapRowToContactFields(usuarioTable.headers, usuarioTable.rows[0]);
      expect(usuarioFields.fullName).toContain('Natalia');
      expect(usuarioFields.email).toBe('nsandi@code-cr.com');

      const vertical = parseCsvText(
        [
          'Damark Beale Nelson',
          'Ingeniero Aseguramiento Calidad',
          'dbeale@code-cr.com',
          '2459-7569',
          '8640-2373',
          '',
          'Gustavo Alpizar Hidalgo',
          'Gerente de Proyecto Electromecánico',
          'galpizar@code-cr.com',
          '2459-7569',
          '8865-2411',
        ].join('\n')
      );
      expect(vertical.rows.length).toBeGreaterThanOrEqual(2);
      const damark = mapRowToContactFields(vertical.headers, vertical.rows[0]);
      expect(damark.email).toBe('dbeale@code-cr.com');
      expect(damark.fullName).toContain('Damark');
    });

    it('reconstructs messy HTML table paste (one cell per line)', () => {
      const table = parseCsvText(
        [
          'Nombre',
          'Puesto',
          'Correo',
          'Ext',
          'Nombre: Pablo López Moreira',
          'Gerente de Operaciones y Facilidades',
          'plopez@code-cr.com',
          '24596057',
          '86729333',
        ].join('\n')
      );
      const useful = table.rows.filter((cols) => isUsefulDemoContactRow(table.headers, cols));
      expect(useful.length).toBeGreaterThanOrEqual(1);
      const fields = mapRowToContactFields(table.headers, useful[0]);
      expect(fields.email).toBe('plopez@code-cr.com');
      expect(fields.fullName).toContain('Pablo');
    });

    it('parses vertical paste with section title and blank lines between name/title', () => {
      const table = parseCsvText(
        [
          'Actualizaciones:',
          '',
          'Ingrid Amador',
          'Gerente de Contabilidad',
          '',
          'iamador@code-cr.com',
          '2435-6055',
          '',
          'Cristal Morales',
          'Asistente de Presupuestos',
          'cmorales@code-cr.com',
          '2435-6043',
          '6032-2923',
        ].join('\n')
      );
      const contacts = table.rows
        .filter((cols) => isUsefulDemoContactRow(table.headers, cols))
        .map((cols) => mapRowToContactFields(table.headers, cols));
      expect(contacts.some((c) => c.email === 'iamador@code-cr.com')).toBe(true);
      expect(contacts.some((c) => c.email === 'cmorales@code-cr.com')).toBe(true);
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

    it.each(operatorSamples as Array<{
      id: number;
      text: string;
      expectedCount: number;
      emails: string[];
      expectedNames: string[];
    }>)('parses operator feedback sample #$id (every record)', (sample) => {
      const table = parseCsvText(sample.text);
      const contacts = table.rows
        .filter((cols) => isUsefulDemoContactRow(table.headers, cols))
        .map((cols) => mapRowToContactFields(table.headers, cols));
      expect(contacts.length).toBe(sample.expectedCount);
      for (const email of sample.emails) {
        expect(contacts.some((c) => c.email === email)).toBe(true);
      }
      for (const name of sample.expectedNames) {
        expect(contacts.some((c) => c.fullName === name)).toBe(true);
      }
      if (sample.id === 1 || sample.id === 6) {
        const pablo = contacts.find((c) => c.email === 'plopez@code-cr.com');
        expect(pablo?.fullName).toBe('Pablo López Moreira');
      }
    });

    // The upload/paste flows both call parseDemoSpreadsheetFile: paste creates a
    // File named pasted-content.txt; file import passes the operator's .txt/.md.
    describe.each(['pasted-content.txt', 'sample.txt', 'sample.md'])(
      'parseDemoSpreadsheetFile via %s',
      (fileName) => {
        it.each(operatorSamples as Array<{
          id: number;
          text: string;
          expectedCount: number;
          emails: string[];
          expectedNames: string[];
        }>)('imports every record of sample #$id', async (sample) => {
          const file = new File([sample.text], fileName, { type: 'text/plain' });
          const table = await parseDemoSpreadsheetFile(file);
          const contacts = table.rows
            .filter((cols) => isUsefulDemoContactRow(table.headers, cols))
            .map((cols) => mapRowToContactFields(table.headers, cols));
          expect(contacts.length).toBe(sample.expectedCount);
          for (const email of sample.emails) {
            expect(contacts.some((c) => c.email === email)).toBe(true);
          }
          for (const name of sample.expectedNames) {
            expect(contacts.some((c) => c.fullName === name)).toBe(true);
          }
        });
      }
    );
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
    it('title-cases person names at ingest (lowercase source)', () => {
      const fields = mapRowToContactFields(
        ['Nombre', 'Email'],
        ['sofía rodríguez oviedo', 'sofia@example.com']
      );
      expect(fields.fullName).toBe('Sofía Rodríguez Oviedo');
      expect(fields.email).toBe('sofia@example.com');
    });

    it('does not title-case businessName (brand casing preserved)', () => {
      const fields = mapRowToContactFields(
        ['Empresa', 'Nombre'],
        ['acme LLC', 'Ada Lovelace']
      );
      expect(fields.businessName).toBe('acme LLC');
      expect(fields.fullName).toBe('Ada Lovelace');
    });
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

    describe('full vCard field coverage (all 30 fields)', () => {
      it('maps canonical snake_case vcard field names to camelCase demo fields', () => {
        const headers = [
          'full_name', 'first_name', 'last_name', 'work_phone', 'work_phone_ext',
          'mobile_phone', 'email', 'address_street', 'address_city', 'address_state',
          'address_postal', 'address_country', 'social_instagram', 'social_twitter',
          'social_facebook', 'business_name', 'business_title', 'business_department',
          'business_url', 'business_hours', 'business_address_street',
          'business_address_city', 'business_address_state', 'business_address_postal',
          'business_address_country', 'business_linkedin', 'business_twitter',
          'personal_url', 'personal_bio', 'personal_birthday',
        ];
        const cols = [
          'Ada Lovelace', 'Ada', 'Lovelace', '555-0100', '101', '555-0200',
          'ada@example.com', '12 Main St', 'San Jose', 'CA', '94107', 'USA',
          '@adalove', '@adalove_dev', 'adalove', 'Acme', 'Engineer', 'Engineering',
          'https://acme.com', 'Mon-Fri 9AM', '456 Business Ave', 'San Francisco',
          'CA', '94108', 'USA', 'linkedin.com/in/adalove', '@acme_tw',
          'https://ada.dev', 'Founder engineer', '1990-05-15',
        ];
        const fields = mapRowToContactFields(headers, cols);
        expect(fields.fullName).toBe('Ada Lovelace');
        expect(fields.email).toBe('ada@example.com');
        expect(fields.businessName).toBe('Acme');
        expect(fields.socialInstagram).toBe('@adalove');
        expect(fields.socialTwitter).toBe('@adalove_dev');
        expect(fields.socialFacebook).toBe('adalove');
        expect(fields.businessHours).toBe('Mon-Fri 9AM');
        expect(fields.businessAddressStreet).toBe('456 Business Ave');
        expect(fields.businessAddressCity).toBe('San Francisco');
        expect(fields.businessLinkedin).toBe('linkedin.com/in/adalove');
        expect(fields.businessTwitter).toBe('@acme_tw');
        expect(fields.personalUrl).toBe('https://ada.dev');
        expect(fields.personalBio).toBe('Founder engineer');
        expect(fields.personalBirthday).toBe('1990-05-15');
      });

      it('maps spaced/mixed-case headers the same as snake_case', () => {
        const headers = [
          'Business Address Street',
          'BUSINESS_HOURS',
          'Instagram',
          'Company Twitter',
          'Personal Website',
          'LinkedIn',
        ];
        const fields = mapRowToContactFields(headers, [
          '456 Business Ave', 'Mon-Fri 9AM', '@acme', '@acme_co',
          'https://acme.dev', 'in/acme',
        ]);
        expect(fields.businessAddressStreet).toBe('456 Business Ave');
        expect(fields.businessHours).toBe('Mon-Fri 9AM');
        expect(fields.socialInstagram).toBe('@acme');
        expect(fields.businessTwitter).toBe('@acme_co');
        expect(fields.personalUrl).toBe('https://acme.dev');
        expect(fields.businessLinkedin).toBe('in/acme');
      });

      it('is case/layout insensitive for core fields', () => {
        const fields = mapRowToContactFields(
          ['Nombre completo', 'Correo', 'WORK PHONE'],
          ['Ada Lovelace', 'ada@example.com', '2222-1111']
        );
        expect(fields.fullName).toBe('Ada Lovelace');
        expect(fields.workPhone).toBe('2222-1111');
      });
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
      const file = new File([new Uint8Array(blob)], 'staff.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const table = await parseDemoSpreadsheetFile(file);
      expect(table.headers).toEqual(['fullName', 'email']);
      expect(table.rows).toEqual([
        ['Ada Lovelace', 'ada@example.com'],
        ['Grace Hopper', 'grace@example.com'],
      ]);
    });

    it('decodes numeric XML entities in sharedStrings (accented names)', async () => {
      const zip = new JSZip();
      zip.file(
        'xl/sharedStrings.xml',
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
         <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="4" uniqueCount="4">
           <si><t>Nombre</t></si><si><t>Correo</t></si>
           <si><t>Pedro Elena L&#243;pez Ram&#237;rez</t></si><si><t>pedro@example.com</t></si>
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
           </sheetData>
         </worksheet>`
      );
      const blob = await zip.generateAsync({ type: 'uint8array' });
      const file = new File([new Uint8Array(blob)], 'accented.xlsx', {
        type: 'application/vnd.openxmlformats.officedocument.spreadsheetml.sheet',
      });

      const table = await parseDemoSpreadsheetFile(file);
      expect(table.rows[0][0]).toBe('Pedro Elena López Ramírez');
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
      const file = new File([new Uint8Array(blob)], 'bad.csv', { type: 'text/csv' });
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
      const file = new File([new Uint8Array(blob)], 'real.xlsx', {
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
