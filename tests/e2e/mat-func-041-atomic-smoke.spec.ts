import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";

registerMatFuncAtomicUiSmoke({
  requirementId: "041",
  role: "client",
  route: "client/diagnostics/assistance",
  heading: { fr: new RegExp("Assistance|diagnostic", "i"), ar: new RegExp("مساعدة|تشخيص", "i") }
});
