import type { Locale } from "@/modules/shared/lib/i18n/locale";

const copy = {
  fr: {
    title: "Développez un domaine de services professionnels dans votre territoire",
    definition: "Une bibliothèque Matricia est un catalogue métier de services professionnels, avec ses questions, règles et critères de qualité. Le franchisé enrichit ce référentiel, anime un réseau de professionnels qualifiés et suit l’activité dans le périmètre de son mandat.",
    caption: "Un réseau professionnel ancré dans les territoires",
    catalogCaption: "Des services professionnels structurés par domaine métier",
    domain: "Domaine de services professionnels souhaité",
    motivationHint: "Présentez votre expérience métier et votre projet pour développer un catalogue de services et un réseau de professionnels dans votre territoire.",
    steps: [
      ["Candidature", "Vous présentez votre expérience professionnelle et votre projet."],
      ["Évaluation", "Matricia examine votre organisation, vos documents et l’adéquation de votre profil."],
      ["Domaine et territoire", "Le catalogue métier envisagé et le territoire sont étudiés par Matricia."],
      ["Validation", "Les éléments du projet sont soumis aux validations centrales requises."],
      ["Mandat et contrat", "Le périmètre, les obligations et les conditions sont définis dans le mandat et le contrat versionnés."],
      ["Pilotage", "Après activation, vous maintenez les contenus, animez le réseau et suivez la qualité de votre périmètre."],
    ],
  },
  ar: {
    title: "طوّروا مجالاً للخدمات المهنية في إقليمكم",
    definition: "مكتبة ماتريسيا هي دليل مهني للخدمات، يضم أسئلته وقواعده ومعايير جودته. يُثري صاحب الامتياز هذا المرجع وينشّط شبكة من المهنيين المؤهلين ويتابع النشاط ضمن نطاق تكليفه.",
    caption: "شبكة مهنية راسخة في الأقاليم",
    catalogCaption: "خدمات مهنية منظّمة حسب المجال",
    domain: "مجال الخدمات المهنية المرغوب",
    motivationHint: "قدّموا خبرتكم المهنية ومشروعكم لتطوير دليل للخدمات وشبكة من المهنيين في إقليمكم.",
    steps: [
      ["الترشيح", "تقدّمون خبرتكم المهنية ومشروعكم."],
      ["التقييم", "تدرس ماتريسيا مؤسستكم ووثائقكم ومدى ملاءمة ملفكم."],
      ["المجال والإقليم", "تدرس ماتريسيا الدليل المهني والإقليم المقترحين."],
      ["المصادقة", "تُعرض عناصر المشروع على المصادقات المركزية المطلوبة."],
      ["التكليف والعقد", "يُحدَّد النطاق والالتزامات والشروط في التكليف والعقد ذوي الإصدار."],
      ["القيادة", "بعد التفعيل، تحافظون على المحتويات وتنشّطون الشبكة وتتابعون جودة نطاقكم."],
    ],
  },
} as const;

export function getFranchisePresentation(locale: Locale) { return copy[locale]; }
