import { FranchiseNetworkPage } from "@/modules/franchise/screens/spaces/network-page";

export default async function FranchiseFournisseursPage(
  props: { params: Promise<{ locale: string }>; searchParams: Promise<{ organizationId?: string; franchiseId?: string; q?: string; page?: string; service?: string; status?: string; capacity?: string; zone?: string; docs?: string }> },
) {
  return FranchiseNetworkPage({ basePath: "fournisseurs", ...props });
}
