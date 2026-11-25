export default function FranchiseSpaceLoading() {
  return (
    <main className="min-h-dvh px-4 py-6 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement franchisé / جاري تحميل مساحة الامتياز</span>
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-16 animate-pulse rounded-2xl bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-40 animate-pulse rounded-xl bg-muted" />)}
        </div>
      </div>
    </main>
  );
}
