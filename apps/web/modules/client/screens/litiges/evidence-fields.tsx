import Link from "next/link";
import { Textarea } from "@/modules/shared/ui/textarea";
import type { DisputeEvidenceContext } from "@/modules/shared/lib/disputes/evidence-context";
import type { DisputeMessages } from "./messages";

export function EvidenceFields({ m, context, unavailable, locale = "fr" }: { locale?: "fr" | "ar"; m: DisputeMessages; context?: DisputeEvidenceContext; unavailable?: boolean }) {
  const ar = locale === "ar";
  const groups = context ? [
    { name: "documentId", title: ar ? "وثائق الخزنة المتحقق منها" : "Pièces vérifiées du coffre", rows: context.documents },
    { name: "sourceMessageId", title: ar ? "رسائل الملف" : "Messages du dossier", rows: context.messages },
    { name: "deliveryProofId", title: ar ? "أدلة التسليم حسب النسخة" : "Preuves de livraison par version", rows: context.deliveries },
  ] : [];
  return <fieldset className="grid gap-3 rounded-lg border p-3">
    <legend className="px-1 font-medium">{m.evidence}</legend>
    <label className="grid gap-1 text-sm">{m.evidenceStatement}<Textarea name="evidenceStatement" minLength={1} maxLength={4000} required dir="auto" /></label>
    {unavailable ? <p role="alert" className="text-sm">{ar ? "تعذر تحميل مصادر الأدلة. أعد تحميل الملف؛ لا يعني ذلك غياب الوثائق." : "Les sources de preuve n’ont pas pu être chargées. Rechargez le dossier ; cela ne signifie pas qu’il ne contient aucune pièce."}</p> : null}
    {context ? <>
      <input type="hidden" name="evidenceOrganizationId" value={context.organizationId} />
      {groups.map(group => <fieldset key={group.name} className="space-y-2"><legend className="font-medium">{group.title}</legend>
        {group.rows.length ? group.rows.map(row => <label key={row.id} className="flex min-h-11 items-start gap-3 break-words"><input type="checkbox" name={group.name} value={row.id} className="mt-1" /><span dir="auto">{row.name}{"version" in row ? ` · ${ar ? "النسخة" : "Version"} ${row.version}` : ""}</span></label>) : <p className="text-sm text-muted-foreground">{ar ? "لا توجد مصادر قابلة للإرفاق في هذه الفئة." : "Aucune source réutilisable dans cette catégorie."}</p>}
      </fieldset>)}
      <p className="text-sm">{ar ? "تُستخرج البصمة والنسخة من المصدر في الخادم، دون تغيير المحتوى الأصلي." : "L’empreinte et la version sont déterminées côté serveur à partir de l’original, qui reste inchangé."}</p>
      <Link className="underline" href={`/${locale}/${context.party === "provider" ? "sous-traitant" : "client"}/documents?organizationId=${context.organizationId}`}>{ar ? "فتح الخزنة لإضافة قطعة أو متابعة فحصها" : "Ouvrir le coffre pour déposer une pièce ou suivre sa vérification"}</Link>
      <label className="flex min-h-11 items-start gap-3"><input name="confirmDocumentSharing" type="checkbox" className="mt-1" /><span className="text-sm">{ar ? "أؤكد إرفاق المصادر المختارة وفق مستوى الرؤية المحدد." : "Je confirme le rattachement des sources sélectionnées selon la visibilité choisie."}</span></label>
    </> : null}
    <label className="grid gap-1 text-sm">{m.visibility}<select name="visibility" className="min-h-11 rounded-md border bg-background px-3">{Object.entries(m.visibilities).filter(([value]) => !context || value !== (context.party === "provider" ? "CLIENT_ONLY" : "PROVIDER_ONLY")).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <p className="text-xs text-muted-foreground">{m.immutable}</p>
  </fieldset>;
}
