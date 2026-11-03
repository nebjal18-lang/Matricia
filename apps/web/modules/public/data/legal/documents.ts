import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type LegalDocumentId = "mentions" | "confidentialite" | "conditions" | "cookies";

type LegalDocument = {
  id: LegalDocumentId;
  path: `/${string}`;
  title: string;
  description: string;
  updated: string;
  sections: readonly { heading: string; paragraphs: readonly string[] }[];
};

const fr: Record<LegalDocumentId, LegalDocument> = {
  mentions: {
    id: "mentions",
    path: "/mentions-legales",
    title: "Mentions légales",
    description: "Identité publiable de Matricia et informations légales de contact.",
    updated: "16 septembre 2026",
    sections: [
      {
        heading: "Éditeur",
        paragraphs: [
          "Matricia est une plateforme de services aux entreprises. Les informations d’identité publiables ci-dessous concernent le site public.",
          "Pour toute question relative à l’éditeur, utilisez la page Contact. Aucune donnée Client n’est traitée via ce formulaire public au-delà des messages volontairement envoyés.",
        ],
      },
      {
        heading: "Hébergement et accès",
        paragraphs: [
          "Le site est hébergé par les prestataires techniques retenus par Matricia. Les espaces authentifiés relèvent d’une infrastructure distincte, isolée par organisation.",
        ],
      },
      {
        heading: "Propriété intellectuelle",
        paragraphs: [
          "Les textes, marques et éléments graphiques Matricia sont protégés. Toute reproduction non autorisée est interdite, hors citations courtes à usage d’information.",
        ],
      },
    ],
  },
  confidentialite: {
    id: "confidentialite",
    path: "/confidentialite",
    title: "Confidentialité",
    description: "Comment Matricia traite les informations sur les pages publiques et dans l’espace sécurisé.",
    updated: "16 septembre 2026",
    sections: [
      {
        heading: "Pages publiques",
        paragraphs: [
          "Les formulaires publics (contact, candidature franchise, brouillons locaux) ne collectent que les informations nécessaires à l’orientation ou à la réponse.",
          "Les brouillons de prédiagnostic et de besoin restent sur votre appareil, avec expiration et effacement possibles, tant que vous n’êtes pas connecté.",
        ],
      },
      {
        heading: "Espace sécurisé",
        paragraphs: [
          "Après connexion, les documents, messages et dossiers sont limités aux destinataires autorisés de votre organisation. Matricia ne publie pas d’annuaire public de Prestataires ni de données Client.",
        ],
      },
      {
        heading: "Vos droits",
        paragraphs: [
          "Pour exercer vos droits d’accès, de rectification ou de suppression relatifs à un compte, contactez Matricia via la page Contact ou depuis votre espace sécurisé lorsque cela s’applique.",
        ],
      },
    ],
  },
  conditions: {
    id: "conditions",
    path: "/conditions",
    title: "Conditions d’utilisation",
    description: "Cadre d’usage du site public et rappel des responsabilités respectives.",
    updated: "16 septembre 2026",
    sections: [
      {
        heading: "Objet",
        paragraphs: [
          "Les présentes conditions encadrent l’usage du site public Matricia : information, orientation et démarrage de parcours avant authentification.",
          "L’accès aux fonctionnalités métier (consultations, devis, contrats, missions) nécessite un compte et les droits d’organisation correspondants.",
        ],
      },
      {
        heading: "Responsabilités",
        paragraphs: [
          "Les contenus d’orientation (prédiagnostic, suggestions de domaine) sont indicatifs. Ils ne constituent ni conseil juridique, ni attestation de conformité, ni engagement de résultat.",
          "Les professionnels fixent leurs devis. Le Client compare et choisit. Matricia n’invente pas de prix standard sur les pages publiques.",
        ],
      },
      {
        heading: "Comptes et abus",
        paragraphs: [
          "Chaque utilisateur s’engage à fournir des informations exactes et à ne pas contourner les contrôles d’accès. Matricia peut refuser ou limiter un usage abusif.",
        ],
      },
    ],
  },
  cookies: {
    id: "cookies",
    path: "/cookies",
    title: "Cookies",
    description: "Comment Matricia utilise les cookies nécessaires au fonctionnement du site et comment gérer vos préférences de communication.",
    updated: "20 septembre 2026",
    sections: [
      {
        heading: "Cookies nécessaires",
        paragraphs: [
          "Les cookies strictement nécessaires permettent de mémoriser la langue, de protéger la session et d’assurer la sécurité de l’accès. Ils ne peuvent pas être désactivés depuis cette page.",
        ],
      },
      {
        heading: "Préférences de communication",
        paragraphs: [
          "Les préférences de courriels et notifications sont enregistrées dans votre compte, depuis la page Notifications. Cette page ne recueille aucun consentement de communication. Aucun suivi publicitaire n’est activé sur les pages publiques.",
        ],
      },
      {
        heading: "Durée",
        paragraphs: [
          "Les préférences restent enregistrées sur cet appareil jusqu’à ce que vous les modifiiez ou effaciez les données de navigation.",
        ],
      },
    ],
  },
};

