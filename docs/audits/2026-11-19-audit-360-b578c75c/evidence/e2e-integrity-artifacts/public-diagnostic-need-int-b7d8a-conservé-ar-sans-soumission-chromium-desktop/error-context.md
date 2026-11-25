# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public\diagnostic-need-integrity.spec.ts >> M12/M13/M14/M23/M24: diagnostic réel et besoin conservé ar, sans soumission
- Location: tests\e2e\public\diagnostic-need-integrity.spec.ts:13:3

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('#need-service option[value="BTP-RENOV"]')
Expected substring: "الاسم العربي غير متاح"
Received string:    "تجديد مبنى أو محل"
Timeout: 5000ms

Call log:
  - Expect "toContainText" locator('#need-service option[value="BTP-RENOV"]') with timeout 5000ms
  - waiting for locator('#need-service option[value="BTP-RENOV"]')
    14 × locator resolved to <option lang="ar" value="BTP-RENOV">تجديد مبنى أو محل</option>
       - unexpected value "تجديد مبنى أو محل"

```

```yaml
- link "الانتقال إلى المحتوى الرئيسي":
  - /url: "#contenu-principal"
- banner:
  - link "ماتريسيا — الصفحة الرئيسية":
    - /url: /ar
    - text: Matricia معاً نبني ما يليق بالغَد
  - navigation "التنقل العام":
    - link "كيف تعمل المنصة":
      - /url: /ar#comment-ca-marche
    - link "المؤسسات":
      - /url: /ar/entreprises
    - link "المهنيون":
      - /url: /ar/fournisseur
    - link "الامتياز":
      - /url: /ar/franchise
    - link "الاشتراكات":
      - /url: /ar/abonnements
    - link "من نحن":
      - /url: /ar/a-propos
    - link "AR":
      - /url: /ar/besoin
    - link "FR":
      - /url: /fr/besoin
    - link "تسجيل الدخول":
      - /url: /ar/connexion
    - link "إنشاء حساب":
      - /url: /ar/inscription
