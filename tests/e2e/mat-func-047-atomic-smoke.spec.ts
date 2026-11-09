import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";

registerMatFuncAtomicUiSmoke({
  requirementId: "047",
  role: "client",
  route: "client/recompenses",
  heading: { fr: "Récompenses, parrainage et ROI", ar: "المكافآت والإحالة والعائد" },
  evidenceText: { fr: new RegExp("ROI|économies", "i"), ar: new RegExp("عائد", "i") }
});
