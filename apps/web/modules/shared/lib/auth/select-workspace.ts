"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { readWorkspaceNavigation } from "./workspace-navigation-server";
import { postLoginDestination } from "@/app/[locale]/connexion/actions";

export async function selectWorkspace(formData: FormData): Promise<void> {
  const input = formData.get("locale");
  const locale = typeof input === "string" && isLocale(input) ? input : "fr";
  const requested = formData.get("workspace");
  const result = await readWorkspaceNavigation(locale);
  if (result.status === "error") redirect(result.reason === "UNAUTHENTICATED" ? `/${locale}/connexion` : `/${locale}/tableau-de-bord`);
  const selected = result.navigation.options.find(option => option.kind === requested);
  if (!selected) redirect(`/${locale}/tableau-de-bord?navigation=role-fallback`);
  (await cookies()).set("matricia.workspace", selected.kind, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(await postLoginDestination(locale, selected.href));
}
