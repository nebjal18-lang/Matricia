import type { Locale } from "@/modules/shared/lib/i18n/locale";
import type { PriorityKey } from "./diagnostic-priorities";

type ActionStep = { action: string; deliverable: string; owner: string; done: string };
type ActionPlan = readonly [ActionStep, ActionStep, ActionStep];

export const diagnosticPlanCopy: Record<Locale, Record<PriorityKey, ActionPlan>> = {
  fr: {
    organization: [
      { action: "Choisir trois priorités et préciser le résultat attendu pour chacune.", deliverable: "Une liste ordonnée de trois priorités mesurables.", owner: "La direction avec les personnes concernées.", done: "Les trois priorités et leurs résultats attendus sont validés." },
      { action: "Attribuer un responsable et une échéance à chaque priorité dans un support partagé.", deliverable: "Un tableau de suivi avec responsables, dates et avancement.", owner: "Le pilote désigné par la direction.", done: "Chaque priorité a un responsable, une date et un état de suivi." },
      { action: "Tenir une première revue et ajuster les actions à partir des écarts constatés.", deliverable: "Un compte rendu de revue et un tableau actualisé.", owner: "Le pilote et les responsables des actions.", done: "Une revue est réalisée et la prochaine date de suivi est fixée." },
    ],
    sales: [
      { action: "Décrire le parcours actuel d’une demande jusqu’à la vente et repérer les informations dispersées.", deliverable: "Une carte des étapes commerciales et des informations nécessaires.", owner: "La personne responsable du suivi commercial.", done: "Chaque étape et sa source d’information sont identifiées." },
      { action: "Tester un support commun avec trois dossiers représentatifs avant de généraliser.", deliverable: "Un outil ou fichier partagé testé sur trois dossiers.", owner: "Le responsable commercial avec les utilisateurs concernés.", done: "Chaque dossier test contient un statut, une prochaine action et un responsable." },
      { action: "Organiser une revue commerciale régulière et mettre à jour les prochaines actions.", deliverable: "Un compte rendu de revue avec les actions commerciales à jour.", owner: "Le pilote commercial et les responsables des dossiers.", done: "Une première revue est tenue et chaque action a une date et un responsable." },
    ],
    security: [
      { action: "Identifier les données et outils critiques ainsi que le périmètre à restaurer.", deliverable: "Un inventaire des éléments critiques et des priorités de reprise.", owner: "La direction avec le référent informatique.", done: "Le périmètre critique et l’ordre de reprise sont validés." },
      { action: "Documenter la procédure de restauration et les accès autorisés, sans y inscrire de secrets.", deliverable: "Une procédure de reprise et une liste des personnes habilitées.", owner: "Le référent informatique ou le prestataire habilité.", done: "La procédure est relue et l’emplacement des sauvegardes est identifié." },
      { action: "Tester une restauration sur une copie isolée, sans modifier les données de production.", deliverable: "Une preuve datée du test et la liste des écarts à corriger.", owner: "Le responsable de la restauration avec le référent métier.", done: "Le test est documenté, ses résultats sont vérifiés et les écarts sont attribués." },
    ],
    verify: [
      { action: "Lister les réponses encore inconnues et identifier une source pour chacune.", deliverable: "Une liste des questions à confirmer et de leurs sources possibles.", owner: "La personne qui pilote le diagnostic.", done: "Chaque réponse inconnue dispose d’une source ou d’un interlocuteur identifié." },
      { action: "Recueillir les confirmations auprès des personnes ou documents concernés.", deliverable: "Des réponses étayées par des sources datées, ou une incertitude explicite.", owner: "Le référent du domaine concerné.", done: "Chaque point est confirmé ou reste explicitement indiqué comme inconnu." },
      { action: "Mettre à jour les réponses et recalculer le prédiagnostic avant de choisir une action.", deliverable: "Un récapitulatif corrigé et un bilan recalculé.", owner: "L’auteur du diagnostic avec les référents concernés.", done: "Le récapitulatif a été vérifié et le nouveau bilan a été consulté." },
    ],
  },
  ar: {
    organization: [
      { action: "اختيار ثلاث أولويات وتحديد النتيجة المنتظرة لكل واحدة.", deliverable: "قائمة مرتبة من ثلاث أولويات قابلة للقياس.", owner: "الإدارة مع الأشخاص المعنيين.", done: "تتم المصادقة على الأولويات الثلاث ونتائجها المنتظرة." },
      { action: "تعيين مسؤول وأجل لكل أولوية في وسيلة متابعة مشتركة.", deliverable: "جدول متابعة يضم المسؤولين والآجال وحالة التقدم.", owner: "المكلف بالمتابعة الذي تعينه الإدارة.", done: "يكون لكل أولوية مسؤول وتاريخ وحالة متابعة." },
      { action: "عقد أول مراجعة وتعديل الإجراءات وفق الفوارق المسجلة.", deliverable: "محضر مراجعة وجدول متابعة محين.", owner: "المكلف بالمتابعة ومسؤولو الإجراءات.", done: "تنجز مراجعة ويحدد موعد المتابعة القادمة." },
    ],
    sales: [
      { action: "وصف المسار الحالي من الطلب إلى البيع وتحديد المعلومات المتفرقة.", deliverable: "خريطة للمراحل التجارية والمعلومات اللازمة.", owner: "المسؤول عن المتابعة التجارية.", done: "تحدد كل مرحلة ومصدر معلوماتها." },
      { action: "تجربة وسيلة مشتركة على ثلاثة ملفات ممثلة قبل تعميمها.", deliverable: "أداة أو ملف مشترك مجرب على ثلاثة ملفات.", owner: "المسؤول التجاري مع المستخدمين المعنيين.", done: "يتضمن كل ملف تجريبي حالة وإجراء قادما ومسؤولا." },
      { action: "تنظيم مراجعة تجارية منتظمة وتحيين الإجراءات القادمة.", deliverable: "محضر مراجعة بالإجراءات التجارية المحينة.", owner: "المكلف بالمتابعة التجارية ومسؤولو الملفات.", done: "تعقد أول مراجعة ويحدد تاريخ ومسؤول لكل إجراء." },
    ],
    security: [
      { action: "تحديد البيانات والأدوات الحرجة ونطاق الاستعادة.", deliverable: "جرد للعناصر الحرجة وأولويات الاستعادة.", owner: "الإدارة مع المرجع المعلوماتي.", done: "تتم المصادقة على النطاق الحرج وترتيب الاستعادة." },
      { action: "توثيق إجراء الاستعادة وصلاحيات الوصول المسموح بها دون إدراج أسرار.", deliverable: "إجراء للاستعادة وقائمة بالأشخاص المخولين.", owner: "المرجع المعلوماتي أو مقدم الخدمة المخول.", done: "تراجع الإجراءات ويحدد موقع النسخ الاحتياطية." },
      { action: "تجربة الاستعادة على نسخة معزولة دون تغيير بيانات الإنتاج.", deliverable: "دليل مؤرخ للتجربة وقائمة بالفوارق الواجب تصحيحها.", owner: "مسؤول الاستعادة مع المرجع المهني.", done: "توثق التجربة وتتحقق نتائجها وتعهد معالجة الفوارق إلى مسؤولين." },
    ],
    verify: [
      { action: "حصر الإجابات المجهولة وتحديد مصدر لتأكيد كل واحدة.", deliverable: "قائمة بالأسئلة التي تحتاج إلى تأكيد ومصادرها الممكنة.", owner: "الشخص المكلف بالتشخيص.", done: "يحدد مصدر أو مخاطب لكل إجابة مجهولة." },
      { action: "جمع التأكيدات من الأشخاص أو الوثائق المعنية.", deliverable: "إجابات مدعمة بمصادر مؤرخة أو بيان صريح باستمرار عدم اليقين.", owner: "المرجع المختص في المجال المعني.", done: "يؤكد كل عنصر أو يبقى مصرحا بأنه مجهول." },
      { action: "تحيين الإجابات وإعادة حساب التقييم الأولي قبل اختيار إجراء.", deliverable: "ملخص مصحح وتقييم معاد الحساب.", owner: "صاحب التشخيص مع المراجع المعنية.", done: "يراجع الملخص ويطلع على التقييم الجديد." },
    ],
  },
};
