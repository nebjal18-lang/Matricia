import { z } from "zod";

export const organizationLegalProfileSchema = z.object({
  legal_form: z.string().min(2).max(120),
  incorporation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activity: z.string().min(2).max(500),
  sector: z.string().min(2).max(120),
  employee_count: z.number().int().min(0).max(100_000_000),
  registered_city: z.string().min(2).max(120),
  registered_address: z.object({
    line1: z.string().min(3).max(300),
    postal_code: z.string().max(20).optional(),
    country_code: z.literal("MA"),
  }),
  contact: z.object({ phone: z.string().min(6).max(40), email: z.string().email().max(320) }),
  representative: z.object({
    first_name: z.string().min(2).max(120),
    last_name: z.string().min(2).max(120),
    title: z.string().min(2).max(160),
    email: z.string().email().max(320),
    phone: z.string().min(6).max(40),
    power: z.string().min(2).max(500),
  }),
  declarations: z.object({
    accuracy_confirmed: z.literal(true),
    representation_authorized: z.literal(true),
  }),
  if_number: z.string().min(3).max(40),
  rc_number: z.string().min(3).max(40),
  website: z.string().url().max(500).optional(),
}).passthrough();
export type OrganizationLegalProfile = z.infer<typeof organizationLegalProfileSchema>;
