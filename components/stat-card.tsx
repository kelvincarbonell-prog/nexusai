export function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <section className="card span-3">
      <div className="eyebrow">{label}</div>
      <div className="metric">{value}</div>
      <p className="muted">{hint}</p>
    </section>
  );
}
