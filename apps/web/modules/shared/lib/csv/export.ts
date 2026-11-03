/** RFC 4180 cell encoding with spreadsheet formula neutralization. */
export function csvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  // Formula prefixes remain executable even inside quoted CSV cells. Leading
  // whitespace/control characters can also hide a formula from a visual review.
  const safe = /^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function csvDocument(rows: readonly (readonly unknown[])[]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
