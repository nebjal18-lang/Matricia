export type HomeLocale = "fr" | "ar";

export type HomePremiumCopy = {
  brand: string;
  brandLead: string;
  titleLead: string;
  titleAccent: string;
  intro: string;
  primaryAction: string;
  providerAction: string;
  preciseNeedAction: string;
  cycleTitle: readonly [string, string];
  cycleLabel: string;
  cycle: readonly string[];
  cycleOutcome: readonly [string, string];
  outcomesTitle: string;
  outcomes: readonly { title: string; description: string }[];
  networkTitle: string;
  networkIntro: string;
  networkPillars: readonly [string, string, string];
  networkCaption: string;
  faqTitle: string;
  faq: readonly { question: string; answer: string }[];
  finalTitle: readonly [string, string];
  finalPrimary: string;
  finalOr: string;
  finalSecondary: string;
  finalCaption: readonly [string, string, string];
};

const fr: HomePremiumCopy = {
  brand: "Matricia",
  brandLead: "Pour les entreprises qui veulent avancer avec méthode",
  titleLead: "Découvrez ce qui freine votre entreprise.",
  titleAccent: "Passez aux bonnes solutions.",
  intro:
    "Répondez à quelques questions. Matricia structure vos priorités et vous relie aux professionnels adaptés.",
  primaryAction: "Analyser mon entreprise",
  providerAction: "Proposer mes services",
  preciseNeedAction: "J’ai déjà un besoin précis",
  cycleTitle: ["Un cycle complet", "pour avancer sereinement"],
  cycleLabel: "Le cycle Matricia, étape par étape",
  cycle: ["Comprendre", "Structurer", "Matcher", "Comparer", "Contractualiser", "Exécuter", "Suivre"],
  cycleOutcome: ["Du diagnostic", "à l’impact"],
  outcomesTitle: "Ce que vous obtenez",
  outcomes: [
    { title: "Des priorités claires", description: "Une vision structurée de vos enjeux" },
    { title: "Des solutions adaptées", description: "Des professionnels alignés avec vos besoins" },
    { title: "Un gain de temps", description: "Moins de recherche, plus d’action" },
    { title: "Une progression durable", description: "Des actions concrètes pour votre entreprise" },
  ],
  networkTitle: "Des professionnels qualifiés",
  networkIntro:
    "Sur Matricia, les professionnels sont sélectionnés pour la pertinence de leurs compétences, la qualité de leur démarche et leur capacité à répondre à des besoins d’entreprises.",
  networkPillars: ["Vérification des informations", "Adéquation avec vos besoins", "Engagement pour un service de qualité"],
  networkCaption: "Des expertises au service de vos ambitions",
  faqTitle: "Questions fréquentes",
  faq: [
    {
      question: "Comment fonctionne Matricia ?",
      answer:
        "Vous répondez à quelques questions, Matricia structure vos priorités, puis vous confirmez avant toute consultation de professionnels.",
    },
    {
      question: "Qui peut utiliser Matricia ?",
      answer: "Les entreprises, les professionnels et les candidats franchisés, chacun dans un espace adapté à son rôle.",
    },
    {
      question: "Est-ce que je suis engagé ?",
      answer: "Non. Votre compte conserve votre parcours et aucune consultation n’est lancée sans votre validation.",
    },
    {
      question: "Comment sont sélectionnés les professionnels ?",
      answer:
        "Chaque service déclaré suit des critères, des pièces justificatives et une décision Matricia. La sélection d’un service ne vaut pas qualification.",
    },
    {
      question: "Mes informations sont-elles confidentielles ?",
      answer:
        "Vos documents et messages sensibles restent dans votre espace sécurisé, accessibles aux seuls destinataires autorisés.",
    },
  ],
  finalTitle: ["Prêt à faire avancer", "votre entreprise ?"],
  finalPrimary: "Analyser mon entreprise",
  finalOr: "Ou",
  finalSecondary: "proposer mes services",
  finalCaption: ["Ensemble,", "des entreprises", "plus fortes"],
};

const ar: HomePremiumCopy = {
  brand: "ماتريسيا",
  brandLead: "للمؤسسات التي تريد التقدم بمنهجية",
  titleLead: "اكتشف ما يعيق تطور مؤسستك.",
  titleAccent: "وانتقل إلى الحلول المناسبة.",
  intro: "أجب عن بعض الأسئلة. تنظّم ماتريسيا أولوياتك وتربطك بالمهنيين المناسبين.",
  primaryAction: "تحليل مؤسستي",
  providerAction: "تقديم خدماتي",
  preciseNeedAction: "لدي حاجة محددة",
  cycleTitle: ["دورة كاملة", "للتقدم بكل اطمئنان"],
  cycleLabel: "دورة ماتريسيا خطوة بخطوة",
  cycle: ["الفهم", "الهيكلة", "المطابقة", "المقارنة", "التعاقد", "التنفيذ", "المتابعة"],
  cycleOutcome: ["من التشخيص", "إلى الأثر"],
  outcomesTitle: "ما الذي ستحصل عليه",
  outcomes: [
    { title: "أولويات واضحة", description: "رؤية مهيكلة لرهاناتك" },
    { title: "حلول مناسبة", description: "مهنيون متوافقون مع احتياجاتك" },
    { title: "توفير في الوقت", description: "بحث أقل وعمل أكثر" },
    { title: "تقدم مستدام", description: "إجراءات ملموسة لمؤسستك" },
  ],
  networkTitle: "مهنيون مؤهلون",
  networkIntro:
    "على ماتريسيا، يُختار المهنيون حسب ملاءمة كفاءاتهم وجودة مقاربتهم وقدرتهم على الاستجابة لاحتياجات المؤسسات.",
  networkPillars: ["التحقق من المعلومات", "الملاءمة مع احتياجاتك", "الالتزام بخدمة ذات جودة"],
  networkCaption: "خبرات في خدمة طموحاتك",
  faqTitle: "الأسئلة الشائعة",
  faq: [
    {
      question: "كيف تعمل ماتريسيا؟",
      answer: "تجيب عن بعض الأسئلة، تنظم ماتريسيا أولوياتك، ثم تؤكد قبل أي استشارة للمهنيين.",
    },
    {
      question: "من يمكنه استخدام ماتريسيا؟",
      answer: "المؤسسات والمهنيون ومرشحو الامتياز، كل واحد في مساحة تناسب دوره.",
    },
    {
      question: "هل ألتزم بشيء؟",
      answer: "لا. يحفظ حسابك مسارك، ولا تُطلق أي استشارة دون مصادقتك.",
    },
    {
      question: "كيف يُختار المهنيون؟",
      answer: "كل خدمة مصرَّح بها تتبع معايير ووثائق وقراراً من ماتريسيا. اختيار خدمة لا يعني التأهيل.",
    },
    {
      question: "هل معلوماتي سرية؟",
      answer: "تبقى وثائقك ورسائلك الحساسة في مساحتك الآمنة، ولا يصل إليها إلا المستلمون المصرَّح لهم.",
    },
  ],
  finalTitle: ["جاهز لدفع مؤسستك", "إلى الأمام؟"],
  finalPrimary: "تحليل مؤسستي",
  finalOr: "أو",
  finalSecondary: "تقديم خدماتي",
  finalCaption: ["معاً،", "مؤسسات", "أقوى"],
};

export function getHomePremiumCopy(locale: HomeLocale): HomePremiumCopy {
  return locale === "ar" ? ar : fr;
}
