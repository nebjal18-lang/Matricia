import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";

registerMatFuncAtomicUiSmoke({
  requirementId: "041",
  role: "client",
  route: "client/diagnostics/assistance",
  heading: { fr: new RegExp("Assistance|diagnostic", "i"), ar: new RegExp("\\u0645\\u0633\\u0627\\u0639\\u062f\\u0629|\\u062a\\u0634\\u062e\\u064a\\u0635", "i") }
});
