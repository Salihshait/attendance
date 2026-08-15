// Small, controlled-format CSV parsing for Holiday import — no library
// installed for this (xlsx/jspdf are the only doc-format deps, and this
// format is simple/self-controlled), so a minimal manual parser is enough.

export interface ParsedHolidayRow {
  date: string;
  name: string;
  holidayType: 'public' | 'restricted' | 'optional';
  locationId: string | null;
}

export interface CsvParseError {
  line: number;
  message: string;
}

export interface CsvParseResult {
  valid: ParsedHolidayRow[];
  errors: CsvParseError[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HOLIDAY_TYPES = ['public', 'restricted', 'optional'];
const EXPECTED_HEADER = ['date', 'name', 'type', 'location'];

/** Splits one CSV line into fields, honoring double-quoted fields that may contain commas. */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function isValidCalendarDate(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * Parses a `date,name,type,location` CSV (header required; `location` may be
 * blank for an org-wide holiday). `locationsByName` maps a location's
 * display name (lowercased) to its id, used to resolve the `location`
 * column — unknown names are reported as row errors rather than silently
 * dropped or treated as org-wide.
 */
export function parseHolidayCsv(text: string, locationsByName: Map<string, string>): CsvParseResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const nonEmptyLines = lines.filter((l) => l.length > 0);

  if (nonEmptyLines.length === 0) {
    return { valid: [], errors: [{ line: 0, message: 'File is empty.' }] };
  }

  const header = splitCsvLine(nonEmptyLines[0]).map((h) => h.toLowerCase());
  const hasExpectedHeader = EXPECTED_HEADER.slice(0, 3).every((col, i) => header[i] === col);
  if (!hasExpectedHeader) {
    return { valid: [], errors: [{ line: 1, message: `Header must be "date,name,type,location" (got "${nonEmptyLines[0]}").` }] };
  }

  const valid: ParsedHolidayRow[] = [];
  const errors: CsvParseError[] = [];
  const seenKeys = new Set<string>();

  for (let i = 1; i < nonEmptyLines.length; i++) {
    const lineNumber = i + 1;
    const fields = splitCsvLine(nonEmptyLines[i]);
    const [date, name, type, locationName] = fields;

    if (!date || !DATE_RE.test(date) || !isValidCalendarDate(date)) {
      errors.push({ line: lineNumber, message: `Invalid date "${date ?? ''}" — expected YYYY-MM-DD.` });
      continue;
    }
    if (!name) {
      errors.push({ line: lineNumber, message: 'Name is required.' });
      continue;
    }
    const normalizedType = (type || '').toLowerCase();
    if (!HOLIDAY_TYPES.includes(normalizedType)) {
      errors.push({ line: lineNumber, message: `Invalid type "${type ?? ''}" — expected public, restricted, or optional.` });
      continue;
    }

    let locationId: string | null = null;
    if (locationName) {
      const resolved = locationsByName.get(locationName.toLowerCase());
      if (!resolved) {
        errors.push({ line: lineNumber, message: `Unknown location "${locationName}".` });
        continue;
      }
      locationId = resolved;
    }

    const dedupeKey = `${date}|${locationId ?? 'org-wide'}`;
    if (seenKeys.has(dedupeKey)) {
      errors.push({ line: lineNumber, message: `Duplicate holiday date "${date}" for this location within the file.` });
      continue;
    }
    seenKeys.add(dedupeKey);

    valid.push({ date, name, holidayType: normalizedType as ParsedHolidayRow['holidayType'], locationId });
  }

  return { valid, errors };
}
