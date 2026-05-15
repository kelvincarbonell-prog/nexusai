import Link from "next/link";

export function SetupRequired({ missing }: { missing: string[] }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 32, background: "var(--bg)" }}>
      <div className="card" style={{ maxWidth: 560, width: "100%", display: "grid", gap: 14 }}>
        <span className="card-eyebrow warn">Configuración pendiente</span>
        <h1 className="title" style={{ fontSize: 28 }}>
          <span className="brand-text">M26</span> necesita conectarse a Supabase.
        </h1>
        <p className="muted" style={{ fontSize: 14 }}>
          Tu deploy de Vercel no tiene las variables de entorno de Supabase. Configúralas y haz redeploy
          (las variables <code>NEXT_PUBLIC_*</code> se inlinean en build).
        </p>

        <div className="setting-box" style={{ background: "var(--panel-soft)", padding: 14, borderRadius: 8 }}>
          <strong style={{ fontSize: 13 }}>Faltan en este deploy:</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontFamily: "var(--mono)", fontSize: 13, color: "var(--bad)" }}>
            {missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>

        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
          <li>Ve a <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>supabase.com/dashboard</a> → tu proyecto → Settings → API. Copia <code>Project URL</code> y <code>anon public</code> key.</li>
          <li>Ve a <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>vercel.com/dashboard</a> → tu proyecto → Settings → Environment Variables. Añádelas (Production + Preview + Development).</li>
          <li>Pestaña <strong>Deployments</strong> → el último → menú &quot;...&quot; → <strong>Redeploy</strong>. Espera ~2 minutos.</li>
        </ol>

        <div className="button-row" style={{ marginTop: 8 }}>
          <Link className="button" href="/">Volver a la landing</Link>
          <a className="button secondary" href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">Abrir Vercel</a>
        </div>
      </div>
    </main>
  );
}
