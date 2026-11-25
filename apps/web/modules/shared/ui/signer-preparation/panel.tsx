"use client";
import { useState, type FormEvent } from "react";
import { preparationDocumentUrl, preparationInput, samePreparation, signerPreparationSchema, type PlacementDraft, type SignerPreparation } from "@/modules/shared/lib/signer-preparation/model";

const copy = {
  fr: { title: "Préparer ma signature", lead: "Vérifiez le document, renseignez votre identité et choisissez où votre signature doit apparaître.", first: "Prénom exact", last: "Nom exact", language: "Langue des invitations du fournisseur", french: "Français", english: "Anglais", placements: "Emplacements de ma signature", document: "Document à signer", choose: "Choisir le document", page: "Page", x: "Position horizontale X", y: "Position verticale Y", help: "Ouvrez la page choisie dans l’aperçu. Les positions sont exprimées en points à partir du coin supérieur gauche ; 72 points correspondent à 2,54 cm. Réservez une zone libre de 85 × 37 points et vérifiez qu’aucun texte n’est recouvert.", add: "Ajouter un emplacement", remove: "Retirer cet emplacement", preview: "Aperçu du document exact", open: "Ouvrir le PDF dans un nouvel onglet", previewHelp: "Si votre navigateur ne montre pas le PDF, ouvrez-le dans un nouvel onglet. Vérifiez la page et la zone choisies avant d’enregistrer.", confirm: "J’ai lu le document et vérifié mon identité et chacun des emplacements choisis.", save: "Enregistrer ma préparation", saving: "Enregistrement et vérification…", saved: "Préparation enregistrée et relue. L’envoi attend aussi la préparation des autres signataires et les validations requises.", frozen: "La préparation est verrouillée car l’envoi a commencé ou l’enveloppe a évolué. Vos informations restent consultables.", invalid: "Renseignez votre identité, choisissez les documents et indiquez des positions entières valides. Confirmez ensuite votre vérification.", failed: "L’enregistrement n’a pas pu être confirmé. Vos saisies sont conservées ; relisez le dossier puis réessayez.", forbidden: "Votre autorisation ou votre session a changé. Reconnectez-vous et rouvrez ce dossier.", changed: "Le dossier a évolué. Actualisez la page pour consulter sa préparation actuelle.", scope: "Cette préparation concerne uniquement votre signature. Elle ne déclenche aucun paiement ni approbation contractuelle.", identity: "Mon identité de signature", languageHelp: "Les documents restent disponibles dans leur langue contractuelle. L’invitation YouSign sera envoyée dans la langue choisie.", placement: "Emplacement", selectPreview: "Choisissez un document pour afficher son aperçu.", review: "Vérification avant enregistrement" },
  ar: { title: "إعداد توقيعي", lead: "راجعوا الوثيقة وأدخلوا هويتكم واختاروا الموضع الذي يجب أن يظهر فيه توقيعكم.", first: "الاسم الشخصي الدقيق", last: "الاسم العائلي الدقيق", language: "لغة دعوات مزود التوقيع", french: "الفرنسية", english: "الإنجليزية", placements: "مواضع توقيعي", document: "الوثيقة المراد توقيعها", choose: "اختيار الوثيقة", page: "الصفحة", x: "الموضع الأفقي X", y: "الموضع العمودي Y", help: "افتحوا الصفحة المختارة في المعاينة. تُقاس المواضع بالنقط انطلاقا من الزاوية العلوية اليسرى؛ 72 نقطة تساوي 2,54 سم. احجزوا مساحة فارغة من 85 × 37 نقطة وتأكدوا من عدم تغطية أي نص.", add: "إضافة موضع", remove: "حذف هذا الموضع", preview: "معاينة الوثيقة المطابقة", open: "فتح PDF في علامة تبويب جديدة", previewHelp: "إذا لم يعرض المتصفح الوثيقة، افتحوها في علامة تبويب جديدة. راجعوا الصفحة والموضع قبل الحفظ.", confirm: "قرأت الوثيقة وتحققت من هويتي ومن كل موضع اخترته للتوقيع.", save: "حفظ إعداد توقيعي", saving: "جارٍ الحفظ والتحقق…", saved: "حُفظ الإعداد وأُعيدت قراءته. ينتظر الإرسال أيضا إعداد باقي الموقّعين والاعتمادات اللازمة.", frozen: "قُفل الإعداد لأن الإرسال بدأ أو تغيّر وضع الملف. تظل معلوماتكم متاحة للقراءة.", invalid: "أدخلوا هويتكم واختاروا الوثائق وأرقاما صحيحة للمواضع، ثم أكدوا المراجعة.", failed: "تعذر تأكيد الحفظ. احتُفظ بما أدخلتموه؛ راجعوا الملف ثم أعيدوا المحاولة.", forbidden: "تغيّرت صلاحيتكم أو جلستكم. أعيدوا الاتصال وافتحوا الملف مجددا.", changed: "تغيّر الملف. حدّثوا الصفحة لقراءة الإعداد الحالي.", scope: "يخص هذا الإعداد توقيعكم فقط ولا يُطلق دفعة أو اعتمادا تعاقديا.", identity: "هويتي للتوقيع", languageHelp: "تبقى الوثائق بلغتها التعاقدية. تُرسل دعوة YouSign باللغة المختارة.", placement: "الموضع", selectPreview: "اختاروا وثيقة لعرض معاينتها.", review: "المراجعة قبل الحفظ" },
};
const control = "mt-1 min-h-11 w-full rounded-lg border bg-background px-3 py-2 text-foreground";
const emptyPlacement = (): PlacementDraft => ({ documentSha256: "", page: "", x: "", y: "" });
export function SignerPreparationPanel({ initial, locale }: { initial: SignerPreparation; locale: "fr" | "ar" }) {
  const m = copy[locale];
  const [current, setCurrent] = useState(initial);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [language, setLanguage] = useState<string>(initial.locale);
  const [rows, setRows] = useState<PlacementDraft[]>(initial.fields.length ? initial.fields.map(field => ({ documentSha256: field.documentSha256, page: String(field.page), x: String(field.x), y: String(field.y) })) : [emptyPlacement()]);
  const [previewHash, setPreviewHash] = useState(initial.fields[0]?.documentSha256 ?? initial.documents[0]?.sha256 ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const preview = current.documents.find(document => document.sha256 === previewHash);
  function update(index: number, key: keyof PlacementDraft, value: string) {
    setRows(previous => previous.map((row, i) => i === index ? { ...row, [key]: value } : row));
    setConfirmed(false); setMessage("");
    if (key === "documentSha256") setPreviewHash(value);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setFailed(true);
    if (!confirmed || !current.canConfigure || busy) { setMessage(m.invalid); return; }
    let input;
    try { input = preparationInput(firstName, lastName, language, rows, current.documents); }
    catch { setMessage(m.invalid); return; }
    setBusy(true);
    try {
      const result = await fetch(`/api/signatures/yousign/signers/${current.signerId}/configuration`, { method: "PUT", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(15000) });
      if (!result.ok) { setMessage(result.status === 401 || result.status === 403 ? m.forbidden : result.status === 409 ? m.changed : result.status === 400 ? m.invalid : m.failed); return; }
      const receipt: unknown = await result.json();
      if (!receipt || typeof receipt !== "object" || (receipt as { outcome?: unknown }).outcome !== "YOUSIGN_SIGNER_CONFIGURED" || (receipt as { signerId?: unknown }).signerId !== current.signerId) { setMessage(m.failed); return; }
      const readback = await fetch(`/api/signatures/yousign/envelopes/${current.envelopeId}/preparation`, { credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!readback.ok) { setMessage(m.failed); return; }
      const parsed = signerPreparationSchema.safeParse(await readback.json());
      if (!parsed.success || parsed.data.envelopeId !== current.envelopeId || parsed.data.signerId !== current.signerId || !samePreparation(parsed.data, input)) { setMessage(m.changed); return; }
      setCurrent(parsed.data); setFailed(false); setMessage(m.saved);
    } catch { setMessage(m.failed); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6" dir={locale === "ar" ? "rtl" : "ltr"}>
    <header><h1 className="text-2xl font-semibold">{m.title}</h1><p className="mt-2 max-w-3xl leading-7">{m.lead}</p><p className="mt-2 text-sm text-muted-foreground">{m.scope}</p></header>
    {!current.canConfigure ? <p role="status" className="rounded-xl border bg-muted p-4">{m.frozen}</p> : null}
    <form onSubmit={event => void save(event)} aria-busy={busy} className="space-y-6">
      <fieldset disabled={busy || !current.canConfigure} className="space-y-4 rounded-xl border bg-card p-4 sm:p-6"><legend className="px-2 text-lg font-semibold">{m.identity}</legend>
        <div className="grid gap-4 sm:grid-cols-2"><label>{m.first}<input name="firstName" autoComplete="given-name" required maxLength={100} value={firstName} onChange={event => { setFirstName(event.target.value); setConfirmed(false); }} className={control}/></label><label>{m.last}<input name="lastName" autoComplete="family-name" required maxLength={100} value={lastName} onChange={event => { setLastName(event.target.value); setConfirmed(false); }} className={control}/></label></div>
        <label className="block">{m.language}<select name="providerLocale" value={language} onChange={event => { setLanguage(event.target.value); setConfirmed(false); }} className={control}><option value="fr">{m.french}</option><option value="en">{m.english}</option></select></label><p className="text-sm leading-6 text-muted-foreground">{m.languageHelp}</p>
      </fieldset>
      <fieldset disabled={busy || !current.canConfigure} className="space-y-4 rounded-xl border bg-card p-4 sm:p-6"><legend className="px-2 text-lg font-semibold">{m.placements}</legend><p className="text-sm leading-7">{m.help}</p>
        {rows.map((row,index) => <fieldset key={index} className="min-w-0 space-y-3 rounded-lg border p-3"><legend className="px-2 font-semibold">{m.placement} {index + 1}</legend><label className="block">{m.document}<select required value={row.documentSha256} onChange={event => update(index,"documentSha256",event.target.value)} className={control}><option value="">{m.choose}</option>{current.documents.map(document => <option key={document.id} value={document.sha256}>{document.fileName} · {document.locale.toUpperCase()}</option>)}</select></label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{(["page","x","y"] as const).map(key => <label key={key}>{m[key]}<input type="number" inputMode="numeric" min={key === "page" ? 1 : 0} max={key === "page" ? 9999 : key === "x" ? 510 : 804} step={1} required value={row[key]} onFocus={() => row.documentSha256 && setPreviewHash(row.documentSha256)} onChange={event => update(index,key,event.target.value)} className={control}/></label>)}</div>
          {rows.length > 1 ? <button type="button" onClick={() => { setRows(previous => previous.filter((_,i) => i !== index)); setConfirmed(false); }} className="min-h-11 rounded-lg border px-3 py-2">{m.remove}</button> : null}
        </fieldset>)}
        {rows.length < 10 ? <button type="button" onClick={() => { setRows(previous => [...previous,emptyPlacement()]); setConfirmed(false); }} className="min-h-11 rounded-lg border px-4 py-2">{m.add}</button> : null}
      </fieldset>
      <section aria-labelledby="source-preview" className="min-w-0 space-y-3 rounded-xl border bg-card p-4 sm:p-6"><h2 id="source-preview" className="text-lg font-semibold">{m.preview}</h2><p className="text-sm leading-7">{m.previewHelp}</p>{preview ? <><p className="break-words font-medium">{preview.fileName} · {preview.locale.toUpperCase()}</p><a href={preparationDocumentUrl(current.envelopeId,preview.id)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-lg border px-3 py-2 underline">{m.open}</a><iframe title={`${m.preview} — ${preview.fileName}`} src={`${preparationDocumentUrl(current.envelopeId,preview.id)}#page=${rows.find(row => row.documentSha256 === preview.sha256)?.page || 1}&zoom=page-width`} className="h-[65vh] min-h-80 w-full rounded-lg border bg-white"/></> : <p>{m.selectPreview}</p>}</section>
      <fieldset disabled={busy || !current.canConfigure} className="space-y-4 rounded-xl border bg-card p-4 sm:p-6"><legend className="px-2 font-semibold">{m.review}</legend><label className="flex items-start gap-3 leading-7"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} required className="mt-2 h-5 w-5 shrink-0"/>{m.confirm}</label><button type="submit" disabled={busy || !current.canConfigure} className="min-h-11 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">{busy ? m.saving : m.save}</button></fieldset>
      {message ? <p role={failed ? "alert" : "status"} className={`rounded-xl border p-4 ${failed ? "border-destructive" : "border-emerald-600"}`}>{message}</p> : null}
    </form>
  </div>;
}
