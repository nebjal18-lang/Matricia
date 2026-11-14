import type { HubKpi } from "@/modules/admin/data/spaces/hub-metrics";

export function HubKpiStrip({ kpis, label }: { kpis: HubKpi[]; label?: string }) {
  if (!kpis.length) return null;
  return (
    <section className="admin-hub-kpi-strip" data-count={String(kpis.length)} aria-label={label ?? "KPI"}>
      {kpis.map((kpi) => (
        <article key={kpi.id} className="admin-hub-kpi" data-tone={kpi.tone}>
          <p>{kpi.label}</p>
          <strong dir="ltr">{kpi.value}</strong>
        </article>
      ))}
    </section>
  );
}
