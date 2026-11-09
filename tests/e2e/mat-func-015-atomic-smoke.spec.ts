import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";

registerMatFuncAtomicUiSmoke({
  requirementId: "015",
  role: "client",
  route: "client/demandes",
  heading: { fr: "Demandes & devis", ar: "الطلبات والعروض" },
  evidenceText: { fr: new RegExp("anonymes entre eux|restent anonymes", "i"), ar: new RegExp("مجهولة", "i") }
});
