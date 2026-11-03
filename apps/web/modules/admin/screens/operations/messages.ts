import type { Locale } from "@/modules/shared/lib/i18n/locale";

const fr = {
  eyebrow: "Administration centrale", title: "Notifications, audit et Outbox", description: "Supervision des services, reprises et remboursements autorisés. Les contenus de notification et payloads restent privés.",
  back: "Tableau de bord", language: "العربية", forbidden: "Accès réservé", forbiddenText: "Un rôle Super Admin, Admin Matricia, Finance ou Auditeur en lecture seule est requis.", unavailable: "Supervision indisponible", unavailableText: "La lecture a échoué de manière fermée. Aucun périmètre supplémentaire n’a été ouvert.",
  safetyTitle: "Périmètre de sécurité", safetyText: "Les reprises exigent une demande motivée, puis un autre administrateur en authentification renforcée. Les payloads restent privés.",
  audit: "Journal d’audit expurgé", auditedEvents: "Événements audités", systemEvents: "Événements système/service", notificationSignals: "Signaux notification", deadLetterSignals: "Signaux dead-letter", outboxSignals: "Signaux Outbox", latestEvents: "Événements récents", noEvents: "Aucun événement autorisé n’est visible.",
  outbox: "Outbox et reprises", deliveries: "Livraisons de notifications", projectionUnavailable: "Projection Admin sûre indisponible", projectionText: "Les tables et RPC existantes ne permettent pas cette lecture à un Admin sans contourner RLS. Le payload et les données destinataire restent masqués.",
  action: "Action", resource: "Type de ressource", actor: "Acteur", occurredAt: "Horodatage", correlation: "Corrélation", integrity: "Empreinte d’intégrité", signal: "Signal", general: "Général", notification: "Notification", deadLetter: "Dead-letter", outboxSignal: "Outbox", readOnly: "Lecture seule",
};

const ar: typeof fr = {
  eyebrow: "الإدارة المركزية", title: "الإشعارات والتدقيق وصندوق الأحداث", description: "مراقبة الخدمات وإعادة المحاولة والاسترداد المصرح بها. تظل محتويات الإشعارات والحمولات خاصة.",
  back: "لوحة القيادة", language: "Français", forbidden: "وصول مقيّد", forbiddenText: "يلزم دور مدير أعلى أو مدير Matricia أو مسؤول مالي أو مدقق للقراءة فقط.", unavailable: "الإشراف غير متاح", unavailableText: "فشلت القراءة بشكل مغلق ولم يتم فتح أي نطاق إضافي.",
  safetyTitle: "نطاق الأمان", safetyText: "تتطلب إعادة المحاولة طلباً معللاً وموافقة مدير آخر بمصادقة معززة. تظل الحمولة خاصة.",
  audit: "سجل تدقيق منقح", auditedEvents: "الأحداث المدققة", systemEvents: "أحداث النظام والخدمة", notificationSignals: "إشارات الإشعارات", deadLetterSignals: "إشارات الرسائل الميتة", outboxSignals: "إشارات صندوق الأحداث", latestEvents: "الأحداث الأخيرة", noEvents: "لا توجد أحداث مسموحة ظاهرة.",
  outbox: "صندوق الأحداث وإعادة المحاولة", deliveries: "تسليم الإشعارات", projectionUnavailable: "إسقاط إداري آمن غير متاح", projectionText: "لا تسمح الجداول وإجراءات RPC الحالية بهذه القراءة للمدير دون تجاوز RLS. تظل الحمولة وبيانات المستلم محجوبة.",
  action: "الإجراء", resource: "نوع المورد", actor: "الفاعل", occurredAt: "التوقيت", correlation: "الترابط", integrity: "بصمة السلامة", signal: "الإشارة", general: "عام", notification: "إشعار", deadLetter: "رسالة ميتة", outboxSignal: "صندوق الأحداث", readOnly: "للقراءة فقط",
};

export type AdminOperationsMessages = typeof fr;
export function getAdminOperationsMessages(locale: Locale): AdminOperationsMessages { return locale === "ar" ? ar : fr; }
