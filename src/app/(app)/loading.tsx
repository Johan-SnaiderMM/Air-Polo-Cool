export default function CargandoApp() {
  return (
    <div className="space-y-3" role="status" aria-label="Cargando">
      <div className="h-14 animate-pulse rounded-xl bg-stone-200" />
      <div className="h-11 w-2/3 animate-pulse rounded-full bg-stone-200" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-stone-200" />
      ))}
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
