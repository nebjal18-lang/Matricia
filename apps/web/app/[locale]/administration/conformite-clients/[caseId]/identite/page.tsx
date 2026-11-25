import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { getClientIdentityMessages } from "@/modules/admin/screens/client-identity/messages";
import { clientIdentityContextSchema } from "@/modules/admin/screens/client-identity/model";
import { ClientIdentityPanel } from "@/modules/admin/screens/client-identity/panel";
import { AdminModulePage } from "@/modules/admin/ui/admin-module-page";
import { AdminStep5Gate } from "@/modules/admin/ui/admin-step5-gate";
import { connexionHref } from "@/modules/shared/lib/auth/connexion-href";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export default async function ClientIdentityPage({
  params,
}: {
  params: Promise<{ locale: string; caseId: string }>;
}) {
  const { locale, caseId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(caseId).success) notFound();

  const messages = getClientIdentityMessages(locale);
  const client = await getSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) {
    redirect(
      connexionHref(locale, {
        next: `/${locale}/administration/conformite-clients/${caseId}/identite`,
      }),
    );
  }

  const result = await client.rpc("get_client_identity_review_context_v1", {
    p_compliance_case_id: caseId,
  });
  const parsed = clientIdentityContextSchema.safeParse(result.data);

  return (
    <AdminModulePage
      locale={locale}
      active="actors"
      actorCurrent="compliance"
      path={`conformite-clients/${caseId}/identite`}
      title={messages.title}
      lead={messages.lead}
      sceneHero
    >
      <AdminStep5Gate locale={locale} current="conformite" />
      {result.error || !parsed.success ? (
        <p role="alert" className="admin-notice" data-tone="danger">
          {locale === "ar"
            ? "الوصول مرفوض أو الملف غير متاح. تحققوا من الصلاحيات والمصادقة الثنائية ثم أعيدوا المحاولة."
            : "Accès refusé ou dossier indisponible. Vérifiez les habilitations et la MFA, puis réessayez."}
        </p>
      ) : (
        <ClientIdentityPanel
          data={parsed.data}
          locale={locale}
          requestKey={randomUUID()}
          messages={messages}
        />
      )}
    </AdminModulePage>
  );
}
