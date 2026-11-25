import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { getProviderIdentityMessages } from "@/modules/admin/screens/provider-identity/messages";
import { providerIdentityReviewSchema } from "@/modules/admin/screens/provider-identity/model";
import { ProviderIdentityReviewPanel } from "@/modules/admin/screens/provider-identity/panel";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminStep5Gate } from "@/modules/admin/ui/admin-step5-gate";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export default async function ProviderIdentityPage({
  params,
}: {
  params: Promise<{ locale: string; organizationId: string }>;
}) {
  const { locale, organizationId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(organizationId).success) notFound();

  const messages = getProviderIdentityMessages(locale);
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) {
    redirect(
      connexionHref(locale, {
        next: `/${locale}/administration/providers/${organizationId}/identite`,
      }),
    );
  }

  const result = await client.rpc("get_provider_identity_review_context_v1", {
    p_provider_organization_id: organizationId,
  });
  const parsed = providerIdentityReviewSchema.safeParse(result.data);

  return (
    <AdminModulePage
      locale={locale}
      active="actors"
      actorCurrent="providers"
      path={`providers/${organizationId}/identite`}
      title={messages.title}
      lead={messages.lead}
      sceneHero
    >
      <AdminStep5Gate locale={locale} query={`?organizationId=${organizationId}`} current="providers" />
      {result.error || !parsed.success ? (
        <p role="alert" className="admin-notice" data-tone="danger">
          {locale === "ar"
            ? "الوصول مرفوض أو المراجعة غير متاحة. تحققوا من الصلاحيات والمصادقة الثنائية ثم أعيدوا المحاولة."
            : "Accès refusé ou revue indisponible. Vérifiez les habilitations et la MFA, puis réessayez."}
        </p>
      ) : (
        <ProviderIdentityReviewPanel
          data={parsed.data}
          locale={locale}
          requestKey={randomUUID()}
          messages={messages}
        />
      )}
    </AdminModulePage>
  );
}
