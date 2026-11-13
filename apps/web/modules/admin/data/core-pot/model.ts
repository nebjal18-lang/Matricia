import { z } from "zod";

const uuid = z.string().uuid();
const ledgerId = z.string().regex(/^\d+$/u);
const reason = z.string().trim().min(3).max(1000);
const idempotencyKey = z.string().trim().min(8).max(200);

export const ingestPlatformCorePotSourceSchema = z
  .object({
    bookId: uuid,
    financialJournalId: uuid,
    creditRevenueLedgerId: ledgerId.optional(),
    franchiseEntryFeeLedgerId: ledgerId.optional(),
    reason,
    idempotencyKey,
    correlationId: uuid,
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasCredit = value.creditRevenueLedgerId !== undefined;
    const hasEntryFee = value.franchiseEntryFeeLedgerId !== undefined;
    if (hasCredit === hasEntryFee) {
      ctx.addIssue({ code: "custom", message: "EXACTLY_ONE_SOURCE_REQUIRED" });
    }
  });

export type IngestPlatformCorePotSourceInput = z.infer<typeof ingestPlatformCorePotSourceSchema>;

export const ingestPlatformCorePotSourceOutputSchema = z
  .object({
    outcome: z.literal("PLATFORM_CORE_POT_SOURCE_INGESTED"),
    source_type: z.enum(["CREDIT_REVENUE_LEDGER", "FRANCHISE_ENTRY_FEE_PAYMENT"]),
    source_id: z.string().min(1),
    amount_minor: z.union([z.number().int().positive(), z.string().regex(/^\d+$/u)]),
    category: z.enum(["CORE_SUBSCRIPTION_REVENUE_ACQUIRED", "ENTRY_FEE_ACQUIRED"]),
    post: z.object({ outcome: z.literal("PLATFORM_CORE_POT_ENTRY_POSTED"), entry_id: uuid }).passthrough(),
  })
  .passthrough();

export type AdminCorePotErrorReason = "UNAUTHENTICATED" | "FORBIDDEN" | "MFA_REQUIRED" | "INVALID_INPUT" | "CONFLICT" | "UNAVAILABLE" | "INVALID_RESPONSE";
export type AdminCorePotResult<T> = { status: "success"; value: T } | { status: "error"; reason: AdminCorePotErrorReason };
