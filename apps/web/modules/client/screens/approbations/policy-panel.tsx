import { randomUUID } from "node:crypto";
import type { Locale } from "@/modules/shared/lib/i18n/locale";
import { formatExactMoney } from "@/modules/shared/lib/contracts-missions/model";
import { ClientApprovalPolicyActivation, ClientApprovalPolicyForm } from "./policy-forms";
import type { ApprovalMessages } from "./messages";
import type { ClientApprovalPolicy } from "./model";

export function ClientApprovalPoliciesPanel({ locale, organizationId, userId, canManage, result, messages }: { locale: Locale; organizationId: string; userId: string; canManage: boolean; result: { status: "success"; items: ClientApprovalPolicy[] } | { status: "unavailable" }; messages: ApprovalMessages }) {
  return <section className="client-card space-y-4" aria-labelledby="client-approval-policies"><h2 id="client-approval-policies">{messages.policyTitle}</h2><p>{messages.policyIntro}</p>
    {result.status === "unavailable" ? <p role="alert">{messages.policyUnavailable}</p> : result.items.length === 0 ? <p>{messages.policyEmpty}</p> : <ul className="space-y-3">{result.items.map((policy) => <li key={policy.id} className="rounded-lg border p-4">
      <h3>{messages.resources[policy.resourceType as keyof typeof messages.resources] ?? messages.resourceFallback} · {messages.version} {policy.version}</h3><p>{messages.policyStatuses[policy.status]}</p>
      <p>{messages.approvalsCount} : {policy.minimumApprovals}</p><p>{messages.roles} : {policy.roleCodes.map((r) => messages.roleNames[r as keyof typeof messages.roleNames] ?? messages.resourceFallback).join(" · ")}</p>
      {policy.executionScope.currency && policy.executionScope.minimum_amount_minor ? <p>{messages.threshold} : <bdi>{formatExactMoney(policy.executionScope.minimum_amount_minor, policy.executionScope.currency, locale)}</bdi></p> : null}
      {policy.executionScope.currency && policy.executionScope.buyer_limit_minor !== null && policy.executionScope.buyer_limit_minor !== undefined ? <p>{messages.buyerLimit} : <bdi>{formatExactMoney(policy.executionScope.buyer_limit_minor, policy.executionScope.currency, locale)}</bdi></p> : null}
      {canManage && policy.status === "DRAFT" ? policy.createdBy === userId ? <p>{messages.independent}</p> : <ClientApprovalPolicyActivation locale={locale} organizationId={organizationId} policy={policy} messages={messages} idempotencyKey={randomUUID()} /> : null}
    </li>)}</ul>}
    {canManage && result.status === "success" ? <details><summary className="min-h-11 cursor-pointer font-medium">{messages.propose}</summary><ClientApprovalPolicyForm locale={locale} organizationId={organizationId} messages={messages} idempotencyKey={randomUUID()} effectiveFrom={new Date().toISOString()} /></details> : null}
  </section>;
}
