import { renderProviderLedgerPage } from "@/modules/provider/screens/facturation/ledger-route";

export default async function ProviderMatriciaInvoicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string;page?:string }>;
}) {
  return renderProviderLedgerPage("factures", params, searchParams);
}
