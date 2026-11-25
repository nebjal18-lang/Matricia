import Link from "next/link";
export function SignaturePreparationLink({ locale }: { locale: "fr" | "ar" }) {
  return <Link href={`/${locale}/signatures/preparation`} className="inline-flex min-h-11 items-center rounded-lg border bg-card px-4 py-2 font-semibold underline">{locale === "ar" ? "إعداد توقيعاتي" : "Préparer mes signatures"}</Link>;
}
