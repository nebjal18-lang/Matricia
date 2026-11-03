import type { Locale } from "@/modules/shared/lib/i18n/locale";

const fr = {
  title: "Diagnostics et opportunités", intro: "Le diagnostic suit la chaîne du cahier des charges : réponse, règle, anomalie, risque, recommandation, service, opportunité.",
  publishedPolicyRequired:"Ce bilan ne possède pas encore d’évaluation finale des règles de calcul publiées, ou leur configuration doit être complétée. Vos réponses sont conservées ; Matricia doit vérifier ce périmètre.", prepareTitle: "Préparer mon analyse", prepareDescription: "Matricia reprend automatiquement votre dernier bilan soumis et les règles publiées de son périmètre.", noSubmittedAssessment: "Aucun bilan soumis n’est disponible. Commencez ou terminez d’abord votre questionnaire.", analysisScopeRequired: "Choisissez un service publié dans le périmètre de ce bilan. Si aucun choix n’est disponible, votre travail est conservé ; réessayez ou contactez l’assistance.", calculating: "Analyse en cours…", complete: "Actualiser mon analyse", confirmAnalysis: "Je confirme l’actualisation de mon analyse",
  session: "Bilan source", service: "Solution associée", runs: "Mes analyses disponibles", empty: "Aucune analyse calculée.", view: "Voir mon analyse", back: "Retour", score: "Santé globale",
  snapshot: "Détails de calcul", snapshotIntro: "Les informations techniques sont conservées pour expliquer et reproduire le résultat.", technicalDetails: "Afficher les références techniques", current: "Analyse actuelle", superseded: "Analyse antérieure", library: "Périmètre évalué", inputManifest: "Version des réponses", policyVersion: "Méthode d’analyse", policyHash: "Version de la méthode", questionnaireVersion: "Version du bilan", formula: "Méthode", completedAt: "Analysé le",
  weightedPoints: "Points calculés", maximumPoints: "Maximum du calcul", explanation: "Explication", anomalyCode: "Référence du constat", findingStatus: "État du constat", ruleSnapshot: "Règle appliquée", whyOpportunity: "Pourquoi cette priorité existe", linkedFinding: "Constat source lié", solutionLevel: "Niveau de solution", serviceUnavailable: "Solution indisponible", knownData: "Informations confirmées", missingFields: "Informations à compléter", none: "Aucune", createdRequest: "Demande préparée", humanDecision: "Aucune prestation ni dépense n’est déclenchée automatiquement. Vous gardez la décision de préparer puis soumettre la demande.",
  recalculationNote: "L’actualisation conserve l’ancien résultat et utilise les réponses confirmées et les règles conservées avec ce bilan.", completeRequired: "Complétez les informations manquantes avant de préparer la demande.", continueRfq: "Continuer vers le brouillon de demande", subscores: "Détail par thème", anomalies: "Points d’attention", recommendations: "Recommandations", opportunities: "Priorités d’action", blocking: "Action requise", priority: "Priorité", accept: "Accepter", defer: "Reporter", requestRfq: "Préparer une demande de devis", close: "Clore", deferUntil: "Reporter jusqu’au", success: "Action enregistrée et auditée.", error: "Action impossible ou non autorisée.", validation: "Vérifiez les champs.", noFinding: "Aucun point d’attention détecté dans le périmètre évalué.",
  statuses: { DETECTED: "Détectée", CLIENT_ACCEPTED: "Acceptée", RFQ_READY: "Prête pour devis", CONVERTED: "Convertie", CLOSED: "Close" }, ratings: { GOOD: "Bon", ATTENTION: "À surveiller", IMPORTANT: "Important", CRITICAL: "Critique" },
  solutionLevels: { GUIDANCE: "Conseil", ASSISTED: "Accompagné", MANAGED: "Piloté" },
  compareSolutions: "Comparer Essentielle, Standard et Avancée pour ce constat",
  noRecommendation: "Aucune recommandation publiée pour ce constat.",
  evolutionNow: "Évolution de ce bilan",
  firstRun: "Premier bilan de ce périmètre",
  previousDelta: "Écart depuis le bilan précédent",
  openSolutions: "Voir les trois niveaux de solution",
  expiredOnBilan: "réponse(s) expirée(s) à revalider dans le questionnaire",
  expiringOnBilan: "réponse(s) arriveront à expiration",
};

