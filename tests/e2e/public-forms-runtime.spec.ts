import { expect, test, type Page } from "@playwright/test";

const copy = {
  fr: {
    homeDiagnostic: "Analyser mon entreprise",
    homeNeed: "J’ai déjà un besoin précis",
    homeProvider: "Proposer mes services",
    homeSearch: "Que recherchez-vous ?",
    homeSearchAction: "Trouver le bon parcours",
    diagnosticContinue: "Continuer",
    diagnosticResult: "Voir mon bilan",
    diagnosticHeading: "Vos priorités pour avancer",
    diagnosticDraft: "Préparer une demande",
    needContinue: "Continuer",
    needGuidance: "Décrivez votre besoin en au moins 10 caractères.",
    needHeading: "Voici ce que Matricia a compris",
    needConfirm: "Valider",
    needLogin: "Me connecter pour continuer",
    providerSearch: "Rechercher un service",
    providerNoResult: "Aucun service ne correspond à cette recherche.",
    providerContinue: "Continuer mon inscription",
    contactCategory: "Objet de la demande",
    contactEmail: "Adresse de réponse",
    contactMessage: "Votre message",
    contactSubmit: "Envoyer la demande",
  },
  ar: {
    homeDiagnostic: "حللوا شركتي",
    homeNeed: "لدي احتياج محدد",
    homeProvider: "اقترحوا خدماتكم",
    homeSearch: "عمّ تبحثون؟",
    homeSearchAction: "العثور على المسار المناسب",
    diagnosticContinue: "متابعة",
    diagnosticResult: "عرض تقييمي",
    diagnosticHeading: "أولوياتكم للمضي قدماً",
    diagnosticDraft: "إعداد طلب",
    needContinue: "متابعة",
    needGuidance: "صف حاجتك في 10 أحرف على الأقل.",
    needHeading: "هذا ما فهمته Matricia",
    needConfirm: "تأكيد",
    needLogin: "تسجيل الدخول للمتابعة",
    providerSearch: "ابحث عن خدمة",
    providerNoResult: "لا توجد خدمة مطابقة لهذا البحث.",
    providerContinue: "متابعة إنشاء الحساب",
    contactCategory: "موضوع الطلب",
    contactEmail: "بريد الرد",
    contactMessage: "رسالتكم",
    contactSubmit: "إرسال الطلب",
  },
} as const;

async function expectPublicLayout(page: Page, locale: "fr" | "ar") {
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  const width = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
}

