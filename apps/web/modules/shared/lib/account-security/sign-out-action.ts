"use server";

import { redirect } from "next/navigation";
import { safeReturnPath } from "@/modules/shared/lib/auth/return-path";
import { isLocale } from "@/modules/shared/lib/i18n/locale";
import { getSupabaseServerClient } from "@/modules/shared/lib/supabase/server";

export async function signOutOfWorkspace(formData: FormData) {
  const value = formData.get("locale");
  const locale = typeof value === "string" && isLocale(value) ? value : "fr";
  const returnTo = safeReturnPath(formData.get("returnTo"), locale) ?? `/${locale}/tableau-de-bord`;
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    const separator = returnTo.includes("?") ? "&" : "?";
    redirect(`${returnTo}${separator}signout=failed`);
  }
  redirect(`/${locale}/connexion`);
}
