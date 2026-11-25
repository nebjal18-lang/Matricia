const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u;

function offsetMinutesAt(instant: number): number {
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Casablanca", timeZoneName: "longOffset" })
    .formatToParts(new Date(instant))
    .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):(\d{2})/u.exec(label);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const value = Math.abs(minutes);
  return `${sign}${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

/** Value for a datetime-local control, independent of the host timezone. */
export function casablancaIsoToLocal(value: string): string | null {
  const instant = Date.parse(value);
  if (!Number.isFinite(instant) || !/(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(instant);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

/** Converts a `datetime-local` value entered as Moroccan wall-clock time into an ISO timestamp with its offset. */
export function casablancaLocalToIso(value: string): string | null {
  const match = LOCAL_PATTERN.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number) as [number, number, number, number, number, number];
  if (hour > 23 || minute > 59) return null;
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  if (Number.isNaN(naive)) return null;
  const check = new Date(naive);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  // Check both sides of a timezone transition. Zero matches means a skipped
  // clock time; two matches means the input needs an explicit offset choice.
  const offsets = new Set([-36, 0, 36].map(hours => offsetMinutesAt(naive + hours * 3600000)));
  const candidates = [...offsets].map(offset => `${value.trim()}:00${formatOffset(offset)}`)
    .filter(candidate => casablancaIsoToLocal(candidate) === value.trim());
  return candidates.length === 1 ? candidates[0] ?? null : null;
}
