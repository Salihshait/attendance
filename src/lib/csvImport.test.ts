import { describe, expect, it } from 'vitest';
import { parseHolidayCsv, splitCsvLine } from './csvImport';

const LOCATIONS = new Map([
  ['chennai', 'loc-chennai'],
  ['bengaluru', 'loc-bengaluru'],
]);

describe('splitCsvLine', () => {
  it('splits plain comma-separated fields', () => {
    expect(splitCsvLine('2026-01-26,Republic Day,public,')).toEqual(['2026-01-26', 'Republic Day', 'public', '']);
  });

  it('honors quoted fields containing commas', () => {
    expect(splitCsvLine('2026-03-14,"Holi, Festival of Colors",optional,Chennai')).toEqual([
      '2026-03-14',
      'Holi, Festival of Colors',
      'optional',
      'Chennai',
    ]);
  });
});

describe('parseHolidayCsv', () => {
  it('parses a well-formed file with mixed org-wide and location-specific rows', () => {
    const csv = ['date,name,type,location', '2026-01-26,Republic Day,public,', '2026-04-14,Tamil New Year,restricted,Chennai'].join('\n');
    const result = parseHolidayCsv(csv, LOCATIONS);
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual([
      { date: '2026-01-26', name: 'Republic Day', holidayType: 'public', locationId: null },
      { date: '2026-04-14', name: 'Tamil New Year', holidayType: 'restricted', locationId: 'loc-chennai' },
    ]);
  });

  it('reports a missing/incorrect header', () => {
    const result = parseHolidayCsv('foo,bar\n2026-01-01,X,public,', LOCATIONS);
    expect(result.valid).toEqual([]);
    expect(result.errors[0].message).toMatch(/Header must be/);
  });

  it('reports an invalid date', () => {
    const csv = ['date,name,type,location', '26-01-2026,Bad Date,public,'].join('\n');
    const result = parseHolidayCsv(csv, LOCATIONS);
    expect(result.valid).toEqual([]);
    expect(result.errors[0].message).toMatch(/Invalid date/);
  });

  it('reports an out-of-range calendar date', () => {
    const csv = ['date,name,type,location', '2026-02-30,Feb 30,public,'].join('\n');
    const result = parseHolidayCsv(csv, LOCATIONS);
    expect(result.errors[0].message).toMatch(/Invalid date/);
  });

  it('reports an invalid holiday type', () => {
    const csv = ['date,name,type,location', '2026-01-01,New Year,festive,'].join('\n');
    const result = parseHolidayCsv(csv, LOCATIONS);
    expect(result.errors[0].message).toMatch(/Invalid type/);
  });

  it('reports an unknown location', () => {
    const csv = ['date,name,type,location', '2026-01-01,New Year,public,Atlantis'].join('\n');
    const result = parseHolidayCsv(csv, LOCATIONS);
    expect(result.errors[0].message).toMatch(/Unknown location/);
  });

  it('reports a duplicate date within the file for the same location scope', () => {
    const csv = ['date,name,type,location', '2026-01-01,New Year,public,', '2026-01-01,Duplicate,public,'].join('\n');
    const result = parseHolidayCsv(csv, LOCATIONS);
    expect(result.valid).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/Duplicate holiday date/);
  });

  it('allows the same date at two different locations (not a duplicate)', () => {
    const csv = ['date,name,type,location', '2026-01-01,New Year Chennai,public,Chennai', '2026-01-01,New Year Bengaluru,public,Bengaluru'].join(
      '\n',
    );
    const result = parseHolidayCsv(csv, LOCATIONS);
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it('handles an empty file', () => {
    const result = parseHolidayCsv('', LOCATIONS);
    expect(result.errors[0].message).toMatch(/empty/);
  });

  it('ignores trailing blank lines', () => {
    const csv = ['date,name,type,location', '2026-01-01,New Year,public,', '', ''].join('\n');
    const result = parseHolidayCsv(csv, LOCATIONS);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });
});
