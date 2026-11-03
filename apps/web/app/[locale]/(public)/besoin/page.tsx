import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { localizedRouteMetadata } from "@/modules/shared/lib/seo/metadata";
import { NeedFlow } from "@/modules/public/ui/journey/need-flow";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";
import { resolvePublicNeedQuery } from "@/modules/public/data/need-intent/model";
import { discoverPublicNeedScope, savePublicNeedIntake } from "./actions";
import { resolveClientSpace } from "@/modules/client/data/spaces/context";
import { spaceCopy } from "@/modules/client/data/spaces/copy";
import { AssistanceCue } from "@/modules/client/screens/diagnostics/assistance-cue";
import { ClientAppShell } from "@/modules/client/ui/client-app-shell";
import { SpaceActions } from "@/modules/client/screens/spaces/boards";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return localizedRouteMetadata(
    locale,
    "/besoin",
    locale === "fr" ? "Nouvelle demande | Matricia" : "طلب جديد | ماتريسيا",
    locale === "fr"
      ? "Structurez un besoin précis, confirmez le service adapté et conservez votre contexte jusqu’à l’inscription."
      : "نظّم احتياجاً محدداً، وأكّد الخدمة المناسبة، واحتفظ بالسياق حتى التسجيل.",
  );
}

export default async function NeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[]; serviceCode?: string | string[]; service?: string | string[]; library?: string | string[]; organizationId?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const intent = resolvePublicNeedQuery(query, locale);
  const client = await getSupabaseServerClient();
  const auth = await client.auth.getUser();
  let organizations: { id: string; name: string }[] = [];
  if (auth.data.user) {
    const memberships = await client.from("organization_memberships").select("id,organization_id").eq("user_id", auth.data.user.id).eq("status", "ACTIVE").limit(100);
    const ids = (memberships.data ?? []).map((item) => item.id);
    const roles = ids.length
      ? await client.from("organization_member_roles").select("membership_id").in("membership_id", ids).in("role_code", ["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_BUYER"]).is("revoked_at", null).limit(300)
      : { data: [] };
    const writable = new Set((roles.data ?? []).map((item) => item.membership_id));
    const organizationIds = [...new Set((memberships.data ?? []).filter((item) => writable.has(item.id)).map((item) => item.organization_id))];
    const result = organizationIds.length ? await client.from("organizations").select("id,display_name").in("id", organizationIds).order("display_name") : { data: [] };
    organizations = (result.data ?? []).map((item) => ({ id: item.id, name: item.display_name }));
  }
  const flow = (
    <NeedFlow
      locale={locale}
      initialNeed={intent.initialNeed}
      initialClassification={intent.classification}
      invalidSelection={intent.invalidSelection}
      authenticated={Boolean(auth.data.user)}
      organizations={organizations}
      saveAction={savePublicNeedIntake}
      discoverAction={discoverPublicNeedScope}
    />
  );
  if (!auth.data.user || organizations.length === 0) return flow;
  const space = await resolveClientSpace({ locale, organizationId: query.organizationId });
  if (space.status === "unauthenticated") return flow;
  const c = spaceCopy(locale);
  return (
    <ClientAppShell
      locale={locale}
      selectedQuery={space.selectedQuery}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail} organizationName={space.organizationName}
      active="requests"
      title={c.newRequestTitle}
      lead={c.newRequestLead}
      kicker={c.kicker}
      actions={<SpaceActions href={`/${locale}/client/demandes${space.selectedQuery}`} label={locale === "ar" ? "العودة إلى الطلبات" : "Retour aux demandes"} />}
    >
      <AssistanceCue locale={locale} href={`/${locale}/client/diagnostics/assistance${space.selectedQuery}`} context="need" />
      {flow}
    </ClientAppShell>
  );
}