- main:
  - paragraph:
    - link "رجوع":
      - /url: /ar
  - paragraph: لدي احتياج محدد
  - heading "صفوا احتياجكم" [level=1]
  - paragraph: كلّما كنتم أدق، قرّبناكم من المهنيين المناسبين.
  - list "صفوا احتياجكم":
    - listitem:
      - text: "1"
      - strong: وصف الاحتياج
      - emphasis: هدفكم
    - listitem:
      - text: "2"
      - strong: الخدمات المقترحة
      - emphasis: تأكيد النطاق
    - listitem:
      - text: "3"
      - strong: الأسئلة والتفاصيل
      - emphasis: المكان والآجال والقيود
    - listitem:
      - text: "4"
      - strong: عناصر تكميلية ووثائق
      - emphasis: معلومات مفيدة اختيارية
    - listitem:
      - text: "5"
      - strong: الملخص
      - emphasis: التحقق قبل التأكيد
  - progressbar "2/5"
  - heading "2. الخدمات المقترحة" [level=2]
  - paragraph: "هذه الاقتراحات ناتجة عن نصكم. تبقى مقترحات: أكّدوا خدمة قبل أي متابعة. لا يُنشأ أي احتياج تلقائياً."
  - note: لا تتوفر بعد أسماء عربية معتمدة لبعض الخدمات والفئات. تُعرض أسماؤها المرجعية بالفرنسية مع تنبيه صريح؛ يمكنكم وصف احتياجكم بالعربية أو البحث بالفرنسية أو بمصطلحات المجالات العربية.
  - list:
    - listitem:
      - button "تجديد مبنى أو محل البناء والعقار والصيانة · الصلة 10٪" [pressed]:
        - strong: تجديد مبنى أو محل
        - text: البناء والعقار والصيانة · الصلة 10٪
    - listitem:
      - button "التصاريح الضريبية والضريبة على الشركات المحاسبة والضرائب والمالية · الصلة 7,14٪":
        - strong: التصاريح الضريبية والضريبة على الشركات
        - text: المحاسبة والضرائب والمالية · الصلة 7,14٪
  - heading "أو اختاروا يدوياً مجالاً وفئة وخدمة" [level=2]
  - paragraph: تقترح الاقتراحات وفق وصفكم.
  - text: المجال
  - combobox "المجال":
    - option "اختيار مجال…"
    - option "تكنولوجيا المعلومات والأمن السيبراني والبيانات"
    - option "التواصل والتسويق والإبداع"
    - option "المحاسبة والضرائب والمالية"
    - option "الشؤون القانونية والامتثال والحوكمة"
    - option "الموارد البشرية والتكوين"
    - option "التأمين وإدارة المخاطر"
    - option "المشتريات واللوجستيك وسلسلة الإمداد"
    - option "البناء والعقار والصيانة" [selected]
    - option "الجودة والصحة والسلامة والبيئة والشهادات"
    - option "التجارة والمبيعات وتجربة العملاء"
  - text: الفئة
  - combobox "الفئة":
    - option "اختيار فئة…" [selected]
    - option "الدراسات والتصميم"
    - option "اقتصاد البناء"
    - option "البناء والتجديد"
    - option "الحصص التقنية"
    - option "السلامة والأنظمة الخاصة"
    - option "الطاقة والاستدامة"
    - option "تدبير المرافق والصيانة"
    - option "العقار والفحص والتهيئة"
  - text: الخدمة
  - combobox "الخدمة":
    - option "اختيار خدمة…"
    - option "دراسة جدوى عقارية أو لورش"
    - option "التصميم المعماري"
    - option "دراسة الهيكل"
    - option "الدراسة الجيوتقنية"
    - option "دراسات الكهرباء والسباكة والتكييف"
    - option "حساب الكميات والتقدير وجدول الأثمان"
    - option "إدارة الأشغال وتسيير مشروع الورش"
    - option "البناء بجميع الحرف"
    - option "تجديد مبنى أو محل" [selected]
    - option "التهيئة الداخلية وتجهيز المحلات"
    - option "التركيب الكهربائي ورفع المستوى"
    - option "السباكة والمرافق الصحية وشبكات الماء"
    - option "التكييف والتهوية ومعالجة الهواء"
    - option "كشف الحريق والحماية منه"
    - option "التحكم في الولوج والإنذار وأمن المبنى"
    - option "تركيب الطاقة الشمسية الكهروضوئية"
    - option "التدقيق الطاقي للمبنى"
    - option "عقد صيانة متعدد التقنيات"
    - option "الفحص التقني وتشخيص المبنى"
    - option "التهيئة الخارجية والمسبح والمحيط"
  - checkbox "خدمة غير مدرجة إن لم تجدوا الخدمة المقترحة، يمكنكم وصفها في الخطوات التالية."
  - strong: خدمة غير مدرجة
  - emphasis: إن لم تجدوا الخدمة المقترحة، يمكنكم وصفها في الخطوات التالية.
  - button "رجوع"
  - button "حفظ المسودة"
  - button "متابعة"
  - complementary:
    - paragraph: ما فهمته ماتريسيا
    - heading "هذا ما فهمته Matricia" [level=2]
    - paragraph: هذا ملخص طلبكم. يمكن استكماله في الخطوات التالية.
    - term: هدف المشروع
    - definition: Rénover un local et suivre les travaux à Casablanca.
    - term: المخرجات المتوقعة
    - definition: تجديد مبنى أو محل
    - term: القيود المحددة
    - definition: —
    - term: معلومات ناقصة
    - definition: تفاصيل تكميلية
    - button "تعديل"
    - button "متابعة"
- contentinfo:
  - paragraph: Matricia
  - paragraph: خبرات تدفع المغرب إلى الأمام، بالفرنسية والعربية.
  - paragraph: ماتريسيا — مؤسسات أقوى، ومغرب أكثر طموحاً.
  - navigation "تذييل الصفحة":
    - list:
      - listitem:
        - link "من نحن":
          - /url: /ar/a-propos
      - listitem:
        - link "اتصل بنا":
          - /url: /ar/contact
      - listitem:
        - link "كيف تعمل المنصة":
          - /url: /ar#comment-ca-marche
      - listitem:
        - link "الاشتراكات":
          - /url: /ar/abonnements
      - listitem:
        - link "الامتياز":
          - /url: /ar/franchise
      - listitem:
        - link "المؤسسات":
          - /url: /ar/entreprises
      - listitem:
        - link "الإشعارات القانونية":
          - /url: /ar/mentions-legales
      - listitem:
        - link "الخصوصية":
          - /url: /ar/confidentialite
      - listitem:
        - link "شروط الاستخدام":
          - /url: /ar/conditions
      - listitem:
        - link "ملفات تعريف الارتباط":
          - /url: /ar/cookies
