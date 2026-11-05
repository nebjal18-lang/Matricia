import { Badge } from "@/modules/shared/ui/badge";
import { loadAdminDocumentVault } from "@/modules/admin/data/catalog/repository";
import { getCommerceMessages } from "@/modules/admin/screens/finance/commerce-messages";
import { AdminReadError } from "@/modules/admin/ui/admin-read-error";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

export async function DocumentVaultPanel({ locale }: { locale: Locale }) {
  const m = getCommerceMessages(locale);
  const result = await loadAdminDocumentVault();
  if (result.status === "error") {
    return <AdminReadError locale={locale} reason={result.reason === "FORBIDDEN" ? "FORBIDDEN" : "UNAVAILABLE"} retryHref={`/${locale}/administration/documents`} />;
  }
  return (
    <section aria-labelledby="admin-document-vault" className="mt-6 space-y-3">
      <h2 id="admin-document-vault" className="text-xl font-semibold">{m.vault}</h2>
      <p className="text-sm text-muted-foreground">{m.vaultHint}</p>
      {result.value.documents.length === 0 ? <p>{m.empty}</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {result.value.documents.map((item) => (
            <article key={`${item.source}-${item.id}`} className="rounded-xl border bg-card p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{item.organization_name}</strong>
                <Badge variant={item.expiring ? "destructive" : "outline"}>{item.expiring ? m.expiring : item.status}</Badge>
              </div>
              <p className="mt-2" dir="ltr">{item.source} · {item.document_type} · v{item.version}</p>
              {item.expires_on ? <p dir="ltr">{item.expires_on}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