const ar: typeof fr = {
  ...fr,
  title: "التشخيصات والفرص", intro: "يتبع التشخيص سلسلة دفتر التحملات: إجابة، قاعدة، اختلال، خطر، توصية، خدمة، فرصة.",
  publishedPolicyRequired:"لا يتوفر لهذا التقييم بعد احتساب نهائي قائم على قواعد منشورة، أو يجب استكمال إعدادها. إجاباتكم محفوظة؛ يجب أن تتحقق ماتريسيا من هذا النطاق.", prepareTitle: "إعداد تحليلي", prepareDescription: "تسترجع ماتريسيا تلقائيا آخر تقييم مكتمل والقواعد المنشورة ضمن نطاقه.", noSubmittedAssessment: "لا يوجد تقييم مكتمل. ابدأ الاستبيان أو أكمله أولا.", analysisScopeRequired: "اختاروا خدمة منشورة ضمن نطاق هذا التقييم. إذا لم تتوفر خيارات، يبقى عملكم محفوظاً؛ حاولوا مجدداً أو تواصلوا مع الدعم.", calculating: "جارٍ التحليل…", complete: "تحديث تحليلي", confirmAnalysis: "أؤكد تحديث تحليلي",
  session: "التقييم المصدر", service: "الحل المرتبط", runs: "تحليلاتي المتاحة", empty: "لا يوجد تحليل محسوب.", view: "عرض تحليلي", back: "رجوع", score: "الصحة العامة", snapshot: "تفاصيل الحساب", snapshotIntro: "تُحفظ المعلومات التقنية لشرح النتيجة وإعادة إنتاجها.", technicalDetails: "عرض المراجع التقنية", current: "التحليل الحالي", superseded: "تحليل سابق", library: "النطاق المقيم", inputManifest: "نسخة الإجابات", policyVersion: "منهج التحليل", policyHash: "نسخة المنهج", questionnaireVersion: "نسخة التقييم", formula: "المنهج", completedAt: "تاريخ التحليل",
  weightedPoints: "النقاط المحسوبة", maximumPoints: "الحد الأقصى للحساب", explanation: "التفسير", anomalyCode: "مرجع الملاحظة", findingStatus: "حالة الملاحظة", ruleSnapshot: "القاعدة المطبقة", whyOpportunity: "سبب وجود هذه الأولوية", linkedFinding: "الملاحظة المصدر", solutionLevel: "مستوى الحل", serviceUnavailable: "الحل غير متاح", knownData: "المعلومات المؤكدة", missingFields: "المعلومات المطلوبة", none: "لا يوجد", createdRequest: "الطلب المحضر", humanDecision: "لا يتم تشغيل أي خدمة أو نفقة تلقائيا. يبقى قرار إعداد الطلب ثم إرساله بيدك.",
  recalculationNote: "يحفظ التحديث النتيجة السابقة ويستخدم الإجابات المؤكدة والقواعد المحفوظة مع هذا التقييم.", completeRequired: "أكمل المعلومات الناقصة قبل إعداد الطلب.", continueRfq: "المتابعة إلى مسودة الطلب", subscores: "التفصيل حسب المحور", anomalies: "نقاط الانتباه", recommendations: "التوصيات", opportunities: "أولويات العمل", blocking: "إجراء مطلوب", priority: "الأولوية", accept: "قبول", defer: "تأجيل", requestRfq: "إعداد طلب عروض", close: "إغلاق", deferUntil: "تأجيل إلى", success: "تم تسجيل الإجراء وتدقيقه.", error: "تعذر الإجراء أو غير مسموح به.", validation: "تحقق من الحقول.", noFinding: "لم يتم رصد نقطة انتباه في النطاق المقيم.",
  statuses: { DETECTED: "مكتشفة", CLIENT_ACCEPTED: "مقبولة", RFQ_READY: "جاهزة للعروض", CONVERTED: "محولة", CLOSED: "مغلقة" }, ratings: { GOOD: "جيد", ATTENTION: "يتطلب المتابعة", IMPORTANT: "مهم", CRITICAL: "حرج" },
  solutionLevels: { GUIDANCE: "إرشاد", ASSISTED: "مرافقة", MANAGED: "تسيير" },
  compareSolutions: "مقارنة الأساسية والقياسية والمتقدمة لهذه الملاحظة",
  noRecommendation: "لا توجد توصية منشورة لهذه الملاحظة.",
  evolutionNow: "تطور هذا التحليل",
  firstRun: "أول تحليل لهذا النطاق",
  previousDelta: "الفرق منذ التحليل السابق",
  openSolutions: "عرض مستويات الحل الثلاثة",
  expiredOnBilan: "إجابة منتهية يجب إعادة تأكيدها في الاستبيان",
  expiringOnBilan: "إجابة ستنتهي صلاحيتها",
};

export type Messages = typeof fr;
export function messages(locale: Locale): Messages { return locale === "ar" ? ar : fr; }
