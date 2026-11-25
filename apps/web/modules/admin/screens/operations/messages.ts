import type { Locale } from "@/modules/shared/lib/i18n/locale";

const fr = {
  eyebrow: "Administration centrale", title: "Notifications, audit et file d’événements", description: "Supervision des services, reprises et remboursements autorisés. Les contenus de notification et les détails destinataire restent privés.",
  back: "Tableau de bord", language: "العربية", forbidden: "Accès réservé", forbiddenText: "Un rôle Super Admin, Admin Matricia, Finance ou Auditeur en lecture seule est requis.", unavailable: "Supervision indisponible", unavailableText: "La lecture a échoué de manière fermée. Aucun périmètre supplémentaire n’a été ouvert.",
  safetyTitle: "Périmètre de sécurité", safetyText: "Les reprises exigent une demande motivée, puis un autre administrateur avec second facteur. Les détails destinataire restent privés.",
  audit: "Journal d’audit expurgé", auditedEvents: "Événements audités", systemEvents: "Événements système/service", notificationSignals: "Signaux notification", deadLetterSignals: "Échecs définitifs à traiter", outboxSignals: "Signaux file d’événements", latestEvents: "Événements récents", noEvents: "Aucun événement autorisé n’est visible.",
  outbox: "File d’événements et reprises", deliveries: "Livraisons de notifications", projectionUnavailable: "Lecture sécurisée indisponible", projectionText: "Les lectures actuelles ne permettent pas cet affichage à un administrateur sans contourner les droits d’accès. Le contenu et les données destinataire restent masqués.",
  action: "Action", resource: "Type de ressource", actor: "Acteur", occurredAt: "Horodatage", correlation: "Référence de suivi", integrity: "Empreinte d’intégrité", signal: "Signal", general: "Général", notification: "Notification", deadLetter: "Échec définitif", outboxSignal: "File d’événements", readOnly: "Lecture seule",
};

const ar: typeof fr = {
  eyebrow: "الإدارة المركزية", title: "الإشعارات والتدقيق وطابور الأحداث", description: "مراقبة الخدمات وإعادة المحاولة والاسترداد المصرح بها. تظل محتويات الإشعارات وتفاصيل المستلم خاصة.",
  back: "لوحة القيادة", language: "Français", forbidden: "وصول مقيّد", forbiddenText: "يلزم دور مدير أعلى أو مدير Matricia أو مسؤول مالي أو مدقق للقراءة فقط.", unavailable: "الإشراف غير متاح", unavailableText: "فشلت القراءة بشكل مغلق ولم يتم فتح أي نطاق إضافي.",
  safetyTitle: "نطاق الأمان", safetyText: "تتطلب إعادة المحاولة طلباً معللاً وموافقة مدير آخر بمصادقة معززة. تظل تفاصيل المستلم خاصة.",
  audit: "سجل تدقيق منقح", auditedEvents: "الأحداث المدققة", systemEvents: "أحداث النظام والخدمة", notificationSignals: "إشارات الإشعارات", deadLetterSignals: "إخفاقات نهائية للمعالجة", outboxSignals: "إشارات طابور الأحداث", latestEvents: "الأحداث الأخيرة", noEvents: "لا توجد أحداث مسموحة ظاهرة.",
  outbox: "طابور الأحداث وإعادة المحاولة", deliveries: "تسليم الإشعارات", projectionUnavailable: "قراءة آمنة غير متاحة", projectionText: "لا تسمح القراءات الحالية بهذا العرض للمدير دون تجاوز حقوق الوصول. يظل المحتوى وبيانات المستلم محجوبين.",
  action: "الإجراء", resource: "نوع المورد", actor: "الفاعل", occurredAt: "التوقيت", correlation: "مرجع المتابعة", integrity: "بصمة السلامة", signal: "الإشارة", general: "عام", notification: "إشعار", deadLetter: "إخفاق نهائي", outboxSignal: "طابور الأحداث", readOnly: "للقراءة فقط",
};

export type AdminOperationsMessages = typeof fr;
export function getAdminOperationsMessages(locale: Locale): AdminOperationsMessages { return locale === "ar" ? ar : fr; }
