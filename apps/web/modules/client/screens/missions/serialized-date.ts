/** Render the server label unchanged; legacy snapshots have an unambiguous UTC fallback. */
export function serializedDateLabel(value: string, serverLabel?: string) {
  if (serverLabel) return serverLabel;
  const normalized = /T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/u.test(value) ? `${value}Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "—" : `${date.toISOString().slice(0,16).replace("T"," ")} UTC`;
}
