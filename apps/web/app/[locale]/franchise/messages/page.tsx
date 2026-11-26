import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { messageCursorSchema } from "@/modules/shared/lib/internal-messaging/model";
import { loadFranchiseMessaging } from "@/modules/franchise/data/messaging/repository";
import { FranchiseMessagesWorkspace } from "@/modules/franchise/screens/messages/messages-workspace";
import { franchiseMandateName, requireFranchiseLibrary } from "@/modules/franchise/screens/library/page-helper";
import { FranchiseAccessState } from "@/modules/franchise/ui/franchise-access-state";
import { FranchiseAppShell } from "@/modules/franchise/ui/franchise-app-shell";
import Link from "next/link";

export default async function FranchiseMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ organizationId?: string; franchiseId?: string; fil?: string; q?: string; page?: string; before?: string; beforeId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!isLocale(locale)) notFound();
  const { space, result } = await requireFranchiseLibrary({
    returnPath: `/${locale}/franchise/messages`,
    returnQuery: query,
    locale,
    organizationId: query.organizationId,
    franchiseId: query.franchiseId,
  });
  const ar = locale === "ar";
  const page = Number(query.page ?? 1);
  const parsedCursor = messageCursorSchema.safeParse({ createdAt: query.before, id: query.beforeId });
  const cursorInvalid = Boolean(query.before || query.beforeId) && !parsedCursor.success;
  const loaded =
    result.status === "success" && !cursorInvalid
      ? await loadFranchiseMessaging({
          franchiseId: result.workspace.mandate.franchiseId,
          threadId: query.fil,
          search: (query.q ?? "").trim(),
          page,
          cursor: parsedCursor.success ? parsedCursor.data : undefined,
        })
      : null;
  const scope =
    result.status === "success"
      ? {
          locale,
          organizationId: result.workspace.mandate.operatorOrganizationId!,
          franchiseId: result.workspace.mandate.franchiseId,
          commandKey: randomUUID(),
        }
      : null;
  const link = (updates: Record<string, string | null>) => {
    const values = new URLSearchParams();
    if (scope) {
      values.set("organizationId", scope.organizationId);
      values.set("franchiseId", scope.franchiseId);
    }
    if (query.q) values.set("q", query.q);
    if (query.fil) values.set("fil", query.fil);
    if (query.page) values.set("page", query.page);
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) values.delete(k);
      else values.set(k, v);
    }
    return `/${locale}/franchise/messages?${values}`;
  };
  const mandateReady = result.status === "success";
  const organizationName =
    space.organizations.find((item) => item.id === space.selectedOrganizationId)?.name
    ?? space.organizations[0]?.name
    ?? null;
  return (
    <FranchiseAppShell
      languagePath={space.currentPath}
      locale={locale}
      selectedQuery={space.selectedQuery}
      mandates={space.mandates}
      selectedOrganizationId={space.selectedOrganizationId}
      userEmail={space.userEmail}
      active="messages"
      title={ar ? "المراسلة الآمنة" : "Messagerie sécurisée"}
      lead={
        ar
          ? "تبادلات مرتبطة بالملفات ضمن التفويض الحالي."
          : "Des échanges liés aux dossiers du mandat sélectionné."
      }
      kicker={ar ? "صاحب الامتياز" : "Franchisé"}
      mandateName={franchiseMandateName(result)}
      mandateReady={mandateReady}
    >
      {result.status === "error" ? (
        <FranchiseAccessState
          locale={locale}
          reason={result.reason}
          returnPath={space.currentPath}
          organizationName={organizationName}
        />
      ) : !loaded || loaded.status === "error" || !scope ? (
        <main className="client-page">
          <p role="alert">
            {ar
              ? "تعذر تحميل المراسلة لهذا التفويض. يمكنكم إعادة المحاولة مع الاحتفاظ بالمحادثة الحالية."
              : "La messagerie de ce mandat n’a pas pu être chargée. Réessayez : le dossier et la conversation restent conservés."}
          </p>
          <p className="mt-3">
            <Link href={space.currentPath} className="client-cta">
              {ar ? "إعادة المحاولة" : "Réessayer"}
            </Link>
          </p>
        </main>
      ) : (
        <FranchiseMessagesWorkspace
          locale={locale}
          scope={scope}
          loaded={loaded}
          link={link}
          searchQuery={query.q}
          queryFil={query.fil}
          queryBefore={query.before}
        />
      )}
    </FranchiseAppShell>
  );
}