const ar: typeof fr = {
  mentions: {
    id: "mentions",
    path: "/mentions-legales",
    title: "الإشعارات القانونية",
    description: "الهوية القابلة للنشر لماتريسيا ومعلومات الاتصال القانونية.",
    updated: "16 سبتمبر 2026",
    sections: [
      {
        heading: "الناشر",
        paragraphs: [
          "ماتريسيا منصة خدمات للمؤسسات. تتعلق المعلومات أدناه بالموقع العام.",
          "لأي سؤال عن الناشر، استخدموا صفحة الاتصال. لا تُعالَج بيانات العملاء عبر هذا النموذج العام إلا للرسائل المرسلة طوعاً.",
        ],
      },
      {
        heading: "الاستضافة والوصول",
        paragraphs: [
          "يُستضاف الموقع لدى مقدمي الخدمات التقنية الذين اختارتهم ماتريسيا. المساحات المصادَق عليها منفصلة ومعزولة حسب المؤسسة.",
        ],
      },
      {
        heading: "الملكية الفكرية",
        paragraphs: [
          "نصوص وعلامات وعناصر ماتريسيا الرسومية محمية. يُمنع أي استنساخ غير مصرح به باستثناء اقتباسات قصيرة للإعلام.",
        ],
      },
    ],
  },
  confidentialite: {
    id: "confidentialite",
    path: "/confidentialite",
    title: "الخصوصية",
    description: "كيف تعالج ماتريسيا المعلومات في الصفحات العامة وفي المساحة الآمنة.",
    updated: "16 سبتمبر 2026",
    sections: [
      {
        heading: "الصفحات العامة",
        paragraphs: [
          "تجمع النماذج العامة فقط المعلومات اللازمة للتوجيه أو الرد.",
          "تبقى مسودات التقييم والاحتياج على جهازكم مع انتهاء صلاحية وإمكانية المسح ما لم تسجلوا الدخول.",
        ],
      },
      {
        heading: "المساحة الآمنة",
        paragraphs: [
          "بعد تسجيل الدخول تُقتصر الوثائق والرسائل والملفات على المستلمين المصرح بهم في مؤسستكم. لا تنشر ماتريسيا دليلاً عاماً لمقدمي الخدمات ولا بيانات العملاء.",
        ],
      },
      {
        heading: "حقوقكم",
        paragraphs: [
          "لممارسة حقوق الوصول أو التصحيح أو الحذف المتعلقة بحساب، تواصلوا عبر صفحة الاتصال أو من مساحتكم الآمنة عند الاقتضاء.",
        ],
      },
    ],
  },
  conditions: {
    id: "conditions",
    path: "/conditions",
    title: "شروط الاستخدام",
    description: "إطار استخدام الموقع العام وتذكير بالمسؤوليات.",
    updated: "16 سبتمبر 2026",
    sections: [
      {
        heading: "الغرض",
        paragraphs: [
          "تنظم هذه الشروط استخدام الموقع العام لماتريسيا: الإعلام والتوجيه وبدء المسارات قبل المصادقة.",
          "يتطلب الوصول إلى الوظائف المهنية حساباً وصلاحيات المؤسسة المناسبة.",
        ],
      },
      {
        heading: "المسؤوليات",
        paragraphs: [
          "محتويات التوجيه إرشادية. وهي ليست استشارة قانونية ولا شهادة امتثال ولا التزاماً بنتيجة.",
          "يحدد المهنيون عروضهم. يقارن العميل ويختار. لا تخترع ماتريسيا أسعاراً قياسية في الصفحات العامة.",
        ],
      },
      {
        heading: "الحسابات وإساءة الاستخدام",
        paragraphs: [
          "يلتزم كل مستخدم بتقديم معلومات دقيقة وعدم تجاوز ضوابط الوصول. يمكن لماتريسيا رفض أو تقييد الاستخدام المسيء.",
        ],
      },
    ],
  },
  cookies: {
    id: "cookies",
    path: "/cookies",
    title: "ملفات تعريف الارتباط",
    description: "كيف تستخدم ماتريسيا ملفات تعريف الارتباط اللازمة لتشغيل الموقع وكيف تديرون تفضيلات التواصل.",
    updated: "20 سبتمبر 2026",
    sections: [
      {
        heading: "ملفات ضرورية",
        paragraphs: [
          "تسمح الملفات الضرورية بحفظ اللغة وحماية الجلسة وتأمين الدخول. لا يمكن تعطيلها من هذه الصفحة.",
        ],
      },
      {
        heading: "تفضيلات التواصل",
        paragraphs: [
          "تُحفظ تفضيلات البريد والإشعارات في حسابكم من صفحة الإشعارات. لا تجمع هذه الصفحة موافقة على التواصل. لا يُفعَّل تتبع إعلاني في الصفحات العامة.",
        ],
      },
      {
        heading: "المدة",
        paragraphs: [
          "ترتبط ملفات الجلسة واللغة بمدة الجلسة أو تفضيل اللغة. ترتبط خيارات الإشعارات بحسابكم.",
        ],
      },
    ],
  },
};

export function getLegalDocument(locale: Locale, id: LegalDocumentId): LegalDocument {
  return (locale === "ar" ? ar : fr)[id];
}

export const legalDocumentIds = ["mentions", "confidentialite", "conditions", "cookies"] as const;
