/** Reject File values instead of coercing them to a misleading string. */
export function formText(form: Pick<FormData, "get">, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

export function isoDate(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}
