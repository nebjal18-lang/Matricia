import {randomUUID} from "node:crypto";
import {redirect} from "next/navigation";
import type {Locale} from "@/modules/shared/lib/i18n/locale";
import {getSupabaseServerClient} from "@/modules/shared/lib/supabase/server";
import {dsrDeliveryConsoleSchema} from "./model";
import {DsrDeliveryPanel} from "./panel";
export async function DsrDeliveryScreen({locale, staff, page}: {locale: Locale; staff: boolean; page?: string}) {
  const client = await getSupabaseServerClient(), ar = locale === "ar";
  const {data: auth} = await client.auth.getUser();
  if (!auth.user) redirect(`/${locale}/connexion`);
  const number = Number(page ?? "1");
  const result = await client.rpc("get_dsr_delivery_console_v1", {p_staff: staff, p_page: Number.isSafeInteger(number) && number > 0 ? number : 1});
  const parsed = dsrDeliveryConsoleSchema.safeParse(result.data);
  if (result.error || !parsed.success) return <p role="alert">{ar ? "الوصول غير متاح. تحققوا من المصادقة الثنائية والصلاحيات." : "Accès indisponible. Vérifiez la MFA et vos habilitations."}</p>;
  const keys: Record<string, string> = {};
  for (const request of parsed.data.requests) keys[request.id] = randomUUID();
  return <DsrDeliveryPanel locale={locale} data={parsed.data} staff={staff} actorId={auth.user.id} keys={keys}/>;
}
