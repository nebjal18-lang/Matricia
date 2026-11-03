import {randomUUID} from "node:crypto";
import {notFound} from "next/navigation";
import {isLocale} from "@/modules/shared/lib/i18n/locale";
import { sensitivePageContext, adminReadFailure } from "@/modules/admin/ui/sensitive-page-context";
import { WorkspaceFailure } from "@/modules/shared/ui/workspace-failure";
import {contractPolicyConsoleSchema} from "@/modules/admin/screens/contract-policies/model";
import {ContractPolicyPanel} from "@/modules/admin/screens/contract-policies/panel";
export default async function ContractPoliciesPage({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{page?: string}>}) {
  const [{locale}, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const requestedPage = Number(query.page ?? "1");
  const context = await sensitivePageContext({ locale, path: `politiques-contrats?page=${Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1}`, active: "finance", title: ar ? "سياسات العقود والعمولات" : "Politiques contractuelles et commissions", lead: ar ? "نصوص ونسب مؤرخة ومعتمدة بشكل مستقل." : "Textes et taux versionnés, datés et approuvés indépendamment.", roles: ["SUPER_ADMIN", "MATRICIA_ADMIN", "COMPLIANCE_MANAGER", "FINANCE_MANAGER", "READ_ONLY_AUDITOR"] });
  if (context.status === "blocked") return context.view;
  const client = context.access.client;
  const page = Number(query.page ?? "1");
  const result = await client.rpc("get_admin_contract_policy_console_v1", {p_page: Number.isSafeInteger(page) && page > 0 ? page : 1});
  const data = contractPolicyConsoleSchema.safeParse(result.data);
  const keys: Record<string, string> = {create: randomUUID()};
  if (data.success) for (const policy of data.data.policies) keys[policy.id] = randomUUID();
  return context.wrap(<main className="client-page">
    {result.error || !data.success ? <WorkspaceFailure locale={locale} reason={adminReadFailure(result.error)} returnPath={context.selfPath} /> : <ContractPolicyPanel locale={locale} data={data.data} actorId={context.access.userId} keys={keys}/>}
  </main>);
}
