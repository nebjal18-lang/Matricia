import approved from "./approved-ar.json";

const serviceNames = approved.services;
const categoryNames = approved.categories;

export function approvedServiceNameAr(code: string): string | null {
  const value = serviceNames[code as keyof typeof serviceNames];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function approvedCategoryNameAr(code: string): string | null {
  const value = categoryNames[code as keyof typeof categoryNames];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
