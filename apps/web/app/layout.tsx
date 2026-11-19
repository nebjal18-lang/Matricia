import type { Metadata } from "next";
import { getPublicSiteUrl } from "@/modules/shared/lib/seo/metadata";
import { DOCUMENT_LOCALE_BOOTSTRAP } from "@/modules/shared/ui/document-locale-bootstrap";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getPublicSiteUrl(),
  // Default only — locale layout owns the "%s | Matricia" template.
  title: "Matricia",
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
  // Default FR attributes stay static (no headers()/cookies()). A blocking bootstrap
  // aligns lang/dir to /ar|/fr before paint; DocumentLocaleSync covers client navigations.
  return (
    <html lang="fr" dir="ltr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: DOCUMENT_LOCALE_BOOTSTRAP }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
