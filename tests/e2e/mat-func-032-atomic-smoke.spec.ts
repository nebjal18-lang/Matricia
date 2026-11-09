import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";

registerMatFuncAtomicUiSmoke({
  requirementId: "032",
  role: "provider",
  route: "sous-traitant/facturation",
  heading: { fr: "Facturation", ar: "الفوترة" },
  evidenceText: { fr: new RegExp("rapprochement|réconciliation", "i"), ar: new RegExp("مطابقة", "i") }
});
