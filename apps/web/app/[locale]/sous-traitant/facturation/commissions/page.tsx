import { renderProviderLedgerPage } from "@/modules/provider/screens/facturation/ledger-route";

export default async function ProviderCommissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string;page?:string }>;
}) {
  return renderProviderLedgerPage("commissions", params, searchParams);
}
