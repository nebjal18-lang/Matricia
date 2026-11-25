import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";

registerMatFuncAtomicUiSmoke({
  requirementId: "029",
  role: "provider",
  route: "sous-traitant/qualification",
  heading: { fr: new RegExp("qualification|Capacit\\u00e9|Profil", "i"), ar: new RegExp("\\u062a\\u0623\\u0647\\u064a\\u0644|\\u0642\\u062f\\u0631\\u0629|\\u0645\\u0644\\u0641", "i") }
});
