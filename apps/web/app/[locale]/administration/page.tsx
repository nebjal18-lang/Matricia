import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";

/** `/[locale]/administration` n’a pas de hub propre : renvoyer vers le centre de pilotage. */
export default async function AdministrationIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const paramsOut = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value) paramsOut.set(key, value);
  }
  const suffix = paramsOut.size > 0 ? `?${paramsOut}` : "";
  redirect(`/${locale}/administration/command-center${suffix}`);
}
