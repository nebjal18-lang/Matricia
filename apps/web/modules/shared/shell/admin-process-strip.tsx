import type { Locale } from "@/modules/shared/lib/i18n/locale";

export type ProcessStep = {
  id: string;
  label: string;
  state: "done" | "current" | "blocked" | "pending";
};

export function AdminProcessStrip({
  locale,
  title,
  owner,
  nextAction,
  blocker,
  steps,
  className,
}: {
  locale: Locale;
  title: string;
  owner: string;
  nextAction: string;
  blocker?: string | null | undefined;
  steps: readonly ProcessStep[];
  className?: string;
}) {
  return (
    <section dir={locale === "ar" ? "rtl" : "ltr"} className={["admin-process-strip admin-reveal", className].filter(Boolean).join(" ")} aria-label={title}>
      <div className="admin-process-head">
        <div>
          <p className="admin-eyebrow">{title}</p>
          <p className="mt-2 text-sm text-[var(--ad-muted)]">
            <span className="font-semibold text-[var(--ad-ink)]">{locale === "ar" ? "المسؤول" : "Responsable"}:</span> {owner}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--ad-border)] bg-[var(--mat-canvas)] px-3 py-2 text-sm">
          <span className="font-semibold">{locale === "ar" ? "الإجراء التالي" : "Prochaine action"}:</span> {nextAction}
        </div>
      </div>
      <ol className="admin-process-steps">
        {steps.map((step, index) => (
          <li key={step.id} data-state={step.state} style={{ animationDelay: `${index * 60}ms` }}>
            <span className="admin-process-dot" aria-hidden />
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
      {blocker ? <p className="admin-notice mt-3">{blocker}</p> : null}
    </section>
  );
}
