import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";

registerMatFuncAtomicUiSmoke({
  requirementId: "006",
  role: "provider",
  route: "sous-traitant/missions",
  heading: { fr: new RegExp("Missions|livrables", "i"), ar: new RegExp("\\u0627\\u0644\\u0645\\u0647\\u0627\\u0645|\\u0627\\u0644\\u062a\\u0633\\u0644\\u064a\\u0645\\u0627\\u062a", "i") }
});
