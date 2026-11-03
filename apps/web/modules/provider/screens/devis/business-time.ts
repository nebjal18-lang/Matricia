const zone = "Africa/Casablanca";
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
function wall(instant: Date): string {
  const values = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
}
/** Interpret a browser datetime-local in Morocco, independently of the server TZ. */
export function businessLocalToInstant(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) throw new Error("INVALID_BUSINESS_LOCAL_TIME");
  const target = value.length === 16 ? value + ":00" : value;
  const naive = Date.parse(target + "Z");
  if (!Number.isFinite(naive)) throw new Error("INVALID_BUSINESS_LOCAL_TIME");
  // Morocco has changed offsets historically and suspends DST for Ramadan.
  // Enumerate legal minute offsets rather than assuming a fixed UTC+1.
  const candidates: number[] = [];
  for (let offset = -180; offset <= 180; offset += 15) {
    const candidate = naive - offset * 60_000;
    if (wall(new Date(candidate)) === target) candidates.push(candidate);
  }
  if (candidates.length !== 1) throw new Error("AMBIGUOUS_OR_NONEXISTENT_BUSINESS_LOCAL_TIME");
  return new Date(candidates[0]!).toISOString();
}
export function instantToBusinessLocal(value: string): string {
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new Error("INVALID_INSTANT");
  return wall(instant).slice(0, 16);
}
