import {formatExactMoney} from "@/modules/shared/lib/contracts-missions/model";
import { z } from "zod";

export const subscriptionCommandSchema = z.object({
  locale: z.enum(["fr", "ar"]),
  organizationId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

export const planChangeSchema = subscriptionCommandSchema.extend({
  subscriptionId: z.string().uuid(),
  targetPlanVersionId: z.string().uuid(),
  changeMode: z.enum(["UPGRADE_IMMEDIATE", "DOWNGRADE_NEXT_CYCLE"]),
});

export type SubscriptionPlan = {
  id: string;
  code: "PREMIUM" | "GOLD" | "PLATINUM";
  version: number;
  currency: string;
  monthlyPriceMinor: string;
  annualPriceMinor: string;
  monthlyCreditGrant: string;
  validFrom: string;
  validTo: string | null;
};

export type HistoricalSubscriptionPlan = SubscriptionPlan & {
  status: "ACTIVE" | "RETIRED";
  coreAllocationBasisPoints: number;
  benefitPoolAllocationBasisPoints: number;
  limitsSnapshot: Record<string, unknown>;
  boxVersionReference: string | null;
  contentHash: string;
  entitlements: Array<{
    code: string;
    enabled: boolean;
    quotaValue: string | null;
    configuration: Record<string, unknown>;
  }>;
};

export type SubscriptionSummary = {
  id: string;
  status: string;
  planVersionId: string | null;
  pendingPlanVersionId: string | null;
  billingInterval: string | null;
  currentPeriodEnd: string | null;
  pendingChangeEffectiveAt: string | null;
  rowVersion: string;
  currentPlan: HistoricalSubscriptionPlan | null;
  pendingPlan: HistoricalSubscriptionPlan | null;
  cycles: Array<{
    id: string;
    cycleNumber: number;
    currency: string;
    amountMinor: string;
    periodStart: string;
    periodEnd: string;
    paymentReference: string | null;
    plan: HistoricalSubscriptionPlan;
  }>;
  transitions: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reasonCode: string;
    occurredAt: string;
  }>;
};

export type SubscriptionDashboard = {
  organizationId: string;
  organizationName: string;
  plans: SubscriptionPlan[];
  subscription: SubscriptionSummary | null;
  capabilities: { canStartTrial: boolean; canChangePlan: boolean; canCheckout?: boolean };
};

export function formatMinor(value: string, currency: string, locale: "fr" | "ar") {
  return formatExactMoney(value,currency,locale);
}

export function planChangeMode(currentMonthlyMinor: string, targetMonthlyMinor: string): "UPGRADE_IMMEDIATE" | "DOWNGRADE_NEXT_CYCLE" {
  return BigInt(targetMonthlyMinor) > BigInt(currentMonthlyMinor) ? "UPGRADE_IMMEDIATE" : "DOWNGRADE_NEXT_CYCLE";
}

/** The server supplies now; render paths never infer an unpaid upgrade right. */
export function subscriptionCheckoutAvailable(status: string, periodEnd: string | null, now: number): boolean {
  if (["TRIAL_ACTIVE", "TRIAL_EXPIRED", "PAST_DUE", "SUSPENDED"].includes(status)) return true;
  if (!["ACTIVE", "CANCELLED"].includes(status) || !periodEnd || !Number.isFinite(now)) return false;
  const end = Date.parse(periodEnd);
  return Number.isFinite(end) && end <= now;
}
