import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { evidenceReference } from "@/modules/franchise/data/documents/model";
import { franchiseCopy } from "@/modules/franchise/data/spaces/copy";
import { MissingFranchiseReferenceContext } from "@/modules/franchise/screens/missing-reference-context";
import { requireFranchiseMandate } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";

export default async function EvidencePage({params,searchParams}:{params:Promise<{locale:string;documentId:string}>;searchParams:Promise<{franchiseId?:string;organizationId?:string}>}){
  const[{locale,documentId},query]=await Promise.all([params,searchParams]);
  if(!isLocale(locale)||!z.string().uuid().safeParse(documentId).success)notFound();
  if(!z.string().uuid().safeParse(query.franchiseId).success)return <MissingFranchiseReferenceContext locale={locale} organizationId={query.organizationId}/>;
  const { space } = await requireFranchiseMandate({
    locale,
    organizationId: query.organizationId,
    franchiseId: query.franchiseId,
    returnPath: `/${locale}/franchise/documents/${documentId}`,
    returnQuery: query,
  });
  const client=await getSupabaseServerClient();
  const response=await client.rpc("franchise_document_reference",{p_franchise_id:query.franchiseId,p_document_id:documentId,p_action:"VIEW"});
  const result=evidenceReference.safeParse(response.data);
  const ar=locale==="ar";
  const c=franchiseCopy(locale);
  const suffix=`?franchiseId=${query.franchiseId}${query.organizationId?`&organizationId=${encodeURIComponent(query.organizationId)}`:""}`;
  return (
    <FranchiseAppShell languagePath={space.currentPath} locale={locale} selectedQuery={space.selectedQuery} mandates={space.mandates} selectedOrganizationId={space.selectedOrganizationId} userEmail={space.userEmail} active="documents" title={result.success?result.data.code:c.docsTitleRich} lead={c.docsLeadRich}>
      <main className="client-page" dir={ar?"rtl":"ltr"}>
        {response.error||!result.success
          ? <p role="alert">{ar?"هذه الوثيقة غير متاحة أو أن صلاحية الوصول انتهت.":"Ce document est indisponible ou votre autorisation a expiré."}</p>
          : <article className="client-card space-y-4">
              <h1>{result.data.code}</h1>
              <p>{result.data.providerName} · v{result.data.version} · {result.data.status}</p>
              <dl>
                <dt>{ar?"تاريخ الانتهاء":"Expiration"}</dt><dd>{result.data.expiresOn??"—"}</dd>
                <dt>SHA-256</dt><dd dir="ltr" className="break-all font-mono">{result.data.contentHash}</dd>
                <dt>{ar?"الحجم بالبايت":"Taille en octets"}</dt><dd>{result.data.sizeBytes}</dd>
              </dl>
              <div className="flex flex-wrap gap-3">
                <a className="franchise-tool" href={`/${locale}/franchise/documents/${documentId}/telecharger${suffix}&mode=inline`} target="_blank" rel="noopener noreferrer">{ar?"معاينة خاصة":"Aperçu privé"}</a>
                <a className="franchise-tool franchise-tool-primary" href={`/${locale}/franchise/documents/${documentId}/telecharger${suffix}`}>{ar?"تنزيل هذه النسخة":"Télécharger cette version"}</a>
              </div>
              <h2>{ar?"آخر عمليات الوصول":"Derniers accès"}</h2>
              <ul>{result.data.accessHistory.map((event,index)=><li key={index}><time dateTime={event.at}>{event.at}</time> · {event.action} · {event.outcome}</li>)}</ul>
            </article>}
        <Link className="franchise-tool" href={`/${locale}/franchise/documents${suffix}`}>{ar?"العودة إلى الوثائق":"Retour aux documents"}</Link>
      </main>
    </FranchiseAppShell>
  );
}
