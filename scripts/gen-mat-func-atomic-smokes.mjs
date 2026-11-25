import fs from "node:fs";
import path from "node:path";

const surfaces = [
  ["006", "provider", "sous-traitant/missions", { fr: /Missions|livrables/i, ar: /\u0627\u0644\u0645\u0647\u0627\u0645|\u0627\u0644\u062a\u0633\u0644\u064a\u0645\u0627\u062a/i }, null],
  ["006", "franchise", "franchise/actions", { fr: "File de travail de votre biblioth\u00e8que", ar: "\u0642\u0627\u0626\u0645\u0629 \u0639\u0645\u0644 \u0645\u0643\u062a\u0628\u062a\u0643\u0645" }, null],
  ["015", "client", "client/demandes", { fr: "Demandes & devis", ar: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0648\u0627\u0644\u0639\u0631\u0648\u0636" }, null],
  ["016", "provider", "sous-traitant/reputation", { fr: "Votre r\u00e9putation", ar: "\u0633\u0645\u0639\u062a\u0643\u0645" }, null],
  ["017", "provider", "sous-traitant/reputation", { fr: "Votre r\u00e9putation", ar: "\u0633\u0645\u0639\u062a\u0643\u0645" }, null],
  ["029", "provider", "sous-traitant/qualification", { fr: /qualification|Capacit\u00e9|Profil/i, ar: /\u062a\u0623\u0647\u064a\u0644|\u0642\u062f\u0631\u0629|\u0645\u0644\u0641/i }, null],
  ["030", "client", "client/finances", { fr: "Mes finances", ar: "\u0623\u0645\u0648\u0627\u0644\u064a" }, null],
  ["031", "provider", "sous-traitant/facturation", { fr: "Facturation", ar: "\u0627\u0644\u0641\u0648\u062a\u0631\u0629" }, null],
  ["032", "provider", "sous-traitant/facturation", { fr: "Facturation", ar: "\u0627\u0644\u0641\u0648\u062a\u0631\u0629" }, null],
  ["033", "client", "client/credits", { fr: "Cr\u00e9dits, Boxes et avantages", ar: "\u0627\u0644\u0623\u0631\u0635\u062f\u0629 \u0648\u0627\u0644\u0635\u0646\u0627\u062f\u064a\u0642 \u0648\u0627\u0644\u0645\u0632\u0627\u064a\u0627" }, null],
  ["034", "client", "client/recompenses", { fr: /R\u00e9compenses|parrainage|ROI|valeur/i, ar: /\u0645\u0643\u0627\u0641\u0622\u062a|\u0625\u062d\u0627\u0644\u0629|\u0639\u0627\u0626\u062f|\u0642\u064a\u0645\u0629/i }, null],
  ["035", "client", "client/recompenses", { fr: /R\u00e9compenses|parrainage|ROI|valeur/i, ar: /\u0645\u0643\u0627\u0641\u0622\u062a|\u0625\u062d\u0627\u0644\u0629|\u0639\u0627\u0626\u062f|\u0642\u064a\u0645\u0629/i }, null],
  ["036", "franchise", "franchise/performance", { fr: /Performance|Acc\u00e8s au dossier franchis\u00e9|biblioth\u00e8que/i, ar: /\u0623\u062f\u0627\u0621|\u0627\u0644\u0648\u0644\u0648\u062c \u0625\u0644\u0649 \u0645\u0644\u0641 \u0627\u0644\u0627\u0645\u062a\u064a\u0627\u0632|\u0645\u0643\u062a\u0628\u0629/i }, null],
  ["037", "franchise", "franchise/relances", { fr: /Relances|pipeline|Acc\u00e8s au dossier franchis\u00e9/i, ar: /\u0645\u062a\u0627\u0628\u0639\u0627\u062a|\u0645\u0633\u0627\u0631|\u0627\u0644\u0648\u0644\u0648\u062c \u0625\u0644\u0649 \u0645\u0644\u0641 \u0627\u0644\u0627\u0645\u062a\u064a\u0627\u0632/i }, null],
  ["039", "admin", "administration/notifications/modeles", { fr: /Mod\u00e8les de notifications|notifications/i, ar: /\u0642\u0648\u0627\u0644\u0628 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a|\u0625\u0634\u0639\u0627\u0631/i }, null],
  ["040", "franchise", "franchise/bibliotheque", { fr: "Ma biblioth\u00e8que mandat\u00e9e", ar: "\u0645\u0643\u062a\u0628\u062a\u064a \u0627\u0644\u0645\u0643\u0644\u0651\u064e\u0641\u0629" }, null],
  ["041", "client", "client/diagnostics/assistance", { fr: /Assistance|diagnostic/i, ar: /\u0645\u0633\u0627\u0639\u062f\u0629|\u062a\u0634\u062e\u064a\u0635/i }, null],
  ["042", "admin", "administration/command-center", { fr: "Administration Matricia", ar: "\u0625\u062f\u0627\u0631\u0629 \u0645\u0627\u062a\u0631\u064a\u0633\u064a\u0627" }, null],
  ["043", "franchise", "franchise/questionnaires", { fr: /Questions|questionnaires|Acc\u00e8s au dossier franchis\u00e9/i, ar: /\u0623\u0633\u0626\u0644\u0629|\u0627\u0633\u062a\u0628\u064a\u0627\u0646\u0627\u062a|\u0627\u0644\u0648\u0644\u0648\u062c \u0625\u0644\u0649 \u0645\u0644\u0641 \u0627\u0644\u0627\u0645\u062a\u064a\u0627\u0632/i }, null],
  ["045", "client", "client/diagnostics/solutions", { fr: "Solutions adapt\u00e9es \u00e0 vos priorit\u00e9s", ar: "\u062d\u0644\u0648\u0644 \u0645\u0644\u0627\u0626\u0645\u0629 \u0644\u0623\u0648\u0644\u0648\u064a\u0627\u062a\u0643\u0645" }, null],
  ["046", "client", "client/diagnostics", { fr: /diagnostics|Diagnostics/i, ar: /\u062a\u0634\u062e\u064a\u0635/i }, null],
  ["047", "client", "client/recompenses", { fr: /R\u00e9compenses|parrainage|ROI|valeur/i, ar: /\u0645\u0643\u0627\u0641\u0622\u062a|\u0625\u062d\u0627\u0644\u0629|\u0639\u0627\u0626\u062f|\u0642\u064a\u0645\u0629/i }, null],
  ["048", "client", "client/demandes", { fr: "Demandes & devis", ar: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0648\u0627\u0644\u0639\u0631\u0648\u0636" }, null],
  ["049", "client", "client/demandes", { fr: "Demandes & devis", ar: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0648\u0627\u0644\u0639\u0631\u0648\u0636" }, null],
  ["050", "client", "client/demandes", { fr: "Demandes & devis", ar: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0648\u0627\u0644\u0639\u0631\u0648\u0636" }, null],
  ["052", "admin", "administration/command-center", { fr: "Administration Matricia", ar: "\u0625\u062f\u0627\u0631\u0629 \u0645\u0627\u062a\u0631\u064a\u0633\u064a\u0627" }, null],
  ["053", "client", "client/portefeuille", { fr: /Portefeuille/i, ar: /\u0645\u062d\u0641\u0638\u0629/i }, null],
  ["055", "client", "client/questionnaires", { fr: /questionnaires|Questionnaires/i, ar: /\u0627\u0633\u062a\u0628\u064a\u0627\u0646\u0627\u062a/i }, null],
  ["057", "client", "client/questionnaires", { fr: /questionnaires|Questionnaires/i, ar: /\u0627\u0633\u062a\u0628\u064a\u0627\u0646\u0627\u062a/i }, null],
  ["062", "client", "client/recompenses", { fr: /R\u00e9compenses|parrainage|ROI|valeur/i, ar: /\u0645\u0643\u0627\u0641\u0622\u062a|\u0625\u062d\u0627\u0644\u0629|\u0639\u0627\u0626\u062f|\u0642\u064a\u0645\u0629/i }, null],
  ["063", "client", "notifications", { fr: /notifications|Notifications|Centre/i, ar: /\u0625\u0634\u0639\u0627\u0631|\u0645\u0631\u0643\u0632/i }, null],
  ["064", "franchise", "franchise/digest", { fr: /Pilotez|digest|Acc\u00e8s au dossier franchis\u00e9|biblioth\u00e8que/i, ar: /\u0642\u0648\u062f\u0648\u0627|\u0645\u0644\u062e\u0635|\u0627\u0644\u0648\u0644\u0648\u062c \u0625\u0644\u0649 \u0645\u0644\u0641 \u0627\u0644\u0627\u0645\u062a\u064a\u0627\u0632|\u0645\u0643\u062a\u0628\u0629/i }, null],
  ["065", "admin", "administration/command-center", { fr: "Administration Matricia", ar: "\u0625\u062f\u0627\u0631\u0629 \u0645\u0627\u062a\u0631\u064a\u0633\u064a\u0627" }, null],
  ["066", "admin", "administration/command-center", { fr: "Administration Matricia", ar: "\u0625\u062f\u0627\u0631\u0629 \u0645\u0627\u062a\u0631\u064a\u0633\u064a\u0627" }, null],
  ["067", "client", "client/demandes", { fr: "Demandes & devis", ar: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0648\u0627\u0644\u0639\u0631\u0648\u0636" }, null],
  ["068", "admin", "administration/command-center", { fr: "Administration Matricia", ar: "\u0625\u062f\u0627\u0631\u0629 \u0645\u0627\u062a\u0631\u064a\u0633\u064a\u0627" }, null],
];

const root = path.join(process.cwd(), "tests", "e2e");

function lit(value) {
  if (value instanceof RegExp) return `new RegExp(${JSON.stringify(value.source)}, "i")`;
  return JSON.stringify(value);
}

const byFile = new Map();
for (const [id, role, route, heading] of surfaces) {
  const key = id === "006" ? `mat-func-${id}-${role}-actions-smoke.spec.ts` : `mat-func-${id}-atomic-smoke.spec.ts`;
  if (!byFile.has(key)) byFile.set(key, []);
  byFile.get(key).push({ id, role, route, heading });
}

for (const [file, entries] of byFile) {
  const blocks = entries
    .map(
      ({ id, role, route, heading }) => `registerMatFuncAtomicUiSmoke({
  requirementId: "${id}",
  role: "${role}",
  route: "${route}",
  heading: { fr: ${lit(heading.fr)}, ar: ${lit(heading.ar)} }
});`,
    )
    .join("\n\n");
  fs.writeFileSync(path.join(root, file), `import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";\n\n${blocks}\n`, "utf8");
}

console.log(`Wrote ${byFile.size} spec files under tests/e2e`);
