import fs from "node:fs";
import path from "node:path";

const surfaces = [
  ["006", "provider", "actions", { fr: "Actions requises", ar: "الإجراءات المطلوبة" }, null],
  ["006", "franchise", "actions", { fr: "Actions requises", ar: "الإجراءات المطلوبة" }, null],
  ["015", "client", "client/demandes", { fr: "Demandes & devis", ar: "الطلبات والعروض" }, { fr: /anonymes entre eux|restent anonymes/i, ar: /مجهولة/i }],
  ["016", "provider", "sous-traitant/reputation", { fr: "Réputation et feedback", ar: "السمعة والملاحظات" }, null],
  ["017", "provider", "sous-traitant/reputation", { fr: "Réputation et feedback", ar: "السمعة والملاحظات" }, { fr: "Badges gouvernés", ar: "الشارات الخاضعة للحوكمة" }],
  ["029", "provider", "sous-traitant/qualification", { fr: "Votre qualification", ar: "تأهيلكم" }, { fr: "Expiration", ar: "الانتهاء" }],
  ["030", "client", "client/finances", { fr: "Mes finances", ar: "أموالي" }, null],
  ["031", "provider", "sous-traitant/facturation", { fr: "Facturation", ar: "الفوترة" }, null],
  ["032", "provider", "sous-traitant/facturation", { fr: "Facturation", ar: "الفوترة" }, { fr: /rapprochement|réconciliation/i, ar: /مطابقة/i }],
  ["033", "client", "client/credits", { fr: "Crédits, Boxes et avantages", ar: "الأرصدة والصناديق والمزايا" }, null],
  ["034", "client", "client/recompenses", { fr: "Récompenses, parrainage et ROI", ar: "المكافآت والإحالة والعائد" }, null],
  ["035", "client", "client/recompenses", { fr: "Récompenses, parrainage et ROI", ar: "المكافآت والإحالة والعائد" }, { fr: /parrainage|Parrainage/i, ar: /إحالة/i }],
  ["036", "franchise", "franchise/performance", { fr: "Performance de votre bibliothèque", ar: "أداء مكتبتكم" }, null],
  ["037", "franchise", "franchise/relances", { fr: "Relances et pipeline", ar: "المتابعات والمسار" }, null],
  ["039", "client", "notifications", { fr: "Centre de notifications", ar: "مركز الإشعارات" }, null],
  ["040", "admin", "administration/clonage", { fr: "Clonage de contenu avec provenance", ar: "استنساخ المحتوى مع المصدر" }, null],
  ["041", "client", "client/diagnostics/assistance", { fr: /Assistance|diagnostic/i, ar: /مساعدة|تشخيص/i }, null],
  ["042", "admin", "administration/assistance-qualite", { fr: /qualité|Qualité/i, ar: /جودة/i }, null],
  ["043", "franchise", "franchise/questionnaires", { fr: "Questions & questionnaires", ar: "الأسئلة والاستبيانات" }, null],
  ["045", "client", "client/diagnostics/solutions", { fr: /Solutions|solutions/i, ar: /حلول/i }, null],
  ["046", "client", "client/diagnostics", { fr: "Mes diagnostics", ar: "تشخيصاتي" }, null],
  ["047", "client", "client/recompenses", { fr: "Récompenses, parrainage et ROI", ar: "المكافآت والإحالة والعائد" }, { fr: /ROI|économies/i, ar: /عائد/i }],
  ["048", "client", "client/demandes", { fr: "Demandes & devis", ar: "الطلبات والعروض" }, null],
  ["049", "client", "client/demandes", { fr: "Demandes & devis", ar: "الطلبات والعروض" }, null],
  ["050", "client", "client/demandes", { fr: "Demandes & devis", ar: "الطلبات والعروض" }, null],
  ["052", "admin", "administration/command-center", { fr: "Administration Matricia", ar: "إدارة ماتريسيا" }, null],
  ["053", "client", "client/portefeuille", { fr: "Portefeuille Client", ar: "محفظة العميل" }, { fr: "Centres de coûts", ar: "مراكز التكلفة" }],
  ["055", "client", "client/questionnaires", { fr: "Mes questionnaires", ar: "استبياناتي" }, { fr: "Enregistrement sécurisé", ar: "حفظ آمن" }],
  ["057", "client", "client/questionnaires", { fr: "Mes questionnaires", ar: "استبياناتي" }, null],
  ["062", "client", "client/recompenses", { fr: "Récompenses, parrainage et ROI", ar: "المكافآت والإحالة والعائد" }, null],
  ["063", "client", "notifications", { fr: "Centre de notifications", ar: "مركز الإشعارات" }, null],
  ["064", "franchise", "franchise/digest", { fr: "Pilotez votre bibliothèque", ar: "قودوا مكتبتكم" }, null],
  ["065", "admin", "administration/command-center", { fr: "Administration Matricia", ar: "إدارة ماتريسيا" }, null],
  ["066", "admin", "administration/command-center", { fr: "Administration Matricia", ar: "إدارة ماتريسيا" }, { fr: "Exception", ar: "استثناء" }],
  ["067", "client", "client/demandes", { fr: "Demandes & devis", ar: "الطلبات والعروض" }, null],
  ["068", "admin", "administration/anti-abus", { fr: "Détection transversale des abus", ar: "مكافحة إساءة الاستخدام" }, null],
];

const root = path.join(process.cwd(), "tests", "e2e");

function evidenceBlock(ev) {
  if (!ev) return "";
  const fr = ev.fr instanceof RegExp ? `new RegExp(${JSON.stringify(ev.fr.source)}, "i")` : JSON.stringify(ev.fr);
  const ar = ev.ar instanceof RegExp ? `new RegExp(${JSON.stringify(ev.ar.source)}, "i")` : JSON.stringify(ev.ar);
  return `,\n  evidenceText: { fr: ${fr}, ar: ${ar} }`;
}

const byFile = new Map();
for (const [id, role, route, heading, ev] of surfaces) {
  const key =
    id === "006"
      ? `mat-func-${id}-${role}-actions-smoke.spec.ts`
      : `mat-func-${id}-atomic-smoke.spec.ts`;
  if (!byFile.has(key)) byFile.set(key, []);
  byFile.get(key).push({ id, role, route, heading, ev });
}

for (const [file, entries] of byFile) {
  const blocks = entries
    .map(({ id, role, route, heading, ev }) => {
      const hFr =
        heading.fr instanceof RegExp
          ? `new RegExp(${JSON.stringify(heading.fr.source)}, "i")`
          : JSON.stringify(heading.fr);
      const hAr =
        heading.ar instanceof RegExp
          ? `new RegExp(${JSON.stringify(heading.ar.source)}, "i")`
          : JSON.stringify(heading.ar);
      return `registerMatFuncAtomicUiSmoke({
  requirementId: "${id}",
  role: "${role}",
  route: "${route}",
  heading: { fr: ${hFr}, ar: ${hAr} }${evidenceBlock(ev)}
});`;
    })
    .join("\n\n");
  const content = `import { registerMatFuncAtomicUiSmoke } from "./helpers/mat-func-atomic-ui-smoke";\n\n${blocks}\n`;
  fs.writeFileSync(path.join(root, file), content, "utf8");
}

console.log(`Wrote ${byFile.size} spec files under tests/e2e`);
