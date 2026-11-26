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
  brandLead: "Plateforme B2B pour les entreprises au Maroc",
  titleLead: "Identifiez une priorité,",
  titleAccent: "consultez des professionnels, suivez la prestation.",
  intro:
    "Un dirigeant peut analyser son activité, décrire un besoin déjà défini, ou suivre une mission jusqu’au livrable.",
  primaryAction: "Analyser mon entreprise",
  providerAction: "Proposer mes services",
  preciseNeedAction: "Décrire un besoin précis",
  cycleTitle: ["Un cycle clair", "de la priorité au livrable"],
  cycleLabel: "Le cycle Matricia, étape par étape",
  cycle: ["Comprendre", "Structurer", "Mettre en relation", "Comparer", "Contractualiser", "Exécuter", "Suivre"],
  cycleOutcome: ["Du diagnostic", "à l’impact"],
  outcomesTitle: "Ce que vous obtenez",
  outcomes: [
    { title: "Une priorité formulée", description: "Le besoin est clarifié avant toute consultation" },
    { title: "Une prestation proposée", description: "Des professionnels adaptés à votre contexte" },
    { title: "Un livrable suivi", description: "Vous validez l’avancement et la réception" },
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
  brandLead: "منصة B2B للمؤسسات في المغرب",
  titleLead: "حدّدوا أولوية،",
  titleAccent: "استشيروا مهنيين، وتابعوا الخدمة.",
  intro: "يمكن للمسؤول تحليل نشاطه، أو وصف احتياج محدد، أو متابعة مهمة حتى التسليم.",
  primaryAction: "تحليل مؤسستي",
  providerAction: "تقديم خدماتي",
  preciseNeedAction: "وصف احتياج محدد",
  cycleTitle: ["دورة واضحة", "من الأولوية إلى التسليم"],
  cycleLabel: "دورة ماتريسيا خطوة بخطوة",
  cycle: ["الفهم", "الهيكلة", "الربط", "المقارنة", "التعاقد", "التنفيذ", "المتابعة"],
  cycleOutcome: ["من التشخيص", "إلى الأثر"],
  outcomesTitle: "ما الذي ستحصل عليه",
  outcomes: [
    { title: "أولوية مصاغة", description: "يُوضَّح الاحتياج قبل أي استشارة" },
    { title: "خدمة مقترحة", description: "مهنيون مناسبون لسياقكم" },
    { title: "تسليم متابع", description: " تصادقون على التقدّم والاستلام" },
    { title: "تقدم مستدام", description: "إجراءات ملموسة لمؤسستكم" },
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
