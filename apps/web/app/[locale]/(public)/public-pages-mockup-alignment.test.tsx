import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/shared/lib/auth/select-workspace", () => ({ selectWorkspace: vi.fn() }));
vi.mock("@/modules/public/ui/site/public-navigation-server", () => ({ PublicNavigationServer: ({ locale }: { locale: "fr" | "ar" }) => <PublicNavigation locale={locale} /> }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
  usePathname: () => "/fr",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/modules/shared/ui/button", () => ({ buttonVariants: () => "button" }));
vi.mock("@/modules/shared/lib/utils", () => ({ cn: (...values: Array<string | undefined>) => values.filter(Boolean).join(" ") }));
vi.mock("./contact/contact-form", () => ({
  ContactForm: () => <div>Votre demande</div>,
}));
vi.mock("../connexion/otp-form", () => ({ OtpForm: () => <form>OTP</form> }));
vi.mock("../connexion/demo-access", () => ({ DemoAccess: () => null }));
vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- mock de next/image pour le rendu statique
    <img src={props.src} alt={props.alt} />
  ),
}));

import PublicHomePage from "./page";
import ContactPage from "./contact/page";
import PublicAboutPage from "./a-propos/page";
import PublicFranchisePage from "./franchise/page";
import LoginPage from "../connexion/page";
import { PublicNavigation } from "@/modules/public/ui/site/public-navigation";
import { NotFoundScreen } from "../not-found";

describe("alignement maquettes pages publiques", () => {
  it("accueil FR : trois intentions, aperçu, sept étapes, FAQ et bandeau", async () => {
    const html = renderToStaticMarkup(await PublicHomePage({ params: Promise.resolve({ locale: "fr" }) }));
    expect(html).toContain("Analyser mon entreprise");
    expect(html).not.toContain("Des idées en actions");
    expect(html).not.toContain("Expertise");
    expect(html).toContain("Proposer mes services");
    expect(html).toContain("J’ai déjà un besoin précis");
    expect(html).toContain("Un cycle complet");
    expect(html).toContain("Questions fréquentes");
    expect(html).toContain("Prêt à faire avancer");
    expect(html).not.toContain("/home-v2/hero-plate.png");
    expect(html).toContain("/home-v2/hero-collaboration.png");
  });

  it("accueil AR : photo, cycle et FAQ dans le sens RTL", async () => {
    const html = renderToStaticMarkup(await PublicHomePage({ params: Promise.resolve({ locale: "ar" }) }));
    expect(html).toContain("/home-v2/hero-collaboration.png");
    expect(html).toContain("دورة كاملة");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("اكتشف ما يعيق تطور مؤسستك.");
    expect(html).not.toContain("أفكار تتحول إلى أفعال");
    expect(html).toContain("الأسئلة الشائعة");
  });

  it("navigation FR identique à la maquette 00", () => {
    const html = renderToStaticMarkup(<PublicNavigation locale="fr" />);
    expect(html).toContain("Comment ça marche");
    expect(html).toContain("Professionnels");
    expect(html).toContain("Franchise");
    expect(html).toContain("Abonnements");
    expect(html).toContain("À propos");
    expect(html).toContain("Se connecter");
    expect(html).toContain("Créer un compte");
  });

  it("contact : photo et formulaire réel, sans états d’envoi illustratifs", async () => {
    const html = renderToStaticMarkup(await ContactPage({ params: Promise.resolve({ locale: "fr" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("public-contact-layout");
    expect(html).toContain("Échangeons ensemble");
    expect(html).toContain("Votre demande");
    expect(html).not.toContain("États d’envoi");
    expect(html).not.toContain("Nous écrire directement");
    expect(html).toContain("/scenes/zellige-arch.png");
    expect(html).toContain("public-contact-photo");
  });

  it("404 : illustration chemin, trois situations et reprise", () => {
    const html = renderToStaticMarkup(<NotFoundScreen locale="fr" />);
    expect(html).toContain("Cette page n’est pas disponible");
    expect(html).toContain("Page introuvable");
    expect(html).toContain("Accès non autorisé");
    expect(html).toContain("Service temporairement indisponible");
    expect(html).toContain("is-coral");
    expect(html).toContain("public-path-art");
    expect(html).toContain("OPPORTUNITÉS");
  });

  it("connexion : overlay photo et bandeau navy", async () => {
    const html = renderToStaticMarkup(await LoginPage({ params: Promise.resolve({ locale: "fr" }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("public-auth-hero");
    expect(html).toContain("public-auth-band");
    expect(html).toContain("Des entreprises plus fortes pour un Maroc durable");
    expect(html).toContain("Bâtir aujourd’hui le Maroc de demain");
  });

  it("à propos et franchise conservent le hero photo et les CTA des maquettes", async () => {
    const about = renderToStaticMarkup(await PublicAboutPage({ params: Promise.resolve({ locale: "fr" }) }));
    const franchise = renderToStaticMarkup(await PublicFranchisePage({ params: Promise.resolve({ locale: "fr" }) }));
    expect(about).toContain("public-principles");
    expect(about).toContain("public-hero-split");
    expect(about).toContain("/scenes/medina-terrace.png");
    expect(franchise).toContain("journey-six-steps");
    expect(franchise).toContain("public-hero-split");
    expect(franchise).toContain("Déposer ma candidature");
    expect(franchise).toContain("contrat versionné");
    expect(franchise).not.toContain("territoire exclusif");
    const franchiseAr = renderToStaticMarkup(await PublicFranchisePage({ params: Promise.resolve({ locale: "ar" }) }));
    expect(franchiseAr).toContain("العقد ذي الإصدار");
    expect(franchiseAr).not.toContain("حصري");
    expect(franchise).toContain("is-coral");
  });
});
