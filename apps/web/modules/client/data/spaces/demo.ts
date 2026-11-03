import type { Locale } from "@/modules/shared/lib/i18n/locale";

export function canApplyClientSpaceDemo() {
  return false;
}

export function demoClientSpaces(locale: Locale, query: string) {
  const fr = locale === "fr";
  const q = query;
  return {
    priorities: [
      {
        id: "p1",
        title: fr ? "Structurer votre organisation" : "هيكلة مؤسستكم",
        href: `/${locale}/client/diagnostics${q}`,
        cta: "plan" as const,
        constat: fr ? "Rôles et process encore peu formalisés" : "أدوار ومساطر غير موثقة بما يكفي",
        impact: fr ? "Décisions plus lentes au quotidien" : "قرارات يومية أبطأ",
        action: fr ? "Plan d’organisation et de gouvernance" : "خطة تنظيم وحوكمة",
        why: fr ? "Le bilan a identifié des responsabilités floues" : "أظهر التحليل مسؤوليات غير واضحة",
      },
      {
        id: "p2",
        title: fr ? "Sécuriser vos démarches" : "تأمين مساطركم",
        href: `/${locale}/besoin${q}`,
        cta: "need" as const,
        constat: fr ? "Pièces et délais à fiabiliser" : "وثائق وآجال تحتاج تثبيتاً",
        impact: fr ? "Risque de blocage administratif" : "خطر تعطّل إداري",
        action: fr ? "Cadrer un besoin de mise en conformité" : "تأطير احتياج للامتثال",
        why: fr ? "Des justificatifs restent incomplets" : "ما تزال بعض الإثباتات ناقصة",
      },
      {
        id: "p3",
        title: fr ? "Développer vos opportunités" : "تطوير فرصكم",
        href: `/${locale}/client/diagnostics${q}`,
        cta: "plan" as const,
        constat: fr ? "Offre commerciale à clarifier" : "العرض التجاري يحتاج توضيحاً",
        impact: fr ? "Croissance plus difficile à piloter" : "نمو أصعب في المتابعة",
        action: fr ? "Accompagnement stratégique et lancement" : "مواكبة استراتيجية وإطلاق",
        why: fr ? "Le bilan pointe un potentiel peu activé" : "يشير التحليل إلى إمكان غير مفعّل",
      },
    ],
    understood: {
      activity: fr ? "Communication, marketing et création" : "التواصل والتسويق والإبداع",
      objectives: fr ? "Structurer la marque et sécuriser le lancement" : "هيكلة العلامة وتأمين الإطلاق",
      attention: fr ? "Documents légaux et choix de prestataire" : "وثائق قانونية واختيار مقدم الخدمة",
    },
    runs: [
      { id: "r1", title: fr ? "Bilan communication — septembre 2026" : "تحليل التواصل — سبتمبر 2026", href: `/${locale}/client/diagnostics${q}` },
      { id: "r2", title: fr ? "Bilan organisation — août 2026" : "تحليل التنظيم — أغسطس 2026", href: `/${locale}/client/diagnostics${q}` },
      { id: "r3", title: fr ? "Premier cadrage" : "التأطير الأول", href: `/${locale}/client/diagnostics${q}` },
    ],
    requestKpis: [
      { id: "k1", title: fr ? "À compléter" : "للإستكمال", detail: fr ? "Registre et statuts" : "السجل والنظام الأساسي", href: `/${locale}/client/documents${q}`, tone: "peach" as const },
      { id: "k2", title: fr ? "Offres à comparer" : "عروض للمقارنة", detail: fr ? "2 propositions reçues" : "عرضان مستلمان", href: `/${locale}/client/demandes${q}`, tone: "violet" as const },
      { id: "k3", title: fr ? "Questions à répondre" : "أسئلة للرد", detail: fr ? "2 messages ouverts" : "رسالتان مفتوحتان", href: `/${locale}/messagerie${q}`, tone: "mint" as const },
    ],
    requests: [
      { id: "d1", title: fr ? "Conseil stratégique" : "استشارة استراتيجية", status: fr ? "En préparation" : "قيد الإعداد", last: fr ? "Cadrage enregistré" : "تم حفظ التأطير", next: fr ? "Compléter le besoin" : "استكمال الاحتياج", href: `/${locale}/client/demandes${q}`, tone: "violet" as const },
      { id: "d2", title: fr ? "Organisation et process" : "تنظيم ومساطر", status: fr ? "En consultation" : "في الاستشارة", last: fr ? "Panel invité" : "تمت دعوة اللجنة", next: fr ? "Attendre les devis" : "انتظار العروض", href: `/${locale}/client/demandes${q}`, tone: "sky" as const },
      { id: "d3", title: fr ? "Transformation digitale" : "التحول الرقمي", status: fr ? "Offres reçues" : "عروض مستلمة", last: fr ? "2 devis comparables" : "عرضان قابلان للمقارنة", next: fr ? "Comparer les offres" : "مقارنة العروض", href: `/${locale}/client/demandes${q}`, tone: "mint" as const },
      { id: "d4", title: fr ? "Conformité et risques" : "الامتثال والمخاطر", status: fr ? "En attente de précision" : "بانتظار توضيح", last: fr ? "Pièce demandée" : "تم طلب وثيقة", next: fr ? "Déposer le document" : "إيداع المستند", href: `/${locale}/client/documents${q}`, tone: "peach" as const },
      { id: "d5", title: fr ? "Croissance et développement" : "النمو والتطوير", status: fr ? "En consultation" : "في الاستشارة", last: fr ? "Question prestataire" : "سؤال من مقدم الخدمة", next: fr ? "Répondre au message" : "الرد على الرسالة", href: `/${locale}/messagerie${q}`, tone: "sky" as const },
    ],
    missions: {
      validations: [
        { id: "v1", title: fr ? "Valider un livrable" : "المصادقة على تسليم", detail: fr ? "Identité de marque à examiner" : "هوية العلامة للمراجعة", href: `/${locale}/client/missions${q}` },
        { id: "v2", title: fr ? "Répondre à une proposition d’avenant" : "الرد على مقترح ملحق", detail: fr ? "Ajustement de périmètre" : "تعديل النطاق", href: `/${locale}/client/missions${q}` },
      ],
      steps: [
        { id: "s1", title: fr ? "Demande initiale" : "الطلب الأولي", detail: fr ? "Votre besoin a été enregistré et transmis." : "تم تسجيل حاجتكم وإرسالها.", state: "done" as const },
        { id: "s2", title: fr ? "Offre choisie" : "العرض المختار", detail: fr ? "Une offre a été sélectionnée. Prochaine étape : finaliser le contrat." : "تم اختيار عرض. الخطوة التالية: إنهاء العقد.", state: "current" as const },
        { id: "s3", title: fr ? "Contrat" : "العقد", detail: fr ? "Le contrat sera préparé après validation." : "سيُعدّ العقد بعد المصادقة.", state: "todo" as const },
        { id: "s4", title: fr ? "Mission" : "المهمة", detail: fr ? "La mission démarrera une fois le contrat signé." : "تبدأ المهمة بعد توقيع العقد.", state: "todo" as const },
        { id: "s5", title: fr ? "Jalons" : "المراحل", detail: fr ? "Les différentes étapes suivies tout au long de la mission." : "المراحل المتابعة طوال المهمة.", state: "todo" as const },
        { id: "s6", title: fr ? "Livraison" : "التسليم", detail: fr ? "Les livrables finaux seront mis à disposition pour validation." : "ستُتاح التسليمات النهائية للمصادقة.", state: "todo" as const },
      ],
      decision: {
        title: fr ? "Proposition d’avenant sur le périmètre de la mission" : "مقترح ملحق على نطاق المهمة",
        context: fr ? "Une évolution du périmètre est proposée pour mieux répondre à votre besoin." : "يُقترح تطور في النطاق للاستجابة أفضل لحاجتكم.",
        impact: fr ? "Cet avenant peut avoir des conséquences sur l’organisation de la mission et les livrables prévus." : "قد يؤثر الملحق على تنظيم المهمة والتسليمات المخططة.",
        href: `/${locale}/client/missions${q}`,
      },
      files: [
        { id: "f1", title: fr ? "Proposition d’avenant" : "مقترح الملحق", kind: "pdf" as const, href: `/${locale}/client/documents${q}` },
        { id: "f2", title: fr ? "Cahier des charges" : "دفتر التحملات", kind: "docx" as const, href: `/${locale}/client/documents${q}` },
        { id: "f3", title: fr ? "Échange sur le périmètre" : "مراسلة حول النطاق", kind: "message" as const, href: `/${locale}/messagerie${q}` },
        { id: "f4", title: fr ? "Livrable — version en cours" : "تسليم — نسخة جارية", kind: "file" as const, href: `/${locale}/client/missions${q}` },
      ],
    },
    documents: [
      { id: "doc1", title: fr ? "Contrat de prestation" : "عقد الخدمة", folder: fr ? "Déploiement de la marque" : "إطلاق العلامة", status: fr ? "À examiner" : "للمراجعة", access: fr ? "Équipe habilitée" : "الفريق المخوّل", href: `/${locale}/client/documents${q}`, tone: "peach" as const, kind: "pdf" as const },
      { id: "doc2", title: fr ? "Cahier des charges" : "دفتر التحملات", folder: fr ? "Conseil stratégique" : "استشارة استراتيجية", status: fr ? "Partagé" : "مشترك", access: fr ? "Vous et le prestataire" : "أنتم ومقدم الخدمة", href: `/${locale}/client/documents${q}`, tone: "mint" as const, kind: "docx" as const },
      { id: "doc3", title: fr ? "Suivi de projet" : "متابعة المشروع", folder: fr ? "Transformation digitale" : "التحول الرقمي", status: fr ? "Partagé" : "مشترك", access: fr ? "Équipe projet" : "فريق المشروع", href: `/${locale}/client/documents${q}`, tone: "mint" as const, kind: "xlsx" as const },
      { id: "doc4", title: fr ? "Plan d’action" : "خطة العمل", folder: fr ? "Organisation" : "التنظيم", status: fr ? "À examiner" : "للمراجعة", access: fr ? "Vous" : "أنتم", href: `/${locale}/client/diagnostics${q}`, tone: "peach" as const, kind: "file" as const },
      { id: "doc5", title: fr ? "Note d’information" : "مذكرة إعلام", folder: fr ? "Conformité" : "الامتثال", status: fr ? "Archivé" : "مؤرشف", access: fr ? "Archive interne" : "الأرشيف الداخلي", href: `/${locale}/client/documents${q}`, tone: "sky" as const, kind: "file" as const },
    ],
    inbox: [
      { id: "m1", title: fr ? "Question sur le lancement" : "سؤال حول الإطلاق", meta: fr ? "Demande" : "طلب", href: `/${locale}/messagerie${q}`, tone: "violet" as const, kind: "message" as const },
      { id: "m2", title: fr ? "Planning de mission" : "جدول المهمة", meta: fr ? "Mission" : "مهمة", href: `/${locale}/messagerie${q}`, tone: "peach" as const, kind: "folder" as const },
      { id: "m3", title: fr ? "Document à relire" : "مستند للمراجعة", meta: fr ? "Document" : "وثيقة", href: `/${locale}/messagerie${q}`, tone: "mint" as const, kind: "file" as const },
      { id: "m4", title: fr ? "Précision sur le périmètre" : "توضيح النطاق", meta: fr ? "Demande" : "طلب", href: `/${locale}/messagerie${q}`, tone: "violet" as const, kind: "message" as const },
      { id: "m5", title: fr ? "Livrable à valider" : "تسليم للمصادقة", meta: fr ? "Mission" : "مهمة", href: `/${locale}/messagerie${q}`, tone: "peach" as const, kind: "folder" as const },
      { id: "m6", title: fr ? "Pièce complémentaire" : "وثيقة تكميلية", meta: fr ? "Document" : "وثيقة", href: `/${locale}/messagerie${q}`, tone: "mint" as const, kind: "file" as const },
    ],
    thread: {
      folder: fr ? "Conseil stratégique" : "استشارة استراتيجية",
      status: fr ? "En cours" : "جارٍ",
      type: fr ? "Accompagnement de lancement" : "مواكبة الإطلاق",
      associated: fr ? "Identité de marque" : "هوية العلامة",
      messages: [
        { id: "t1", side: "in" as const, title: fr ? "Question prestataire" : "سؤال مقدم الخدمة", body: fr ? "Nous avons besoin d’une précision sur le périmètre du lancement pour finaliser le planning." : "نحتاج توضيحاً حول نطاق الإطلاق لإنهاء الجدول." },
        { id: "t2", side: "out" as const, title: fr ? "Réponse de l’équipe" : "رد الفريق", body: fr ? "Le périmètre couvre l’identité, les supports de lancement et le suivi des premières livraisons." : "يشمل النطاق الهوية ودعائم الإطلاق ومتابعة التسليمات الأولى." },
        { id: "t3", side: "in" as const, title: fr ? "Suite de l’échange" : "متابعة التبادل", body: fr ? "Merci. Nous ajustons le calendrier et revenons avec la version consolidée." : "شكراً. نعدّل الجدول ونعود بالنسخة الموحّدة." },
        { id: "t4", side: "out" as const, title: fr ? "Validation du cadrage" : "تأكيد التأطير", body: fr ? "Le cadrage est confirmé. Vous pouvez avancer sur le livrable de la semaine." : "تم تأكيد التأطير. يمكنكم التقدم في تسليم الأسبوع." },
      ],
    },
    toHandle: [
      { id: "h1", title: fr ? "Examiner un livrable" : "مراجعة تسليم", href: `/${locale}/client/missions${q}`, action: "examine" as const, tone: "peach" as const },
      { id: "h2", title: fr ? "Confirmer un document" : "تأكيد مستند", href: `/${locale}/client/documents${q}`, action: "confirm" as const, tone: "sky" as const },
      { id: "h3", title: fr ? "Répondre à une demande de pièce" : "الرد على طلب وثيقة", href: `/${locale}/messagerie${q}`, action: "reply" as const, tone: "mint" as const },
    ],
    recentDocuments: [
      { id: "rd1", title: fr ? "Document de référence" : "وثيقة مرجعية", folder: fr ? "Conseil stratégique" : "استشارة استراتيجية", status: fr ? "Partagé" : "مشترك", href: `/${locale}/client/documents${q}`, tone: "mint" as const, kind: "pdf" as const },
      { id: "rd2", title: fr ? "Annexe technique" : "ملحق تقني", folder: fr ? "Transformation digitale" : "التحول الرقمي", status: fr ? "À examiner" : "للمراجعة", href: `/${locale}/client/documents${q}`, tone: "peach" as const, kind: "docx" as const },
      { id: "rd3", title: fr ? "Tableau de synthèse" : "جدول تلخيصي", folder: fr ? "Organisation" : "التنظيم", status: fr ? "Archivé" : "مؤرشف", href: `/${locale}/client/documents${q}`, tone: "sky" as const, kind: "xlsx" as const },
      { id: "rd4", title: fr ? "Pièce complémentaire" : "وثيقة تكميلية", folder: fr ? "Conformité" : "الامتثال", status: fr ? "Partagé" : "مشترك", href: `/${locale}/client/documents${q}`, tone: "mint" as const, kind: "file" as const },
    ],
    finances: [
      { id: "fi1", title: fr ? "Facture" : "فاتورة", folder: fr ? "Déploiement de la marque" : "إطلاق العلامة", status: fr ? "À examiner" : "للمراجعة", next: fr ? "Vérifier le document" : "مراجعة المستند", href: `/${locale}/client/finances${q}`, tone: "peach" as const },
      { id: "fi2", title: fr ? "Devis" : "عرض سعر", folder: fr ? "Conseil stratégique" : "استشارة استراتيجية", status: fr ? "En attente" : "قيد الانتظار", next: fr ? "Suivre l’avancement" : "متابعة التقدم", href: `/${locale}/client/demandes${q}`, tone: "peach" as const },
      { id: "fi3", title: fr ? "Facture" : "فاتورة", folder: fr ? "Abonnement Matricia" : "اشتراك ماتريسيا", status: fr ? "Disponible" : "متاح", next: fr ? "Consulter" : "عرض", href: `/${locale}/client/abonnement${q}`, tone: "mint" as const },
      { id: "fi4", title: fr ? "Avoir" : "إشعار دائن", folder: fr ? "Transformation digitale" : "التحول الرقمي", status: fr ? "En attente" : "قيد الانتظار", next: fr ? "Suivre l’avancement" : "متابعة التقدم", href: `/${locale}/client/finances${q}`, tone: "peach" as const },
      { id: "fi5", title: fr ? "Facture" : "فاتورة", folder: fr ? "Organisation" : "التنظيم", status: fr ? "À examiner" : "للمراجعة", next: fr ? "Vérifier le document" : "مراجعة المستند", href: `/${locale}/client/documents${q}`, tone: "peach" as const },
    ],
    people: [
      { id: "pe1", name: fr ? "Responsable organisation" : "مسؤول المؤسسة", role: fr ? "Administrateur" : "مدير" },
      { id: "pe2", name: fr ? "Référent projets" : "مرجع المشاريع", role: fr ? "Membre" : "عضو" },
      { id: "pe3", name: fr ? "Suivi documents" : "متابعة الوثائق", role: fr ? "Membre" : "عضو" },
    ],
    compareOffers: [
      {
        slot: "a",
        tagline: fr ? "Cadrage, identité et supports de lancement" : "تأطير، هوية ودعائم الإطلاق",
        priceMinor: "2500000",
        taxIncl: false,
        weeks: 4,
        deliverables: fr
          ? ["Diagnostic de conformité", "Plan d’actions priorisé", "Modèles de documents"]
          : ["تشخيص الامتثال", "خطة أعمال ذات أولوية", "نماذج وثائق"],
        exclusions: fr ? ["Audit technique approfondi", "Mise en œuvre des outils"] : ["تدقيق تقني معمق", "تفعيل الأدوات"],
        guarantees: fr ? "Garantie de conformité méthodologique" : "ضمان مطابقة منهجية",
        maintenance: fr ? "1 mois de suivi par mail" : "شهر متابعة عبر البريد",
        payment: fr ? "50 % à la commande, 50 % à la remise des livrables" : "50٪ عند الطلب و50٪ عند تسليم المخرجات",
        why: fr ? "Périmètre clair, délai court et méthode adaptée à une PME." : "نطاق واضح وأجل قصير ومنهج يناسب المقاولة الصغيرة.",
        recommended: false,
      },
      {
        slot: "b",
        tagline: fr ? "Accompagnement complet, organisation et technique" : "مواكبة كاملة تنظيمية وتقنية",
        priceMinor: "3200000",
        taxIncl: false,
        weeks: 6,
        deliverables: fr
          ? ["Diagnostic complet", "Plan d’actions détaillé", "Ateliers direction et équipes", "Accompagnement à la mise en œuvre"]
          : ["تشخيص كامل", "خطة أعمال مفصلة", "ورشات للإدارة والفرق", "مواكبة التفعيل"],
        exclusions: fr ? ["Développements informatiques spécifiques"] : ["تطويرات معلوماتية خاصة"],
        guarantees: fr ? "Garantie de résultat sur la feuille de route" : "ضمان نتيجة على خارطة الطريق",
        maintenance: fr ? "3 mois de suivi (e-mail et visio mensuelle)" : "3 أشهر متابعة (بريد واجتماع مرئي شهري)",
        payment: fr ? "40 % à la commande, 30 % à mi-parcours, 30 % à la livraison" : "40٪ عند الطلب و30٪ في المنتصف و30٪ عند التسليم",
        why: fr ? "Offre la plus complète, avec un accompagnement dans la durée." : "العرض الأكثر اكتمالاً مع مواكبة ممتدة.",
        recommended: true,
      },
      {
        slot: "c",
        tagline: fr ? "Équilibre prix / couverture, exécution définie" : "توازن سعر / تغطية وتنفيذ محدد",
        priceMinor: "2800000",
        taxIncl: true,
        weeks: 5,
        deliverables: fr
          ? ["Diagnostic de conformité", "4 ateliers de sensibilisation", "Modèles de documents", "Support à la mise en œuvre"]
          : ["تشخيص الامتثال", "4 ورشات توعية", "نماذج وثائق", "دعم التفعيل"],
        exclusions: fr ? ["Audit technique approfondi", "Formation avancée des équipes IT"] : ["تدقيق تقني معمق", "تكوين متقدم لفرق المعلوماتية"],
        guarantees: fr ? "Garantie de conformité méthodologique" : "ضمان مطابقة منهجية",
        maintenance: fr ? "2 mois de suivi (e-mail et téléphone)" : "شهران متابعة (بريد وهاتف)",
        payment: fr ? "40 % à la commande, 30 % à mi-parcours, 30 % à la livraison" : "40٪ عند الطلب و30٪ في المنتصف و30٪ عند التسليم",
        why: fr ? "Bon équilibre prix / couverture, avec une équipe dédiée." : "توازن جيد بين السعر والتغطية مع فريق مخصص.",
        recommended: false,
      },
    ],
    disputes: [
      {
        id: "open",
        title: fr ? "Retard de livraison livrables" : "تأخر تسليم المخرجات",
        project: fr ? "Refonte site web" : "تجديد الموقع",
        due: fr ? "12 mai 2026" : "12 مايو 2026",
        status: fr ? "En médiation" : "في الوساطة",
        tone: "violet" as const,
      },
      {
        id: "reply",
        title: fr ? "Qualité non conforme" : "جودة غير مطابقة",
        project: fr ? "Campagne marketing" : "حملة تسويق",
        due: fr ? "18 mai 2026" : "18 مايو 2026",
        status: fr ? "Réponse attendue" : "بانتظار الرد",
        tone: "mint" as const,
      },
      {
        id: "review",
        title: fr ? "Facturation contestée" : "فوترة محل اعتراض",
        project: fr ? "Application mobile" : "تطبيق جوّال",
        due: fr ? "25 mai 2026" : "25 مايو 2026",
        status: fr ? "En cours d’examen" : "قيد المراجعة",
        tone: "sky" as const,
      },
      {
        id: "closed",
        title: fr ? "Résiliation de contrat" : "فسخ العقد",
        project: fr ? "Support technique" : "دعم تقني",
        due: "—",
        status: fr ? "Clôturé" : "مغلق",
        tone: "sky" as const,
      },
    ],
    disputeDetail: {
      title: fr ? "Retard de livraison livrables" : "تأخر تسليم المخرجات",
      project: fr ? "Refonte site web" : "تجديد الموقع",
      provider: fr ? "Prestataire missionné" : "مقدم الخدمة المعيّن",
      stage: fr ? "Échéance de l’étape : 12 mai 2026" : "أجل المرحلة: 12 مايو 2026",
      context: fr
        ? "Le prestataire devait livrer la version finale du site. À ce jour, plusieurs livrables restent manquants et le site n’est pas en ligne."
        : "كان على مقدم الخدمة تسليم النسخة النهائية للموقع. ما تزال عدة مخرجات ناقصة والموقع غير منشور.",
      client: fr
        ? "Les maquettes validées n’ont pas été intégrées et plusieurs fonctionnalités prévues sont absentes. Nous demandons la livraison complète conformément au devis."
        : "لم تُدمج النماذج المصادق عليها وتغيب وظائف متفق عليها. نطلب التسليم الكامل وفق العرض.",
      providerReply: fr
        ? "Certaines fonctionnalités ont pris plus de temps que prévu en raison de contraintes techniques. Nous proposons une livraison échelonnée d’ici fin mai."
        : "استغرقت بعض الوظائف وقتاً أطول بسبب قيود تقنية. نقترح تسليماً مرحلياً قبل نهاية مايو.",
      files: [
        { id: "e1", title: fr ? "Maquettes validées.pdf" : "النماذج المصادق عليها.pdf", by: fr ? "Par l’équipe cliente" : "من فريق العميل", href: `/${locale}/client/documents${q}` },
        { id: "e2", title: fr ? "Planning initial.xlsx" : "الجدول الأولي.xlsx", by: fr ? "Par l’équipe cliente" : "من فريق العميل", href: `/${locale}/client/documents${q}` },
        { id: "e3", title: fr ? "Échanges mars — 2026.pdf" : "المراسلات مارس 2026.pdf", by: fr ? "Par le prestataire" : "من مقدم الخدمة", href: `/${locale}/client/documents${q}` },
      ],
      mediation: [
        { id: "m1", title: fr ? "Litige ouvert" : "فُتح النزاع", date: fr ? "2 mai 2026" : "2 مايو 2026", state: "done" as const },
        { id: "m2", title: fr ? "Accusé de réception" : "إقرار الاستلام", date: fr ? "3 mai 2026" : "3 مايو 2026", state: "done" as const },
        { id: "m3", title: fr ? "Analyse en cours par l’équipe de médiation" : "تحليل جارٍ لدى فريق الوساطة", date: fr ? "6 mai 2026" : "6 مايو 2026", state: "current" as const },
        { id: "m4", title: fr ? "Demande d’éléments complémentaires" : "طلب عناصر تكميلية", date: fr ? "À venir" : "لاحقاً", state: "todo" as const },
        { id: "m5", title: fr ? "Proposition de solution" : "اقتراح الحل", date: fr ? "À venir" : "لاحقاً", state: "todo" as const },
        { id: "m6", title: fr ? "Clôture du litige" : "إغلاق النزاع", date: fr ? "À venir" : "لاحقاً", state: "todo" as const },
      ],
      nextLead: fr
        ? "Vous pouvez soumettre des éléments complémentaires ou répondre à la proposition du prestataire."
        : "يمكنكم إرسال عناصر تكميلية أو الرد على مقترح مقدم الخدمة.",
    },
    jalons: [
      { id: "j1", title: fr ? "Diagnostic initial" : "التشخيص الأولي", due: fr ? "15 mars 2026" : "15 مارس 2026", status: fr ? "Validé" : "مصادق", state: "done" as const },
      { id: "j2", title: fr ? "Plan d’action" : "خطة العمل", due: fr ? "30 avril 2026" : "30 أبريل 2026", status: fr ? "En revue" : "قيد المراجعة", state: "current" as const },
      { id: "j3", title: fr ? "Mise en œuvre pilote" : "تفعيل تجريبي", due: fr ? "30 juin 2026" : "30 يونيو 2026", status: fr ? "À venir" : "لاحقاً", state: "todo" as const },
      { id: "j4", title: fr ? "Évaluation intermédiaire" : "تقييم وسيط", due: fr ? "31 août 2026" : "31 أغسطس 2026", status: fr ? "À venir" : "لاحقاً", state: "todo" as const },
      { id: "j5", title: fr ? "Clôture et transfert" : "الإغلاق والتحويل", due: fr ? "30 septembre 2026" : "30 سبتمبر 2026", status: fr ? "À venir" : "لاحقاً", state: "todo" as const },
    ],
    jalonFiles: [
      { id: "jf1", title: fr ? "Plan d’action détaillé" : "خطة العمل المفصلة", file: fr ? "Plan_action.pdf" : "خطة_العمل.pdf", kind: "pdf" as const, scan: "ok" as const, href: `/${locale}/client/documents${q}` },
      { id: "jf2", title: fr ? "Budget estimatif" : "الميزانية التقديرية", file: fr ? "Budget.xlsx" : "الميزانية.xlsx", kind: "xlsx" as const, scan: "ok" as const, href: `/${locale}/client/documents${q}` },
    ],
  };
}
