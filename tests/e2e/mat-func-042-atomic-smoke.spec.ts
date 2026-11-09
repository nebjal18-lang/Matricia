import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";

registerMatFuncAtomicUiSmoke({
  requirementId: "042",
  role: "admin",
  route: "administration/assistance-qualite",
  heading: { fr: new RegExp("qualité|Qualité", "i"), ar: new RegExp("جودة", "i") }
});
