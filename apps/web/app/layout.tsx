import type { Metadata } from "next";
import { getPublicSiteUrl } from "@/modules/shared/lib/seo/metadata";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getPublicSiteUrl(),
  title: { default: "Matricia", template: "%s | Matricia" },
  description: "Plateforme numérique Matricia pour les services professionnels au Maroc.",
  applicationName: "Matricia",
  robots: { index: false, follow: false, noarchive: true },
  openGraph: { type: "website", siteName: "Matricia", title: "Matricia", description: "Plateforme numérique de services professionnels au Maroc.", images: [{ url: "/social-card.svg", width: 1200, height: 630, alt: "Matricia" }] },
  twitter: { card: "summary_large_image", title: "Matricia", description: "Plateforme numérique de services professionnels au Maroc.", images: ["/social-card.svg"] },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Locale attributes are synchronized by DocumentLocaleSync; avoid headers() here so
  // public routes are not forced fully dynamic at the root boundary.
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
