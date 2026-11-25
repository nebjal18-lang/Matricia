import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";

registerMatFuncAtomicUiSmoke({
  requirementId: "046",
  role: "client",
  route: "client/diagnostics",
  heading: { fr: new RegExp("diagnostics|Diagnostics", "i"), ar: new RegExp("\\u062a\\u0634\\u062e\\u064a\\u0635", "i") }
});
