import type { AllocationTarget } from "./allocation-targets";
import { z } from "zod";

export const uuid = z.string().uuid();
export const locale = z.enum(["fr", "ar"]);
export const code = z.string().trim().min(2).max(40).regex(/^[A-Z][A-Z0-9_-]+$/u);
export const minorAmount = z.string().trim().regex(/^\d+$/u);
export const sha256 = z.string().regex(/^[0-9a-f]{64}$/u);
export type Capability = "READ" | "MANAGE_PORTFOLIO" | "MANAGE_BUDGET";
export type Organization = { id: string; name: string; capabilities: Capability[] };
export type Site = { id: string; organizationId: string; code: string; nameFr: string; nameAr: string };
export type Project = { id: string; organizationId: string; code: string; siteId: string | null; status: string; version: number; rowVersion: number; progressBasisPoints: number; nameFr: string; nameAr: string; descriptionFr: string; descriptionAr: string; startedOn: string | null; targetEndOn: string | null };
export type Contract = { id: string; organizationId: string; providerOrganizationId: string; projectId: string | null; status: string; version: number };
export type Task = { id: string; projectId: string; key: string; type: string; status: string; dueAt: string | null; rowVersion: number; titleFr: string; titleAr: string };
export type Budget = { id: string; organizationId: string; fiscalYear: number; currency: string; libraryId: string | null; siteId: string | null; projectId: string | null; status: string; version: number; amountMinor: string; approvedAmountMinor: string | null };
export type CostCenter = { id: string; organizationId: string; code: string; status: string; version: number; nameFr: string; nameAr: string };
export type Allocation = { id: string; organizationId: string; costCenterId: string; budgetId: string; projectId: string | null; type: string; amountMinor: string; currency: string; createdAt: string };
export type CalendarItem = { organizationId: string; projectId: string | null; itemId: string; sourceKind: string; eventType: string; titleFr: string; titleAr: string; startsAt: string; endsAt: string | null; status: string; occursOn: string | null; allDay: boolean };
export type Library = { id: string; nameFr: string; nameAr: string };
export type Portfolio = { allocationTargets?: AllocationTarget[]; allocationTargetsStatus?: "success" | "partial" | "unavailable"; allocationTargetsTruncated?: boolean; allocationInvoiceError?: "FORBIDDEN" | "UNAVAILABLE" | "INVALID_RESPONSE"; organizations: Organization[]; sites: Site[]; projects: Project[]; contracts: Contract[]; tasks: Task[]; budgets: Budget[]; costCenters: CostCenter[]; allocations: Allocation[]; calendar: CalendarItem[]; libraries: Library[] };

export function displayCalendarDate(item: CalendarItem, localeValue: "fr" | "ar"): string {
  if (item.allDay && item.occursOn) {
    const [year, month, day] = item.occursOn.split("-").map(Number);
    if (year && month && day) return new Intl.DateTimeFormat(localeValue === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
  }
  return new Intl.DateTimeFormat(localeValue === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" }).format(new Date(item.startsAt));
}

export type RepoResult<T> = { status: "success"; value: T } | { status: "error"; reason: "UNAUTHENTICATED" | "FORBIDDEN" | "UNAVAILABLE" };

export function exactMoney(minor: string, currency: string) {
  const raw = BigInt(minor);
  const negative = raw < BigInt(0);
  const value = negative ? -raw : raw;
  const whole = value / BigInt(100);
  const fraction = (value % BigInt(100)).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction} ${currency}`;
}

export const BUDGET_WATCH_BASIS_POINTS = 8_000;
export const BUDGET_OVER_BASIS_POINTS = 10_000;
export type BudgetAlertLevel = "ok" | "watch" | "over" | "exceeded";

export function netAllocatedMinor(allocations: Allocation[], budgetId: string): bigint {
  return allocations
    .filter((item) => item.budgetId === budgetId)
    .reduce((sum, item) => sum + (item.type === "RELEASE" ? -BigInt(item.amountMinor) : BigInt(item.amountMinor)), BigInt(0));
}

export function budgetConsumption(netMinor: bigint, approvedMinor: bigint): {
  usedBasisPoints: number;
  remainingMinor: string;
  level: BudgetAlertLevel;
} {
  const remainingMinor = (approvedMinor - netMinor).toString();
  if (approvedMinor <= BigInt(0)) {
    return { usedBasisPoints: netMinor > BigInt(0) ? 10_001 : 0, remainingMinor, level: netMinor > BigInt(0) ? "exceeded" : "ok" };
  }
  const used = (netMinor * BigInt(10_000)) / approvedMinor;
  const usedBasisPoints = used > BigInt(1_000_000) ? 1_000_000 : Number(used);
  const level: BudgetAlertLevel = netMinor > approvedMinor
    ? "exceeded"
    : netMinor === approvedMinor || used >= BigInt(BUDGET_OVER_BASIS_POINTS)
      ? "over"
      : used >= BigInt(BUDGET_WATCH_BASIS_POINTS)
        ? "watch"
        : "ok";
  return { usedBasisPoints, remainingMinor, level };
}

export function formatProgressBasisPoints(basisPoints: number, locale: "fr" | "ar"): string {
  const whole = Math.trunc(Math.max(0, basisPoints) / 100);
  return locale === "ar" ? `${whole}٪` : `${whole} %`;
}

export function progressBarPercent(basisPoints: number): number {
  return Math.min(100, Math.max(0, Math.trunc(basisPoints / 100)));
}

export function moneyToMinor(value: string): string | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/u.exec(value.trim());
  if (!match) return null;
  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(2, "0");
  return (BigInt(whole) * BigInt(100) + BigInt(fraction || "0")).toString();
}
