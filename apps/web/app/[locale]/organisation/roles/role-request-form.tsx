"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { Button } from "@/modules/shared/ui/button";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { requestAdditionalRole, type OrganizationRole, type RoleOrganization, type RoleRequestActionState } from "./actions";
import type { RoleMessages } from "./messages";

const initialState: RoleRequestActionState = { status: "idle" };
const allRoles = [
  "CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER", "CLIENT_ACCOUNTING", "CLIENT_MEMBER", "CLIENT_VIEWER",
  "PROVIDER_OWNER", "PROVIDER_MANAGER", "PROVIDER_SALES", "PROVIDER_TECHNICIAN", "PROVIDER_ACCOUNTING", "PROVIDER_VIEWER",
  "FRANCHISE_OWNER", "FRANCHISE_MANAGER", "FRANCHISE_EXPERT", "FRANCHISE_PROVIDER_MANAGER", "FRANCHISE_ACCOUNTING", "FRANCHISE_VIEWER",
] as const satisfies readonly OrganizationRole[];

export function RoleRequestForm({
  locale,
  organizations,
  idempotencyKey,
  messages,
}: {
  locale: Locale;
  organizations: RoleOrganization[];
  idempotencyKey: string;
  messages: RoleMessages;
}) {
  const [state, action, pending] = useActionState(requestAdditionalRole, initialState);
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const statusId = useId();
  if (organizations.length === 0) {
    return <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">{messages.noOrganization}</p>;
  }
  if (state.status === "success") {
    return (
      <div role="status" tabIndex={-1} className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4 outline-none">
        <p>{state.outcome === "ROLE_REQUESTED" ? messages.requested : messages.alreadyPending}</p>
        <Button asChild variant="outline"><Link href={"/" + locale + "/organisation/roles"}>{messages.another}</Link></Button>
      </div>
    );
  }
  const selected = organizations.find((organization) => organization.id === organizationId) ?? organizations[0];
  if (!selected) return <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">{messages.noOrganization}</p>;
  const availableRoles = allRoles.filter((role) => !selected.currentRoles.includes(role));
  const error = state.status === "error"
    ? state.reason === "VALIDATION" ? messages.requestErrors.validation
      : state.reason === "UNAUTHENTICATED" ? messages.requestErrors.unauthenticated
        : messages.requestErrors.generic
    : null;
  return (
    <form action={action} className="space-y-5" aria-describedby={statusId} noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="space-y-2">
        <label htmlFor="role-organization" className="text-sm font-medium">{messages.organization}</label>
        <select
          id="role-organization"
          name="organizationId"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          required
          className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.displayName}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="requested-role" className="text-sm font-medium">{messages.role}</label>
        <select id="requested-role" name="requestedRoleCode" required className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
          {availableRoles.map((role) => <option key={role} value={role}>{messages.roles[role]}</option>)}
        </select>
      </div>
      <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending || availableRoles.length === 0}>{pending ? messages.submitting : messages.submit}</Button>
      <p id={statusId} role={error ? "alert" : "status"} aria-live="polite" className={error ? "min-h-5 text-sm text-destructive" : "min-h-5 text-sm text-primary"}>{error ?? ""}</p>
    </form>
  );
}
