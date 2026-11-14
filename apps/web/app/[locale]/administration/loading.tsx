import { AdminAppShell } from "@/modules/admin/ui/admin-app-shell";

export default function AdministrationLoading() {
  return (
    <AdminAppShell
      locale="fr"
      selectedQuery=""
      selectedOrganizationId={null}
      userEmail={null}
      active="home"
      alternateHref="/ar/administration"
      title="Administration"
      lead=""
    >
      <main className="min-h-[50vh] px-4 py-6 sm:px-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Chargement administration / جاري تحميل الإدارة</span>
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="h-16 animate-pulse rounded-2xl bg-muted" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />)}
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        </div>
      </main>
    </AdminAppShell>
  );
}
