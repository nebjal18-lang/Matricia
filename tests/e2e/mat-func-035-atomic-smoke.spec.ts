import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";

registerMatFuncAtomicUiSmoke({
  requirementId: "035",
  role: "client",
  route: "client/recompenses",
  heading: { fr: new RegExp("R\\u00e9compenses|parrainage|ROI|valeur", "i"), ar: new RegExp("\\u0645\\u0643\\u0627\\u0641\\u0622\\u062a|\\u0625\\u062d\\u0627\\u0644\\u0629|\\u0639\\u0627\\u0626\\u062f|\\u0642\\u064a\\u0645\\u0629", "i") }
});
