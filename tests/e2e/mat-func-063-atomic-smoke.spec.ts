import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";

registerMatFuncAtomicUiSmoke({
  requirementId: "063",
  role: "client",
  route: "notifications",
  heading: { fr: new RegExp("notifications|Notifications|Centre", "i"), ar: new RegExp("\\u0625\\u0634\\u0639\\u0627\\u0631|\\u0645\\u0631\\u0643\\u0632", "i") }
});
