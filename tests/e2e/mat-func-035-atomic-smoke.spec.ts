import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";

registerMatFuncAtomicUiSmoke({
  requirementId: "035",
  role: "client",
  route: "client/recompenses",
  heading: { fr: "Récompenses, parrainage et ROI", ar: "المكافآت والإحالة والعائد" },
  evidenceText: { fr: new RegExp("parrainage|Parrainage", "i"), ar: new RegExp("إحالة", "i") }
});
