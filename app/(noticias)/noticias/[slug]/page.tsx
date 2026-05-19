import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, CalendarClock, Tag } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { createServerSupabase } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { renderMarkdown } from "@/components/noticias/markdown";
import { CATEGORIA_LABEL, type FuenteCategoria } from "@/lib/noticias/sources";

type Props = { params: Promise<{ slug: string }> };

export default async function NoticiaDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const admin = createSupabaseAdmin();
  const { data: noticia } = await admin
    .from("noticias")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!noticia) notFound();

  // Best-effort: increment vista_count sin bloquear el render
  admin.from("noticias").update({ vista_count: (noticia.vista_count ?? 0) + 1 }).eq("id", noticia.id).then(() => {});

  const { data: profile } = await supabase.from("perfiles").select("rol").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  const fechaFmt = new Date(noticia.fecha_publicacion + "T00:00:00").toLocaleDateString("es-ES", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  const importColor = noticia.importancia === "alta" ? "#ef4444" : noticia.importancia === "baja" ? "var(--muted)" : "var(--accent)";

  return (
    <AppShell active="/noticias" showSuperAdmin={isAdmin}>
      <Link href="/noticias" className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, textDecoration: "none", marginBottom: 4 }}>
        <ArrowLeft size={13} /> Volver a noticias
      </Link>

      <article style={{ display: "grid", gap: 18 }}>
        <header style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
            <span style={{
              padding: "3px 10px", borderRadius: 999, fontWeight: 600,
              background: `color-mix(in srgb, ${importColor} 14%, transparent)`,
              color: importColor,
            }}>
              {CATEGORIA_LABEL[noticia.categoria as FuenteCategoria] ?? noticia.categoria}
            </span>
            <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <CalendarClock size={12} /> {fechaFmt}
            </span>
            <span className="muted">·</span>
            <span className="muted">{noticia.fuente_nombre}</span>
            {noticia.fuente_url && (
              <a href={noticia.fuente_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 4, display: "inline-flex", alignItems: "center", gap: 4, color: "var(--accent)", fontSize: 12, textDecoration: "none" }}>
                Ir a la fuente <ExternalLink size={11} />
              </a>
            )}
          </div>
          <h1 className="title" style={{ fontSize: 30, margin: 0, lineHeight: 1.2 }}>{noticia.titulo}</h1>
          <p className="muted" style={{ fontSize: 15, margin: 0, lineHeight: 1.5 }}>{noticia.resumen}</p>
        </header>

        <article className="card" style={{ padding: 28, display: "grid", gap: 12 }}>
          <div
            className="noticia-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(noticia.contenido) }}
            style={{ fontSize: 15, lineHeight: 1.7 }}
          />
        </article>

        {(noticia.tags ?? []).length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <Tag size={12} color="var(--muted)" />
            {(noticia.tags as string[]).map((t) => (
              <span key={t} style={{
                padding: "3px 10px", borderRadius: 999,
                background: "color-mix(in srgb, currentColor 8%, transparent)",
                fontSize: 11, color: "var(--ink)",
              }}>#{t}</span>
            ))}
          </div>
        )}

        <p className="muted" style={{ fontSize: 11, margin: 0 }}>
          Artículo generado automáticamente por el sistema editorial de M26. Consulta siempre la fuente oficial antes de aplicar criterios al cliente.
        </p>
      </article>

      <style>{`
        .noticia-body h2 { font-size: 20px; margin: 16px 0 8px; font-weight: 700; }
        .noticia-body h3 { font-size: 17px; margin: 14px 0 6px; font-weight: 600; }
        .noticia-body p { margin: 8px 0; }
        .noticia-body ul, .noticia-body ol { margin: 10px 0; padding-left: 22px; }
        .noticia-body li { margin: 4px 0; }
        .noticia-body strong { font-weight: 600; }
        .noticia-body a { color: var(--accent); }
      `}</style>
    </AppShell>
  );
}
