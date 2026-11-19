import type { ProviderNavKey } from "@/modules/provider/ui/provider-nav";

/** Section hash after provider org unlock, matching forms-first anchors on each screen. */
export function providerContextLandHash(active: ProviderNavKey): string {
  switch (active) {
    case "home":
      return "#provider-treat-now";
    case "qualify":
      return "#qualification";
    case "consult":
      return "#consult-overview";
    case "quotes":
      return "#devis-operation";
    case "missions":
      return "#missions-operation";
    case "documents":
      return "#docs";
    case "billing":
      return "#facturation-operation";
    case "messages":
      return "#messages";
    case "reputation":
      return "#retours";
    case "services":
      return "#services-declares";
    case "company":
      return "#profil";
    case "settings":
      return "#notifications";
    default:
      return "";
  }
}
