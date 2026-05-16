"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Plantilla = {
  logo_url: string | null;
  color_primario: string;
  color_secundario: string;
  serie: string;
  pie_factura: string;
  email_plantilla: string;
};

export function PlantillaFacturaForm({ empresaId, empresaNombre }: { empresaId: string; empresaNombre: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [plantilla, setPlantilla] = useState<Plantilla>({
    logo_url: null,
    color_primario: "#7c5cff",
    color_secundario: "#67e8f9",
    serie: "FAC",
    pie_factura: "",
    email_plantilla: "",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  useEffect(() => {
    (async () => {
      const tk = await token();
      const res = await fetch(`/api/empresas/${empresaId}/plantilla-factura`, { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (json.ok && json.plantilla) {
        setPlantilla((p) => ({ ...p, ...json.plantilla }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function guardar() {
    setBusy("save");
    setError(null);
    setSuccess(null);
    try {
      const tk = await token();
      const res = await fetch(`/api/empresas/${empresaId}/plantilla-factura`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          color_primario: plantilla.color_primario,
          color_secundario: plantilla.color_secundario,
          serie: plantilla.serie,
          pie_factura: plantilla.pie_factura,
          email_plantilla: plantilla.email_plantilla,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setSuccess("Plantilla actualizada.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function subirLogo(file: File) {
    if (file.size > 2_000_000) {
      setError("El logo no puede pasar de 2 MB.");
      return;
    }
    setBusy("logo");
    setError(null);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result ?? "").split(",")[1] ?? "");
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      const tk = await token();
      const res = await fetch(`/api/empresas/${empresaId}/plantilla-factura`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ logo_base64: base64, logo_mime: file.type }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setPlantilla((p) => ({ ...p, logo_url: (json.plantilla?.logo_url as string) ?? p.logo_url }));
      setSuccess("Logo subido.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="grid">
      <article className="card span-4" style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <span className="card-eyebrow">Logo</span>
        <div
          style={{
            height: 140,
            borderRadius: 8,
            background: plantilla.logo_url ? `center / contain no-repeat url("${plantilla.logo_url}")` : `linear-gradient(135deg, ${plantilla.color_primario} 0%, ${plantilla.color_secundario} 100%)`,
            display: "grid",
            placeItems: "center",
            color: "white",
            fontWeight: 800,
            fontSize: 24,
            border: "1px solid var(--line)",
          }}
        >
          {!plantilla.logo_url ? empresaNombre.slice(0, 1).toUpperCase() : null}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && subirLogo(e.target.files[0])}
        />
        <button className="button secondary" onClick={() => fileInput.current?.click()} disabled={busy === "logo"}>
          {busy === "logo" ? "Subiendo…" : plantilla.logo_url ? "Cambiar logo" : "Subir logo"}
        </button>
        <small className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>PNG / SVG / JPG · máx 2 MB</small>
      </article>

      <article className="card span-8" style={{ display: "grid", gap: 12 }}>
        <span className="card-eyebrow">Personalización</span>
        <div className="form two-cols">
          <label className="label">
            Color principal
            <input type="color" className="input" value={plantilla.color_primario} onChange={(e) => setPlantilla({ ...plantilla, color_primario: e.target.value })} style={{ height: 42 }} />
          </label>
          <label className="label">
            Color secundario
            <input type="color" className="input" value={plantilla.color_secundario} onChange={(e) => setPlantilla({ ...plantilla, color_secundario: e.target.value })} style={{ height: 42 }} />
          </label>
          <label className="label">
            Serie facturas
            <input className="input" value={plantilla.serie} onChange={(e) => setPlantilla({ ...plantilla, serie: e.target.value.toUpperCase() })} maxLength={10} style={{ fontFamily: "var(--mono)" }} />
          </label>
          <label className="label span-form">
            Pie de factura
            <input className="input" value={plantilla.pie_factura} onChange={(e) => setPlantilla({ ...plantilla, pie_factura: e.target.value })} placeholder="Gracias por confiar en nosotros." />
          </label>
          <label className="label span-form">
            Plantilla email de envío
            <textarea className="input textarea" value={plantilla.email_plantilla} onChange={(e) => setPlantilla({ ...plantilla, email_plantilla: e.target.value })} placeholder="Hola {cliente}, adjunto la factura {numero}…" style={{ minHeight: 120 }} />
            <small className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>Variables: {"{cliente}, {numero}, {total}, {vencimiento}"}</small>
          </label>
        </div>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
        {success ? <p role="status" style={{ color: "var(--good)" }}>{success}</p> : null}

        <div className="button-row" style={{ justifyContent: "flex-end" }}>
          <button className="button" onClick={guardar} disabled={busy === "save"}>
            {busy === "save" ? "Guardando…" : "Guardar plantilla"}
          </button>
        </div>
      </article>
    </section>
  );
}
