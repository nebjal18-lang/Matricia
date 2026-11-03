import { z } from "zod";

export const invitationStatusRows = z.array(z.object({
  id: z.string().uuid(), contact_email: z.string().email(), locale: z.enum(["fr", "ar"]),
  status: z.enum(["QUEUED", "SENT", "OPENED", "REGISTERED", "EXPIRED", "REVOKED"]),
  delivery_mode: z.enum(["EXTERNAL", "NON_CONTRACTUAL_DEMO"]).nullable(),
  created_at: z.string(), sent_at: z.string().nullable(), opened_at: z.string().nullable(), registered_at: z.string().nullable(), expires_at: z.string(),
}));
export type NetworkInvitationStatusState = { status: "idle" } | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "FAILED" } | { status: "success"; rows: z.infer<typeof invitationStatusRows>; page: number; total: number };