- alert
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | import { getPublicJourneyCopy } from "../../../apps/web/modules/public/data/journey/copy";
  3   | import { diagnosticQuestionIds } from "../../../apps/web/modules/public/data/journey/diagnostic-contract";
  4   | 
  5   | test.setTimeout(90_000);
  6   | 
  7   | async function expectNoHorizontalOverflow(page: Page) {
  8   |   const width = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  9   |   expect(width.content).toBeLessThanOrEqual(width.viewport);
  10  | }
  11  | 
  12  | for (const locale of ["fr", "ar"] as const) {
  13  |   test(`M12/M13/M14/M23/M24: diagnostic réel et besoin conservé ${locale}, sans soumission`, async ({ page, baseURL }, testInfo) => {
  14  |     expect(new URL(baseURL!).hostname, "Cette recette est réservée au serveur local isolé").toMatch(/^(localhost|127\.0\.0\.1|\[::1\])$/u);
  15  |     const copy = getPublicJourneyCopy(locale);
  16  |     const mutations: string[] = [];
  17  |     page.on("request", (request) => {
  18  |       if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) mutations.push(`${request.method()} ${new URL(request.url()).pathname}`);
  19  |     });
  20  | 
  21  |     await page.goto(`/${locale}/diagnostic`);
  22  |     await page.evaluate(() => {
  23  |       localStorage.removeItem("matricia.public-diagnostic.v2");
  24  |       localStorage.removeItem("matricia.public-need");
  25  |     });
  26  |     await page.reload();
  27  |     const choices = [3, 1, 1, 2, 1, 4, 1] as const;
  28  |     for (const [index, choice] of choices.entries()) {
  29  |       const question = copy.diagnostic.questions[index]!;
  30  |       await expect(page.getByRole("heading", { level: 2, name: String(question[0]), exact: true })).toBeVisible();
  31  |       await page.getByRole(index === 2 ? "button" : "radio", { name: question[2][choice]!, exact: true }).click();
  32  |       await page.getByRole("button", { name: copy.diagnostic.next, exact: true }).click();
  33  |     }
  34  |     const declaredAction = "Organiser mon chantier — خطتي الأصلية";
  35  |     await page.getByRole("textbox", { name: String(copy.diagnostic.questions[7]![0]) }).fill(declaredAction);
  36  |     await page.getByRole("button", { name: copy.diagnostic.next, exact: true }).click();
  37  |     await expect(page.getByRole("heading", { level: 1, name: copy.diagnostic.recapTitle })).toBeVisible();
  38  |     const expectedAnswers = [...choices.map((choice, index) => copy.diagnostic.questions[index]![2][choice]!), declaredAction];
  39  |     for (const [index, id] of diagnosticQuestionIds.entries()) {
  40  |       const row = page.locator(`[data-question="${id}"]`);
  41  |       await expect(row).toContainText(copy.diagnostic.questionLabels[id]);
  42  |       await expect(row).toContainText(expectedAnswers[index]!);
  43  |     }
  44  |     await page.getByRole("button", { name: copy.diagnostic.analyze, exact: true }).click();
  45  |     await expect(page.getByRole("heading", { level: 1, name: copy.diagnostic.resultTitle })).toBeVisible({ timeout: 15_000 });
  46  |     await expect(page.getByText(copy.diagnostic.priorities.security[0], { exact: true })).toHaveCount(0);
  47  |     await page.getByRole("button", { name: copy.diagnostic.viewDetail, exact: true }).first().click();
  48  |     await expect(page.getByRole("heading", { level: 1, name: copy.diagnostic.priorities.organization[0] })).toBeVisible();
  49  |     const trace = page.locator("[data-answer-trace]");
  50  |     await expect(trace.locator('[data-question="priority_tracking"]')).toContainText(copy.diagnostic.questions[3]![0]);
  51  |     await expect(trace.locator('[data-question="priority_tracking"]')).toContainText(copy.diagnostic.questions[3]![2][2]!);
  52  |     await expect(trace).not.toContainText(copy.diagnostic.priorities.organization[3]);
  53  |     const plan = page.getByRole("region", { name: copy.diagnostic.detailPlanTitle });
  54  |     await expect(plan.locator("[data-action-step]")).toHaveCount(3);
  55  |     for (const [index, action] of copy.diagnostic.actionPlans.organization.entries()) {
  56  |       const step = plan.locator(`[data-action-step="${index + 1}"]`);
  57  |       await expect(step).toContainText(action.action);
  58  |       await expect(step).toContainText(action.deliverable);
  59  |       await expect(step).toContainText(action.owner);
  60  |       await expect(step).toContainText(action.done);
  61  |     }
  62  |     await expect(page.getByRole("link", { name: copy.diagnostic.detailHelp })).toHaveAttribute("href", `/${locale}/a-propos`);
  63  |     await expectNoHorizontalOverflow(page);
  64  |     await page.getByRole("link", { name: copy.diagnostic.prepareNeed, exact: true }).click();
  65  |     await expect(page).toHaveURL(new RegExp(`/${locale}/besoin\\?`));
  66  | 
  67  |     // Create the same French free-text draft first, then verify its Arabic
  68  |     // continuation. Only catalogue labels change language, never user input.
  69  |     await page.goto("/fr/besoin");
  70  |     const originalNeed = "Rénover un local et suivre les travaux à Casablanca.";
  71  |     await page.getByRole("textbox", { name: "1. Décrire le besoin", exact: true }).fill(originalNeed);
  72  |     await expectNoHorizontalOverflow(page);
  73  |     await page.getByRole("button", { name: "Continuer", exact: true }).first().click();
  74  |     await page.locator("#need-library").selectOption("BTP");
  75  |     await page.locator("#need-service").selectOption("BTP-RENOV");
  76  |     await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("matricia.public-need") ?? "{}").classification?.serviceCode)).toBe("BTP-RENOV");
  77  |     if (locale === "ar") await page.goto("/ar/besoin");
  78  |     await expect(page.locator("#need-service")).toHaveValue("BTP-RENOV");
  79  |     if (locale === "ar") {
> 80  |       await expect(page.locator('#need-service option[value="BTP-RENOV"]')).toContainText("الاسم العربي غير متاح");
      |                                                                             ^ Error: expect(locator).toContainText(expected) failed
  81  |       await expect(page.getByRole("note")).toContainText("أسماء عربية معتمدة");
  82  |     }
  83  |     await expect(page.getByText(originalNeed, { exact: true })).toBeVisible();
  84  |     await expectNoHorizontalOverflow(page);
  85  |     await page.getByRole("button", { name: copy.need.continue, exact: true }).first().click();
  86  |     await page.locator("#need-location").fill("Casablanca — الدار البيضاء");
  87  |     await page.locator("#need-timing").fill("Trois mois");
  88  |     await page.locator("#need-constraints").fill("Accès uniquement en journée");
  89  |     await expectNoHorizontalOverflow(page);
  90  |     await page.getByRole("button", { name: copy.need.continue, exact: true }).first().click();
  91  |     await expect(page.getByRole("heading", { level: 2, name: `4. ${copy.need.stages.complete[0]}`, exact: true })).toBeVisible();
  92  |     await expect(page.getByRole("heading", { level: 3, name: copy.need.docsStepTitle, exact: true })).toBeVisible();
  93  |     await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
  94  |     await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "5");
  95  |     await expectNoHorizontalOverflow(page);
  96  |     const seeRecap = locale === "fr" ? "Voir le récapitulatif" : "عرض الملخص";
  97  |     await page.getByRole("button", { name: seeRecap, exact: true }).first().click();
  98  |     await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "5");
  99  |     await expect(page.getByText(originalNeed, { exact: true })).toBeVisible();
  100 |     await expect(page.getByText("Trois mois", { exact: true })).toBeVisible();
  101 |     await expect(page.getByText("Accès uniquement en journée", { exact: true })).toBeVisible();
  102 |     await expectNoHorizontalOverflow(page);
  103 |     await page.screenshot({path:testInfo.outputPath("need-recap-verified.png"),fullPage:true});
  104 |     await page.getByRole("button", { name: copy.need.back, exact: true }).click();
  105 |     await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
  106 |     await page.getByRole("button", { name: copy.need.back, exact: true }).click();
  107 |     await expect(page.locator("#need-location")).toHaveValue("Casablanca — الدار البيضاء");
  108 |     await expect(page.locator("#need-timing")).toHaveValue("Trois mois");
  109 |     await expect(page.locator("#need-constraints")).toHaveValue("Accès uniquement en journée");
  110 |     await expectNoHorizontalOverflow(page);
  111 |     expect(mutations, "La recette ne soumet ni diagnostic, ni demande, ni mutation métier").toEqual([]);
  112 |   });
  113 | }
  114 | 
```