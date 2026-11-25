import { z } from "zod";

const id = z.string().uuid();
const minor = z.string().regex(/^-?\d+$/u);
const timestamp = z.string().min(10);

export const adminBoxesDashboardSchema = z.object({
  generated_at: timestamp,
  capabilities: z.object({ can_write: z.boolean(), can_activate: z.boolean() }),
  benefits: z.array(z.object({
    id, benefit_id: id, code: z.string(), version: z.number().int().positive(), status: z.string(),
    benefit_type: z.string(), fulfillment_mode: z.string(), name_fr: z.string(), name_ar: z.string(),
    credit_cost: minor, reference_value_minor: minor, internal_cost_minor: minor, currency: z.string().length(3),
    effective_from: timestamp,
  })),
  boxes: z.array(z.object({
    id, box_id: id, code: z.string(), version: z.number().int().positive(), status: z.string(),
    box_type: z.string(), name_fr: z.string(), name_ar: z.string(), credit_budget: minor,
    cost_low_minor: minor, cost_expected_minor: minor, cost_full_minor: minor, currency: z.string().length(3),
    approval_reference: z.string().nullable(), effective_from: timestamp, needs_approval: z.boolean(),
    slots: z.array(z.object({
      id, slot_code: z.string(), slot_kind: z.string(),
      minimum_selections: z.number().int().nonnegative(), maximum_selections: z.number().int().nonnegative(),
    })),
  })),
  plan_matrix: z.array(z.object({
    id, plan_code: z.string(), plan_version: z.number().int().positive(), box_code: z.string(),
    box_version: z.number().int().positive(), status: z.string(), effective_from: timestamp,
  })),
  plans: z.array(z.object({
    id, plan_code: z.string(), version: z.number().int().positive(), status: z.string(),
    currency: z.string().length(3), monthly_price_minor: minor, monthly_credit_grant: minor,
  })),
  wallets: z.array(z.object({
    wallet_id: id, organization_id: id, organization_name: z.string(), wallet_type: z.string(), balance: minor,
  })),
  lots: z.array(z.object({
    id, organization_id: id, source_type: z.string(), quantity: minor, expires_at: timestamp, revenue_value_minor: minor,
  })),
  redemptions: z.array(z.object({
    id, organization_id: id, status: z.string(), units: minor, reserved_credits: minor, created_at: timestamp,
  })),
});

export type AdminBoxesDashboard = z.infer<typeof adminBoxesDashboardSchema>;
export type AdminBoxesErrorReason = "UNAUTHENTICATED" | "FORBIDDEN" | "MFA_REQUIRED" | "UNAVAILABLE" | "INVALID_RESPONSE" | "INVALID_INPUT" | "CONFLICT";
export type AdminBoxesResult<T> = { status: "success"; value: T } | { status: "error"; reason: AdminBoxesErrorReason };
