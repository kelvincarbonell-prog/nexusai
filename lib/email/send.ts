/**
 * Wrapper minimal para Resend. Si RESEND_API_KEY no está configurada,
 * loguea el email a consola en lugar de enviarlo (modo dev/test).
 *
 * No usa el SDK oficial para mantener el bundle pequeño.
 */

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
};

export type SendResult = {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
};

const DEFAULT_FROM = process.env.RESEND_FROM ?? "Modelo 26 <noreply@modelo26.com>";

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") {
      console.log("[email:skip]", { to: input.to, subject: input.subject, len: input.html.length });
    }
    return { ok: true, skipped: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from ?? DEFAULT_FROM,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        reply_to: input.replyTo,
        cc: input.cc,
        bcc: input.bcc,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${text.slice(0, 200)}` };
    }
    const j = await res.json().catch(() => ({}));
    return { ok: true, id: j.id };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Error envío email" };
  }
}

/**
 * HTML helper consistente con la identidad de marca.
 */
export function emailLayout(opts: { title: string; preheader?: string; body: string; cta?: { label: string; url: string } }): string {
  const cta = opts.cta
    ? `<table cellpadding="0" cellspacing="0" style="margin:22px 0"><tr><td style="border-radius:10px;background:#6366f1"><a href="${opts.cta.url}" style="display:inline-block;padding:12px 22px;font-family:-apple-system,Inter,Arial,sans-serif;color:#fff;text-decoration:none;font-weight:600;font-size:14px">${opts.cta.label} →</a></td></tr></table>`
    : "";
  return `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:24px;background:#f7f7f9;font-family:-apple-system,Inter,Arial,sans-serif;color:#111">
    ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${opts.preheader}</div>` : ""}
    <table cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ececef">
      <tr><td style="padding:18px 24px;background:#0a0612;color:#fff">
        <div style="font-weight:800;letter-spacing:0.5px">MODELO 26</div>
        <div style="font-size:12px;opacity:0.7">Gestoría inteligente</div>
      </td></tr>
      <tr><td style="padding:24px">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${opts.title}</h1>
        <div style="font-size:14px;line-height:1.55;color:#333">${opts.body}</div>
        ${cta}
        <p style="font-size:12px;color:#888;margin:18px 0 0">Si tienes dudas responde a este email, lo recibe directamente tu gestor.</p>
      </td></tr>
      <tr><td style="padding:14px 24px;background:#fafafa;border-top:1px solid #ececef;font-size:11px;color:#888">
        Recibes este email porque eres usuario de Modelo 26.
      </td></tr>
    </table>
  </body>
</html>`;
}
