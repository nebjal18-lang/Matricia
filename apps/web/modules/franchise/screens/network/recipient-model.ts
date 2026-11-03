import { z } from "zod";

export const networkLinkSchema = z.object({
  invitationId: z.string().uuid(), token: z.string().regex(/^[A-Za-z0-9_-]{43}$/u), locale: z.enum(["fr", "ar"]),
});
export const openedInvitationSchema = z.object({
  invitation_id: z.string().uuid(), prospect_type: z.enum(["CLIENT", "PROVIDER"]), status: z.enum(["OPENED", "REGISTERED"]),
  organizations: z.array(z.object({ id: z.string().uuid(), name: z.string().min(1) })), expires_at: z.string(),
  delivery_mode: z.enum(["EXTERNAL", "NON_CONTRACTUAL_DEMO"]),
});
export type NetworkRecipientState =
  | { status: "idle" }
  | { status: "opened"; invitation: z.infer<typeof openedInvitationSchema> }
  | { status: "success"; organizationId: string; prospectType: "CLIENT" | "PROVIDER" }
  | { status: "error"; reason: "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "INACTIVE" | "CONFLICT" | "MFA_REQUIRED" | "FAILED" };
