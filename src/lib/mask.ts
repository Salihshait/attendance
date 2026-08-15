// Client-side masking helpers. The primary defense for PAN/Aadhaar/bank
// account number is server-side — get_my_statutory_details() and
// get_my_bank_details() (0026_eip_extras.sql) already mask before the value
// leaves Postgres, so the raw digits never reach the browser for a routine
// profile view. These helpers exist for display formatting of already-masked
// values, and as a client-side fallback for anything not yet routed through
// a masking RPC.

/** Masks everything but the trailing `visible` characters with 'X'. Mirrors the SQL overlay() used in get_my_statutory_details()/get_my_bank_details(). */
export function maskTail(value: string | null | undefined, visible = 4): string {
  if (!value) return '-';
  if (value.length <= visible) return value;
  return 'X'.repeat(value.length - visible) + value.slice(-visible);
}

/** Groups a 12-digit (possibly already-masked) Aadhaar number into "XXXX XXXX 1234" for readability. */
export function formatMaskedAadhaar(value: string | null | undefined): string {
  if (!value) return '-';
  const digits = value.replace(/\s/g, '');
  return digits.replace(/(.{4})/g, '$1 ').trim();
}