for (const locale of ["fr", "ar"] as const) {
  test(`formulaires publics ${locale}: CTA, validations et interdits sans envoi`, async ({ page }, testInfo) => {
    const c = copy[locale];
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) {
        mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
      }
    });

    await page.goto(`/${locale}`);
    await page.evaluate(() => {
      localStorage.removeItem("matricia.public-diagnostic.v2");
      localStorage.removeItem("matricia.public-need");
      localStorage.removeItem("matricia.public-provider-intent.v2");
    });
    await page.reload();
    await expectPublicLayout(page, locale);

    await expect(page.getByRole("link", { name: c.homeDiagnostic }).first()).toHaveAttribute("href", `/${locale}/diagnostic`);
    await expect(page.getByRole("link", { name: c.homeNeed })).toHaveAttribute("href", `/${locale}/besoin`);
    await expect(page.getByRole("link", { name: c.homeProvider }).first()).toHaveAttribute("href", `/${locale}/fournisseur`);
    await page.goto(`/${locale}/services`);
    await page.getByRole("searchbox", { name: c.homeSearch }).fill("audit réseau");
    await page.getByRole("button", { name: c.homeSearchAction }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/services\\?q=audit(?:\\+|%20)r%C3%A9seau`));

    await page.goto(`/${locale}`);
    await page.getByRole("link", { name: c.homeDiagnostic }).first().click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/diagnostic$`));
    await expectPublicLayout(page, locale);

    const diagnosticNext = page.getByRole("button", { name: c.diagnosticContinue });
    await expect(diagnosticNext).toBeDisabled();
    for (let step = 0; step < 7; step += 1) {
      await page.locator(".journey-choices button").first().click();
      await expect(diagnosticNext).toBeEnabled();
      await diagnosticNext.click();
    }
    const diagnosticText = page.locator(".journey-textarea");
    await expect(page.getByRole("button", { name: c.diagnosticResult })).toBeDisabled();
    await diagnosticText.fill(locale === "fr" ? "Clarifier le suivi des actions internes." : "تنظيم متابعة الإجراءات الداخلية.");
    await page.getByRole("button", { name: c.diagnosticResult }).click();
    await expect(page.getByRole("heading", { level: 1, name: c.diagnosticHeading })).toBeVisible();

    await page.getByRole("link", { name: c.diagnosticDraft }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/besoin\\?source=diagnostic`));
    await expectPublicLayout(page, locale);

    const needText = page.locator(".journey-textarea");
    const needNext = page.getByRole("button", { name: c.needContinue });
    await expect(needNext).toBeDisabled();
    await needText.fill(locale === "fr" ? "Court" : "قصير");
    await expect(page.getByText(c.needGuidance)).toBeVisible();
    await expect(needNext).toBeDisabled();
    await needText.fill(locale === "fr" ? "Sécuriser le réseau du bureau de test." : "تأمين شبكة مكتب الاختبار بشكل منظم.");
    await needNext.click();
    await expect(page.getByRole("heading", { level: 1, name: c.needHeading })).toBeVisible();
    await page.getByRole("button", { name: c.needConfirm }).click();
    await expect(page.getByRole("link", { name: c.needLogin })).toHaveAttribute("href", new RegExp(`/${locale}/connexion\\?next=`));

    await page.goto(`/${locale}/fournisseur`);
    await expectPublicLayout(page, locale);
    const providerContinue = page.getByRole("link", { name: c.providerContinue });
    await expect(providerContinue).toHaveAttribute("aria-disabled", "true");
    await expect(providerContinue).toHaveAttribute("tabindex", "-1");
    const providerSearch = page.getByRole("searchbox", { name: c.providerSearch });
    await providerSearch.fill("service-inexistant-qa");
    await expect(page.getByText(c.providerNoResult)).toBeVisible();
    await providerSearch.clear();
    await page.locator('input[type="checkbox"]').first().check();
    await expect(providerContinue).toHaveAttribute("aria-disabled", "false");
    await expect(providerContinue).toHaveAttribute("href", new RegExp(`/${locale}/connexion\\?mode=inscription&role=fournisseur&next=`));
    await providerContinue.click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/connexion\\?mode=inscription&role=fournisseur`));

    await page.goto(`/${locale}/contact`);
    await expectPublicLayout(page, locale);
    const form = page.getByRole("button", { name: c.contactSubmit }).locator("xpath=ancestor::form");
    const category = page.getByLabel(c.contactCategory);
    const email = page.getByLabel(c.contactEmail);
    const message = page.getByLabel(c.contactMessage);
    await category.selectOption("OTHER");
    await expect(category).toHaveValue("OTHER");
    expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(false);
    await page.getByRole("button", { name: c.contactSubmit }).click();
    await expect(page.getByLabel(/Nom complet|الاسم الكامل/)).toBeFocused();
    await page.getByLabel(/Nom complet|الاسم الكامل/).fill("QA Matricia");
    await page.getByRole("button", { name: c.contactSubmit }).click();
    await expect(email).toBeFocused();
    expect(mutations).toEqual([]);

    await email.fill("adresse-invalide");
    await message.fill("message trop court");
    expect(await email.evaluate((element) => (element as HTMLInputElement).validity.typeMismatch)).toBe(true);
    expect(await message.evaluate((element) => (element as HTMLTextAreaElement).validity.tooShort)).toBe(true);
    await email.fill("qa@example.test");
    await message.fill(locale === "fr" ? "Demande publique générique pour validation locale." : "طلب عام تجريبي للتحقق المحلي فقط.");
    await page.locator("form input[type='checkbox'][required]").check();
    expect(await form.evaluate((element) => (element as HTMLFormElement).checkValidity())).toBe(true);
    expect(mutations).toEqual([]);

    await page.screenshot({ path: testInfo.outputPath(`public-forms-${locale}.png`), fullPage: true });
  });
}
