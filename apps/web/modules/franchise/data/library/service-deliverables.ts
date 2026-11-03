import { z } from "zod";
const label = z.string().refine(value => value.trim().length >= 1 && value.trim().length <= 500);
/** Catalogue text is retained verbatim. Legacy strings are never translated. */
export const serviceDeliverableSchema = z.union([label, z.object({ label_fr: label, label_ar: label }).strict()]);
export const serviceDeliverablesSchema = z.array(serviceDeliverableSchema);
export const serviceFulfillmentRecordSchema = z.record(z.string(), z.unknown()).superRefine((value, context) => {
  if (Object.hasOwn(value, "deliverables") && !serviceDeliverablesSchema.safeParse(value.deliverables).success) {
    context.addIssue({ code: "custom", path: ["deliverables"], message: "INVALID_SERVICE_DELIVERABLES" });
  }
});
