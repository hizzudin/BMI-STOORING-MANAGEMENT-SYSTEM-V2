import ExcelJS from 'exceljs';
import type { SpreadsheetWriter } from '../../ports/audit-log.js';

/** DEC-131: the one spreadsheet library, behind SpreadsheetWriter; every cell is written as text. */
export class ExcelJsSpreadsheetWriter implements SpreadsheetWriter {
  async xlsx(
    sheet: string,
    header: readonly string[],
    rows: readonly (readonly string[])[],
  ): Promise<Uint8Array> {
    const book = new ExcelJS.Workbook();
    const page = book.addWorksheet(sheet);
    page.addRow([...header]).font = { bold: true };
    for (const row of rows) page.addRow([...row]);
    page.columns.forEach((column) => {
      column.width = 20;
    });
    return new Uint8Array(await book.xlsx.writeBuffer());
  }
}
