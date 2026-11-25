import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";

registerMatFuncAtomicUiSmoke({
  requirementId: "053",
  role: "client",
  route: "client/portefeuille",
  heading: { fr: new RegExp("Portefeuille", "i"), ar: new RegExp("\\u0645\\u062d\\u0641\\u0638\\u0629", "i") }
});
