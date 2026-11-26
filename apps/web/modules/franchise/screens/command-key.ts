export function requireCommandKey(value: string | undefined): string {
  if (!value) throw new Error("MISSING_COMMAND_KEY");
  return value;
}
