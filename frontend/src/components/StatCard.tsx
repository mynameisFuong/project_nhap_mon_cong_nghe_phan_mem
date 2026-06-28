import type { ReactNode } from "react";

export function StatCard({ title, value, icon, hint, tone = "teal" }: { title: string; value: string | number; icon: ReactNode; hint?: string; tone?: string }) {
  return (
    <section className={`stat-card stat-${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
        {hint && <small>{hint}</small>}
      </div>
    </section>
  );
}
