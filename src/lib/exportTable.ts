import { utils, writeFile } from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

/** Shared "build the matrix" step every export format renders from. */
export function toMatrix<T>(columns: ExportColumn<T>[], rows: T[]): { headers: string[]; body: (string | number)[][] } {
  return {
    headers: columns.map((c) => c.header),
    body: rows.map((row) => columns.map((c) => c.accessor(row))),
  };
}

function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function buildCsv<T>(columns: ExportColumn<T>[], rows: T[]): string {
  const { headers, body } = toMatrix(columns, rows);
  const lines = [headers, ...body].map((line) => line.map(csvEscape).join(','));
  return lines.join('\n');
}

export function exportToCsv<T>(columns: ExportColumn<T>[], rows: T[], filename: string): void {
  const blob = new Blob([buildCsv(columns, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToExcel<T>(columns: ExportColumn<T>[], rows: T[], filename: string): void {
  const { headers, body } = toMatrix(columns, rows);
  const sheet = utils.aoa_to_sheet([headers, ...body]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, 'Report');
  writeFile(workbook, filename);
}

export function exportToPdf<T>(columns: ExportColumn<T>[], rows: T[], filename: string, title?: string): void {
  const { headers, body } = toMatrix(columns, rows);
  const doc = new jsPDF();
  if (title) doc.text(title, 14, 12);
  autoTable(doc, { head: [headers], body, startY: title ? 18 : 10, styles: { fontSize: 8 } });
  doc.save(filename);
}
