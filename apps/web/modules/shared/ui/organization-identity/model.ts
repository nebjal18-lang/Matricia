export type OrganizationIdentityAddress = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
};

export type OrganizationIdentityRepresentative = {
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  power?: string | null;
};

export type OrganizationIdentityView = {
  legalName?: string | null;
  displayName?: string | null;
  countryCode?: string | null;
  legalForm?: string | null;
  incorporationDate?: string | null;
  activity?: string | null;
  sector?: string | null;
  registeredCity?: string | null;
  registeredAddress?: OrganizationIdentityAddress | null;
  identifiers?: {
    ICE?: string | null;
    IF?: string | null;
    RC?: string | null;
  } | null;
  representative?: OrganizationIdentityRepresentative | null;
};

export function displayIdentityValue(value: string | null | undefined, empty: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : empty;
}

export function formatIdentityAddress(
  address: OrganizationIdentityAddress | null | undefined,
  empty: string,
): string {
  if (!address) return empty;
  const parts = [address.line1, address.line2, address.postal_code, address.city]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : empty;
}
