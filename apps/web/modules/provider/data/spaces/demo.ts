import type { Locale } from "@/modules/shared/lib/i18n/locale";

export function canApplyProviderSpaceDemo() {
  return false;
}

export function demoProviderSpaces(locale: Locale, query: string) {
  const fr = locale === "fr";
  const q = query;
  return {
    treat: [
      { id: "t1", title: fr ? "Répondre à une consultation" : "الرد على استشارة", badge: fr ? "Nouvelle" : "جديدة", detail: fr ? "Consultation compatible avec votre qualification" : "استشارة متوافقة مع تأهيلكم", href: `/${locale}/sous-traitant/consultations/cr1${q}`, tone: "sky" as const },
      { id: "t2", title: fr ? "Finaliser un devis" : "إنهاء عرض سعر", badge: fr ? "À finaliser" : "للإنهاء", detail: fr ? "Reprendre le brouillon avant soumission" : "استئناف المسودة قبل الإرسال", href: `/${locale}/sous-traitant/devis/d1${q}`, tone: "peach" as const },
      { id: "t3", title: fr ? "Ajouter une pièce demandée" : "إضافة وثيقة مطلوبة", badge: fr ? "Pièce demandée" : "وثيقة مطلوبة", detail: fr ? "Compléter le dossier de qualification" : "استكمال ملف التأهيل", href: `/${locale}/sous-traitant/documents${q}`, tone: "mint" as const },
      { id: "t4", title: fr ? "Préparer un livrable" : "تحضير تسليم", badge: fr ? "À préparer" : "للتحضير", detail: fr ? "Mission en cours — dépôt attendu" : "مهمة جارية — إيداع متوقع", href: `/${locale}/sous-traitant/missions/m1${q}`, tone: "violet" as const },
    ],
    journey: [
      { id: "j1", title: fr ? "Profil" : "الملف", detail: fr ? "Informations de base" : "المعلومات الأساسية", state: "done" as const },
      { id: "j2", title: fr ? "Qualification" : "التأهيل", detail: fr ? "En cours" : "جارٍ", state: "current" as const },
      { id: "j3", title: fr ? "Opportunités" : "الفرص", detail: fr ? "À venir" : "قادمة", state: "todo" as const },
      { id: "j4", title: fr ? "Devis" : "العروض", detail: fr ? "À venir" : "قادمة", state: "todo" as const },
      { id: "j5", title: fr ? "Missions" : "المهام", detail: fr ? "À venir" : "قادمة", state: "todo" as const },
      { id: "j6", title: fr ? "Réputation" : "السمعة", detail: fr ? "À venir" : "قادمة", state: "todo" as const },
    ],
    consultations: [
      { id: "c1", title: fr ? "Prestation de service" : "تقديم خدمة", status: fr ? "Nouvelle" : "جديدة", href: `/${locale}/sous-traitant/consultations/cr1${q}`, tone: "violet" as const },
      { id: "c2", title: fr ? "Étude ou conseil" : "دراسة أو استشارة", status: fr ? "En cours" : "جارٍ", href: `/${locale}/sous-traitant/consultations/cr2${q}`, tone: "sky" as const },
      { id: "c3", title: fr ? "Fourniture d’équipement" : "توريد تجهيز", status: fr ? "Nouvelle" : "جديدة", href: `/${locale}/sous-traitant/consultations/cr3${q}`, tone: "violet" as const },
      { id: "c4", title: fr ? "Maintenance et support" : "صيانة ودعم", status: fr ? "À venir" : "قادمة", href: `/${locale}/sous-traitant/consultations/cr5${q}`, tone: "peach" as const },
    ],
    consultRows: [
      { id: "cr1", title: fr ? "Appui et conseil" : "دعم واستشارة", scope: fr ? "Cadrage organisationnel" : "تأطير تنظيمي", deadline: fr ? "Sous 5 jours" : "خلال 5 أيام", status: fr ? "À répondre" : "للرد", tone: "peach" as const, href: `/${locale}/sous-traitant/consultations/cr1${q}` },
      { id: "cr2", title: fr ? "Étude et analyse" : "دراسة وتحليل", scope: fr ? "Diagnostic de lancement" : "تشخيص الإطلاق", deadline: fr ? "Sous 8 jours" : "خلال 8 أيام", status: fr ? "En préparation" : "قيد الإعداد", tone: "sky" as const, href: `/${locale}/sous-traitant/devis/d1${q}` },
      { id: "cr3", title: fr ? "Mise en œuvre" : "تنفيذ", scope: fr ? "Identité et supports" : "هوية ودعائم", deadline: fr ? "Sous 12 jours" : "خلال 12 يوماً", status: fr ? "À répondre" : "للرد", tone: "peach" as const, href: `/${locale}/sous-traitant/consultations/cr3${q}` },
      { id: "cr4", title: fr ? "Formation et renforcement" : "تكوين وتعزيز", scope: fr ? "Transfert d’équipe" : "نقل للفريق", deadline: fr ? "Clos" : "مغلق", status: fr ? "Terminée" : "منتهية", tone: "mint" as const, href: `/${locale}/sous-traitant/consultations/cr4${q}` },
      { id: "cr5", title: fr ? "Assistance technique" : "مساعدة تقنية", scope: fr ? "Support de déploiement" : "دعم الإطلاق", deadline: fr ? "Sous 10 jours" : "خلال 10 أيام", status: fr ? "En préparation" : "قيد الإعداد", tone: "sky" as const, href: `/${locale}/sous-traitant/devis/d2${q}` },
    ],
    capacity: {
      status: fr ? "Ouvert aux opportunités" : "مفتوح للفرص",
      domains: fr ? "Communication, organisation, digital" : "تواصل، تنظيم، رقمي",
      zones: fr ? "Casablanca, Rabat, à distance" : "الدار البيضاء، الرباط، عن بُعد",
    },
    checklist: [
      { id: "q1", title: fr ? "Informations de l’activité" : "معلومات النشاط", status: fr ? "À compléter" : "للإستكمال", tone: "peach" as const, href: `/${locale}/sous-traitant/qualification${q}#profil`, action: "complete" as const },
      { id: "q2", title: fr ? "Services déclarés" : "الخدمات المصرّح بها", status: fr ? "Transmis" : "مُرسل", tone: "mint" as const, href: `/${locale}/sous-traitant/services${q}`, action: "open" as const },
      { id: "q3", title: fr ? "Capacité" : "القدرة", status: fr ? "À compléter" : "للإستكمال", tone: "peach" as const, href: `/${locale}/sous-traitant/services${q}`, action: "complete" as const },
      { id: "q4", title: fr ? "Documents requis" : "الوثائق المطلوبة", status: fr ? "Transmis" : "مُرسل", tone: "mint" as const, href: `/${locale}/sous-traitant/documents${q}`, action: "open" as const },
      { id: "q5", title: fr ? "Décision et raisonnement" : "القرار والتعليل", status: fr ? "À examiner" : "للمراجعة", tone: "violet" as const, href: `/${locale}/sous-traitant/qualification${q}`, action: "open" as const },
    ],
    verified: [
      fr ? "Identité et informations de l’entreprise" : "هوية ومعلومات المؤسسة",
      fr ? "Documents et pièces justificatives" : "وثائق وإثباتات",
      fr ? "Services déclarés" : "الخدمات المصرّح بها",
      fr ? "Capacité" : "القدرة",
      fr ? "Règles applicables" : "القواعد المعمول بها",
    ],
    history: [
      { id: "h1", title: fr ? "Version du dossier" : "نسخة الملف", detail: fr ? "Dossier transmis pour examen" : "أُرسل الملف للمراجعة" },
      { id: "h2", title: fr ? "Décision" : "القرار", detail: fr ? "Examen en cours, décision communiquée ensuite" : "المراجعة جارية ثم يُبلَّغ القرار" },
      { id: "h3", title: fr ? "Mise à jour" : "تحديث", detail: fr ? "Dossier mis à jour" : "تم تحديث الملف" },
    ],
    services: [
      { id: "sv1", domain: fr ? "Conseil et organisation" : "استشارة وتنظيم", items: [
        { id: "s1", title: fr ? "Appui stratégique" : "دعم استراتيجي", path: fr ? "Conseil → Organisation → Appui" : "استشارة → تنظيم → دعم" },
        { id: "s2", title: fr ? "Cadrage de process" : "تأطير المساطر", path: fr ? "Conseil → Organisation → Process" : "استشارة → تنظيم → مساطر" },
      ] },
      { id: "sv2", domain: fr ? "Communication et marque" : "تواصل وعلامة", items: [
        { id: "s3", title: fr ? "Identité de marque" : "هوية العلامة", path: fr ? "Communication → Marque → Identité" : "تواصل → علامة → هوية" },
      ] },
    ],
    quotes: [
      { id: "d1", title: fr ? "Appui stratégique" : "دعم استراتيجي", scope: fr ? "Cadrage et plan d’action" : "تأطير وخطة عمل", status: fr ? "Brouillon" : "مسودة", next: fr ? "Compléter les lignes" : "استكمال البنود", action: fr ? "Reprendre" : "استئناف", tone: "violet" as const, href: `/${locale}/sous-traitant/devis/d1${q}` },
      { id: "d2", title: fr ? "Identité de marque" : "هوية العلامة", scope: fr ? "Charte et supports" : "ميثاق ودعائم", status: fr ? "À soumettre" : "للإرسال", next: fr ? "Relire avant envoi" : "مراجعة قبل الإرسال", action: fr ? "Ouvrir" : "فتح", tone: "peach" as const, href: `/${locale}/sous-traitant/devis/d2/revision${q}` },
      { id: "d3", title: fr ? "Déploiement digital" : "إطلاق رقمي", scope: fr ? "Parcours et outils" : "مسارات وأدوات", status: fr ? "Soumis" : "مُرسل", next: fr ? "Attendre le retour" : "انتظار الرد", action: fr ? "Voir la version" : "عرض النسخة", tone: "sky" as const, href: `/${locale}/sous-traitant/devis/d3${q}` },
      { id: "d4", title: fr ? "Formation équipe" : "تكوين الفريق", scope: fr ? "Transfert et ateliers" : "نقل وورش", status: fr ? "À réviser" : "للمراجعة", next: fr ? "Ajuster le périmètre" : "تعديل النطاق", action: fr ? "Ouvrir" : "فتح", tone: "peach" as const, href: `/${locale}/sous-traitant/devis/d4/revision${q}` },
      { id: "d5", title: fr ? "Support de lancement" : "دعم الإطلاق", scope: fr ? "Accompagnement 30 jours" : "مواكبة 30 يوماً", status: fr ? "Terminé" : "منتهٍ", next: fr ? "Archivé" : "مؤرشف", action: fr ? "Voir la version" : "عرض النسخة", tone: "mint" as const, href: `/${locale}/sous-traitant/devis/d5${q}` },
    ],
    missions: [
      { id: "m1", title: fr ? "Accompagnement stratégique" : "مواكبة استراتيجية", status: fr ? "À préparer" : "للتحضير", next: fr ? "Compléter le plan d’exécution" : "استكمال خطة التنفيذ", tone: "violet" as const, href: `/${locale}/sous-traitant/missions/m1${q}` },
      { id: "m2", title: fr ? "Étude et recommandations" : "دراسة وتوصيات", status: fr ? "En cours" : "جارٍ", next: fr ? "Finaliser la version intermédiaire" : "إنهاء النسخة الوسيطة", tone: "mint" as const, href: `/${locale}/sous-traitant/missions/m2${q}` },
      { id: "m3", title: fr ? "Mise en place d’un dispositif" : "إرساء منظومة", status: fr ? "Livrable transmis" : "تسليم مُرسل", next: fr ? "Attente de retour du client" : "بانتظار رد العميل", tone: "sky" as const, href: `/${locale}/sous-traitant/missions/m3${q}` },
      { id: "m4", title: fr ? "Formation et transfert" : "تكوين ونقل", status: fr ? "Validation attendue" : "بانتظار المصادقة", next: fr ? "Répondre au commentaire" : "الرد على التعليق", tone: "peach" as const, href: `/${locale}/sous-traitant/missions/m4${q}` },
    ],
    missionSteps: [
      { id: "ms1", title: fr ? "Contrat" : "العقد", detail: fr ? "Cadre et conditions validés" : "الإطار والشروط مصادق عليها", state: "done" as const },
      { id: "ms2", title: fr ? "Mission" : "المهمة", detail: fr ? "Exécution en cours" : "التنفيذ جارٍ", state: "current" as const },
      { id: "ms3", title: fr ? "Jalons" : "المراحل", detail: fr ? "Suivi des étapes clés" : "متابعة المراحل الأساسية", state: "todo" as const },
      { id: "ms4", title: fr ? "Livrables" : "التسليمات", detail: fr ? "Dépôt des preuves et fichiers" : "إيداع الأدلة والملفات", state: "todo" as const },
      { id: "ms5", title: fr ? "Validation" : "المصادقة", detail: fr ? "Revue et acceptation par le client" : "مراجعة وقبول العميل", state: "todo" as const },
      { id: "ms6", title: fr ? "Clôture" : "الإغلاق", detail: fr ? "Fin de mission et archivage" : "نهاية المهمة والأرشفة", state: "todo" as const },
    ],
    documents: [
      { id: "doc1", title: fr ? "Extrait d’immatriculation" : "مستخرج التسجيل", use: fr ? "Qualification" : "تأهيل", status: fr ? "À compléter" : "للإستكمال", access: fr ? "Privé" : "خاص", tone: "peach" as const },
      { id: "doc2", title: fr ? "Attestation fiscale" : "شهادة جبائية", use: fr ? "Qualification" : "تأهيل", status: fr ? "Transmis" : "مُرسل", access: fr ? "Restreint" : "مقيّد", tone: "mint" as const },
      { id: "doc3", title: fr ? "Attestation de vigilance" : "شهادة يقظة", use: fr ? "Qualification" : "تأهيل", status: fr ? "À examiner" : "للمراجعة", access: fr ? "Restreint" : "مقيّد", tone: "peach" as const },
      { id: "doc4", title: fr ? "Assurance responsabilité civile" : "تأمين المسؤولية المدنية", use: fr ? "Qualification" : "تأهيل", status: fr ? "Disponible" : "متاح", access: fr ? "Restreint" : "مقيّد", tone: "mint" as const },
      { id: "doc5", title: fr ? "Références / réalisations" : "مراجع / إنجازات", use: fr ? "Missions" : "مهام", status: fr ? "Disponible" : "متاح", access: fr ? "Restreint" : "مقيّد", tone: "mint" as const },
      { id: "doc6", title: fr ? "Proposition technique type" : "عرض تقني نموذجي", use: fr ? "Missions" : "مهام", status: fr ? "Transmis" : "مُرسل", access: fr ? "Privé" : "خاص", tone: "sky" as const },
      { id: "doc7", title: fr ? "Modèle de devis" : "نموذج عرض سعر", use: fr ? "Facturation" : "فوترة", status: fr ? "Disponible" : "متاح", access: fr ? "Privé" : "خاص", tone: "mint" as const },
      { id: "doc8", title: fr ? "RIB" : "RIB", use: fr ? "Facturation" : "فوترة", status: fr ? "À compléter" : "للإستكمال", access: fr ? "Privé" : "خاص", tone: "peach" as const },
    ],
    renew: [
      fr ? "Justificatif d’identité" : "إثبات الهوية",
      fr ? "Extrait d’immatriculation" : "مستخرج التسجيل",
      fr ? "Attestation fiscale" : "شهادة جبائية",
      fr ? "Attestation de vigilance" : "شهادة يقظة",
      fr ? "Assurance responsabilité civile" : "تأمين المسؤولية المدنية",
    ],
    invoices: [
      { id: "i1", title: fr ? "Facture — acompte mission" : "فاتورة — تسبيق المهمة", mission: fr ? "Accompagnement stratégique" : "مواكبة استراتيجية", status: fr ? "Brouillon" : "مسودة", next: fr ? "Compléter les informations" : "استكمال المعلومات", action: fr ? "Continuer" : "متابعة", tone: "violet" as const },
      { id: "i2", title: fr ? "Facture — jalon 1" : "فاتورة — مرحلة 1", mission: fr ? "Étude et recommandations" : "دراسة وتوصيات", status: fr ? "À transmettre" : "للإرسال", next: fr ? "Transmettre le document" : "إرسال المستند", action: fr ? "Transmettre" : "إرسال", tone: "peach" as const },
      { id: "i3", title: fr ? "Facture — solde" : "فاتورة — الرصيد", mission: fr ? "Mise en place d’un dispositif" : "إرساء منظومة", status: fr ? "En cours de traitement" : "قيد المعالجة", next: fr ? "Aucune action requise" : "لا إجراء مطلوب", action: fr ? "Voir" : "عرض", tone: "sky" as const },
      { id: "i4", title: fr ? "Avoir — ajustement" : "إشعار دائن — تعديل", mission: fr ? "Formation et transfert" : "تكوين ونقل", status: fr ? "Disponible" : "متاح", next: fr ? "Consulter ou télécharger" : "عرض أو تنزيل", action: fr ? "Ouvrir" : "فتح", tone: "mint" as const },
      { id: "i5", title: fr ? "Facture — plateforme" : "فاتورة — المنصة", mission: fr ? "Abonnement prestataire" : "اشتراك مقدم الخدمة", status: fr ? "Brouillon" : "مسودة", next: fr ? "Compléter les informations" : "استكمال المعلومات", action: fr ? "Continuer" : "متابعة", tone: "violet" as const },
    ],
    reconcil: [
      { id: "r1", title: fr ? "Facture — jalon 1" : "فاتورة — مرحلة 1", mission: fr ? "Étude et recommandations" : "دراسة وتوصيات", rec: fr ? "En cours" : "جارٍ", pay: fr ? "En cours" : "جارٍ", next: fr ? "Aucune action requise" : "لا إجراء مطلوب" },
      { id: "r2", title: fr ? "Facture — acompte" : "فاتورة — تسبيق", mission: fr ? "Accompagnement stratégique" : "مواكبة استراتيجية", rec: fr ? "À rapprocher" : "للمطابقة", pay: fr ? "En attente" : "قيد الانتظار", next: fr ? "Vérifier les éléments" : "مراجعة العناصر" },
    ],
    reviews: [
      { id: "rv1", title: fr ? "Mission clôturée — accompagnement" : "مهمة مغلقة — مواكبة", status: fr ? "Mission vérifiée" : "مهمة محققة", tone: "mint" as const, action: "see" as const },
      { id: "rv2", title: fr ? "Évaluation demandée — étude" : "تقييم مطلوب — دراسة", status: fr ? "En attente de publication" : "بانتظار النشر", tone: "peach" as const, action: "see" as const },
      { id: "rv3", title: fr ? "Retour à préciser — formation" : "رأي للتوضيح — تكوين", status: fr ? "Réponse possible" : "يمكن الرد", tone: "mint" as const, action: "reply" as const },
      { id: "rv4", title: fr ? "Mission clôturée — dispositif" : "مهمة مغلقة — منظومة", status: fr ? "Mission vérifiée" : "مهمة محققة", tone: "mint" as const, action: "see" as const },
    ],
    badges: [
      { id: "b1", title: fr ? "Partenaire fiable" : "شريك موثوق", detail: fr ? "Attribué selon des règles précises" : "يُمنح وفق قواعد محددة" },
      { id: "b2", title: fr ? "Qualité des livrables" : "جودة التسليمات", detail: fr ? "Basé sur des retours vérifiés" : "يستند إلى آراء محققة" },
      { id: "b3", title: fr ? "Collaboration" : "التعاون", detail: fr ? "Reflète la qualité des échanges" : "يعكس جودة التبادلات" },
    ],
  };
}
