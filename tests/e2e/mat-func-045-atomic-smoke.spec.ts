import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";

registerMatFuncAtomicUiSmoke({
  requirementId: "045",
  role: "client",
  route: "client/diagnostics/solutions",
  heading: { fr: new RegExp("Solutions|solutions", "i"), ar: new RegExp("حلول", "i") }
});
