import { describe, expect, it } from 'vitest';
import { buildCsv, toMatrix, type ExportColumn } from './exportTable';

interface Row {
  name: string;
  note: string;
  count: number;
}

const columns: ExportColumn<Row>[] = [
  { header: 'Name', accessor: (r) => r.name },
  { header: 'Note', accessor: (r) => r.note },
  { header: 'Count', accessor: (r) => r.count },
];

describe('toMatrix', () => {
  it('maps columns to headers and rows to the accessor order', () => {
    const rows: Row[] = [{ name: 'A', note: 'ok', count: 3 }];
    const { headers, body } = toMatrix(columns, rows);
    expect(headers).toEqual(['Name', 'Note', 'Count']);
    expect(body).toEqual([['A', 'ok', 3]]);
  });
});

describe('buildCsv', () => {
  it('escapes commas, quotes, and newlines in cell values', () => {
    const rows: Row[] = [{ name: 'Doe, John', note: 'He said "hi"\nagain', count: 1 }];
    const csv = buildCsv(columns, rows);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Name,Note,Count');
    expect(csv).toContain('"Doe, John"');
    expect(csv).toContain('"He said ""hi""');
  });

  it('leaves plain values unquoted', () => {
    const rows: Row[] = [{ name: 'Jane', note: 'fine', count: 2 }];
    const csv = buildCsv(columns, rows);
    expect(csv).toBe('Name,Note,Count\nJane,fine,2');
  });
});
