import Link from "next/link";
import { Camera, Inbox, BarChart3, FileText, Mic, Building2, type LucideIcon } from "lucide-react";
import { Aurora } from "@/components/effects/aurora";
import { Reveal } from "@/components/effects/reveal";
import { CountUp } from "@/components/effects/count-up";
import { LiveDemoHero } from "@/components/effects/live-demo-hero";
import { LiveDemoVoice } from "@/components/effects/live-demo-voice";
import { LiveDemoFichaje } from "@/components/effects/live-demo-fichaje";
import { LiveDemoModelo } from "@/components/effects/live-demo-modelo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export const metadata = {
  title: "Modelo 26 · Tecnología fiscal y laboral del futuro",
  description:
    "M26 es la plataforma con IA real para autónomos, pymes y gestorías. Cierra IVA, nóminas y bancos en minutos. Auditoría AEAT nativa, VeriFactu opcional, firma electrónica integrada.",
};

const LOGOS = [
  "Gabinete Sánchez",
  "Asesoría Pons",
  "Onklub Talent",
  "Reditorial Iberia",
  "Innova Apps",
  "Vertical Studio",
  "Clínica S.V.",
  "Tendam Group",
  "Singular Bank",
  "Mango Online",
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" className="sb-brand" aria-label="Inicio">
          <span className="sb-brand-mark m26-mark">M26</span>
          <span>Modelo 26</span>
        </Link>
        <nav aria-label="Secciones">
          <a href="#producto">Producto</a>
          <a href="#asesores">Asesorías</a>
          <a href="#autonomos">Autónomos</a>
          <a href="#empresas">Pymes</a>
          <a href="#precios">Precios</a>
          <a href="#seguridad">Seguridad</a>
        </nav>
        <div className="landing-cta">
          <ThemeToggle compact />
          <Link href="/login" className="button ghost compact">Entrar</Link>
          <Link href="/autonomos-empresas/registro" className="button compact">
            Empezar gratis
            <span className="kbd">↵</span>
          </Link>
        </div>
      </header>

      <section className="landing-hero" style={{ position: "relative" }}>
        <Aurora />
        <Reveal>
          <span className="ticker">
            <span className="pulse-dot" aria-hidden="true" />
            <span>Modelo 26 · tecnología fiscal y laboral del futuro</span>
          </span>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="display" style={{ fontSize: "clamp(48px, 7.4vw, 104px)", marginTop: 14 }}>
            <span className="brand-text">Modelo 26.</span>
            <br />
            <em>El futuro</em> de la fiscalidad y la nómina,
            <br />
            ya está aquí.
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="subtitle" style={{ fontSize: 18, maxWidth: 720 }}>
            M26 conecta tu correo, tu banco y tu AEAT, presenta tus modelos y firma tus nóminas — sin que muevas un dedo.
            Autónomos, pymes y gestorías cierran el trimestre en <strong>12 segundos de media</strong> con auditoría AEAT nativa.
          </p>
        </Reveal>
        <Reveal delay={220}>
          <div className="landing-hero-cta">
            <Link href="/autonomos-empresas/registro" className="button" style={{ padding: "14px 18px", fontSize: 14 }}>
              Empezar gratis · 14 días <span className="kbd">↵</span>
            </Link>
            <Link href="#demo" className="button secondary" style={{ padding: "14px 18px", fontSize: 14 }}>
              Ver demo de 2 min →
            </Link>
          </div>
        </Reveal>
        <Reveal delay={280}>
          <ul className="landing-bullets">
            <li>● Sin tarjeta para empezar</li>
            <li>● Migración asistida desde A3, Sage, Holded o Quipu</li>
            <li>● Cancelas en un clic</li>
          </ul>
        </Reveal>

        <Reveal delay={340}>
          <div className="landing-stats">
            <div className="login-stat">
              <strong><CountUp to={1842} /></strong>
              <small>gestorías activas</small>
            </div>
            <div className="login-stat">
              <strong>€ <CountUp to={2.4} decimals={1} suffix=" Bn" /></strong>
              <small>facturado · Q2</small>
            </div>
            <div className="login-stat">
              <strong><CountUp to={99.2} decimals={1} suffix=" %" /></strong>
              <small>automatizado · IA</small>
            </div>
            <div className="login-stat">
              <strong><CountUp to={12} suffix=" s" /></strong>
              <small>cierre medio · IVA</small>
            </div>
          </div>
        </Reveal>

        <Reveal delay={400}>
          <div style={{ marginTop: 56 }}>
            <LiveDemoHero />
          </div>
        </Reveal>
      </section>

      <section className="landing-logos" aria-label="Asesorías y empresas">
        <span className="eyebrow">Confían en M26 1.842 asesorías y +12.400 empresas</span>
        <div className="marquee" style={{ marginTop: 20 }}>
          <div className="marquee-track">
            {[...LOGOS, ...LOGOS].map((name, i) => (
              <span key={`${name}-${i}`}>{name}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section" id="producto">
        <Reveal>
          <span className="eyebrow">Producto</span>
        </Reveal>
        <Reveal delay={60}>
          <h2 className="title" style={{ fontSize: 48, maxWidth: 880 }}>
            No es otro software de gestión. <em>Es un equipo entero</em> trabajando contigo.
          </h2>
        </Reveal>
        <div className="features-grid">
          {[
            {
              tag: "Agente extractor",
              title: "Tus facturas se procesan solas.",
              body: "Cada empresa recibe un buzón único facturas-xxx@inbox.m26.app. Reenvías un PDF y aparece en contabilidad con proveedor, base, IVA y cuenta PGC — categorizado.",
            },
            {
              tag: "Agente fiscal",
              title: "Modelos AEAT generados solos.",
              body: "303, 111, 115, 130, 390, 347, 349, 200. M26 monta el borrador, detecta IVA inusual y deducciones perdidas. Firmas con certificado y se presenta.",
            },
            {
              tag: "Agente laboral",
              title: "Nóminas, contratos y fichaje.",
              body: "Alta de trabajador en 90 segundos. Vacaciones, IT, maternidad. Registro horario RD 8/2019 resuelto en móvil con foto y geolocalización.",
            },
            {
              tag: "Asistente de voz",
              title: "«¿Cuánto IVA llevo este trimestre?»",
              body: "Pregunta a M26 desde el móvil. Responde sobre IVA, gastos por categoría, vacaciones, fichajes y facturas pendientes — al instante.",
            },
            {
              tag: "Conciliación SEPA",
              title: "Tu banco, conciliado en silencio.",
              body: "PSD2 con BBVA, Santander, Sabadell, CaixaBank, Bankinter y +90 entidades europeas. Cada cobro a su factura, cada gasto a su cuenta.",
            },
            {
              tag: "VeriFactu opcional",
              title: "Listo para 2027. Sin obligarte hoy.",
              body: "Cuando entre en vigor, lo activas con un switch. Hash encadenado, QR y envío a AEAT sin tocar tu flujo de facturación.",
            },
          ].map((f, i) => (
            <Reveal key={f.tag} delay={i * 70}>
              <article className="feature tilt">
                <span className="card-eyebrow">{f.tag}</span>
                <strong>{f.title}</strong>
                <p>{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section landing-dark" id="asesores">
        <Reveal>
          <span className="eyebrow">Para asesorías y gestorías</span>
        </Reveal>
        <Reveal delay={60}>
          <h2 className="title" style={{ fontSize: 48, maxWidth: 880 }}>
            Atiende <em className="gradient-text">3× más clientes</em> con el mismo equipo.
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p className="subtitle" style={{ fontSize: 18 }}>
            Un asesor medio de M26 cierra 16 carteras en lugar de 5. La IA hace el trabajo repetitivo. Tú firmas, asesoras y vendes más.
          </p>
        </Reveal>
        <div className="features-grid">
          {[
            { big: "−31 h", body: "Tiempo medio que M26 le ahorra a un asesor cada mes. Datos reales de 1.842 gestorías." },
            { big: "+€840", body: "Ingreso adicional por gestor al mes. Nuevos clientes onboardeados con Cl@ve sin trabajo manual." },
            { big: "0 plazos", body: "Calendario fiscal unificado por cliente. La IA te avisa el día que toca y prepara el borrador." },
            { big: "100 %", body: "De tus clientes ven sus facturas, suben gastos por WhatsApp y firman con Cl@ve. Tú no pierdes el control." },
          ].map((f, i) => (
            <Reveal key={f.big} delay={i * 70}>
              <article className="feature dark tilt">
                <strong>{f.big}</strong>
                <p>{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="testimonial">
            <p style={{ fontStyle: "italic", fontSize: 24, lineHeight: 1.4, color: "var(--ink)" }}>
              «Atendíamos 8 clientes por gestor. Con M26 llevamos 18 sin contratar a nadie y mis asesores salen a su hora.»
            </p>
            <p style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--muted)", marginTop: 12 }}>
              — María González · socia · Gabinete Sánchez · Valencia
            </p>
          </div>
        </Reveal>

        <Reveal>
          <div style={{ marginTop: 56 }}>
            <span className="card-eyebrow">Ver en directo</span>
            <h3 className="title" style={{ fontSize: 28, marginTop: 8, marginBottom: 24 }}>
              Modelo 303 montado <em>en 7 segundos.</em>
            </h3>
            <LiveDemoModelo />
          </div>
        </Reveal>
      </section>

      <section className="landing-section" id="autonomos">
        <Reveal>
          <span className="eyebrow">Para autónomos</span>
        </Reveal>
        <Reveal delay={60}>
          <h2 className="title" style={{ fontSize: 48, maxWidth: 880 }}>
            Factura, cobra y declara. <em>Desde el móvil.</em>
          </h2>
        </Reveal>
        <div className="features-grid three">
          {([
            { Icon: Camera, title: "Foto = gasto", body: "Foto al ticket y M26 monta el gasto, lo categoriza y lo guarda para tu IRPF." },
            { Icon: Inbox, title: "Buzón único", body: "Reenvías la factura del SaaS o del coworking y aparece en tu contabilidad. Sin abrir el ordenador." },
            { Icon: BarChart3, title: "Estimación IRPF", body: "M26 calcula cuánto te toca pagar cada mes para que no llegues a abril con sorpresas." },
            { Icon: FileText, title: "Modelo 130/131", body: "Pago fraccionado trimestral generado solo. Firmas y se presenta. 4 € al mes." },
            { Icon: Mic, title: "Voz", body: "«M26, ¿cuánto puedo gastarme este mes sin descuadrar mis impuestos?» — y te responde." },
            { Icon: Building2, title: "Banco conectado", body: "Tus ingresos y gastos entran solos vía PSD2. Nada de subir extractos a mano." },
          ] as { Icon: LucideIcon; title: string; body: string }[]).map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <article className="feature tilt">
                <strong style={{ fontSize: 20, display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                      display: "inline-grid",
                      placeItems: "center",
                      color: "var(--accent)",
                      flexShrink: 0,
                    }}
                  >
                    <f.Icon size={18} strokeWidth={1.7} />
                  </span>
                  {f.title}
                </strong>
                <p>{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <div className="grid" style={{ marginTop: 32, gap: 32, alignItems: "center" }}>
          <Reveal className="span-7">
            <div>
              <span className="card-eyebrow">Asistente de voz · habla con M26</span>
              <h3 className="title" style={{ fontSize: 32, marginTop: 8 }}>
                «¿Cuánto IVA llevo este trimestre?»
              </h3>
              <p className="subtitle" style={{ marginTop: 12 }}>
                Pregunta en voz alta desde el móvil. M26 consulta tus libros en tiempo real y te responde con
                la cifra exacta, la cuenta pendiente y el plazo. Sin abrir ningún menú.
              </p>
              <ul className="landing-bullets" style={{ marginTop: 16 }}>
                <li>● IVA · IRPF · IS</li>
                <li>● Gastos por categoría</li>
                <li>● Vacaciones y fichajes</li>
              </ul>
            </div>
          </Reveal>
          <Reveal className="span-5" delay={120}>
            <LiveDemoVoice />
          </Reveal>
        </div>

        <Reveal>
          <div className="button-row" style={{ marginTop: 24 }}>
            <Link href="/autonomos-empresas/registro" className="button" style={{ padding: "14px 18px" }}>
              Empezar como autónomo · 9 €/mes
            </Link>
          </div>
        </Reveal>
      </section>

      <section className="landing-section" id="empresas">
        <Reveal>
          <span className="eyebrow">Para pymes y empresas</span>
        </Reveal>
        <Reveal delay={60}>
          <h2 className="title" style={{ fontSize: 48, maxWidth: 880 }}>
            Contabilidad PGC, nóminas y bancos. <em>Sin software, sin servidor, sin Excel.</em>
          </h2>
        </Reveal>
        <div className="features-grid three">
          {[
            { title: "Contabilidad PGC", body: "Diario, mayor, balance de sumas y saldos, P&G y balance. Conciliación bancaria y activos fijos incluidos." },
            { title: "Nóminas con convenio", body: "12 emp. cerradas en 9 minutos. Variables, ausencias, IT y bonificaciones SS automáticas." },
            { title: "Modelos AEAT + Intrastat", body: "303, 390, 200 (IS), 347 operaciones con terceros, 349 intracomunitarias. Validados antes de presentar." },
            { title: "Cierre y apertura", body: "Regularización 6/7, asiento de cierre y apertura del ejercicio. Auditoría AEAT lista en un clic." },
            { title: "Fichaje legal", body: "Registro horario RD 8/2019 desde web, móvil o reloj físico. Reporte mensual descargable." },
            { title: "Multiempresa", body: "Grupo consolidado, eliminaciones intercompañía y reporting consolidado en un solo panel." },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <article className="feature tilt">
                <strong>{f.title}</strong>
                <p>{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="grid" style={{ marginTop: 48, gap: 32, alignItems: "center" }}>
          <Reveal className="span-5">
            <LiveDemoFichaje />
          </Reveal>
          <Reveal className="span-7" delay={120}>
            <div>
              <span className="card-eyebrow">Cobros automáticos · agente</span>
              <h3 className="title" style={{ fontSize: 32, marginTop: 8 }}>
                Tus clientes morosos <em>pagan solos</em>. Sin perseguir a nadie.
              </h3>
              <p className="subtitle" style={{ marginTop: 12 }}>
                El agente detecta facturas vencidas, redacta el email con tono adecuado, genera enlace de pago Stripe
                y concilia el ingreso cuando llega al banco. La pyme media recupera <strong>+12.000 € al año</strong> de
                facturas que se le olvidaban.
              </p>
              <ul className="landing-bullets" style={{ marginTop: 16 }}>
                <li>● Detección automática a 30/60/90 días</li>
                <li>● Email + WhatsApp + enlace de pago</li>
                <li>● Conciliación SEPA al instante</li>
                <li>● Sin tener llamadas incómodas</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="landing-section" id="precios">
        <Reveal>
          <span className="eyebrow">Precios honestos</span>
        </Reveal>
        <Reveal delay={60}>
          <h2 className="title" style={{ fontSize: 48 }}>Sin permanencia. Sin sorpresas.</h2>
        </Reveal>
        <div className="pricing">
          <Reveal delay={80}>
            <article className="price-card">
              <div className="card-eyebrow">Autónomo</div>
              <div className="metric"><span className="sym">€</span>9<small style={{ fontSize: 14, color: "var(--muted)", fontWeight: 500 }}>/mes</small></div>
              <ul>
                <li>● Facturas ilimitadas + buzón único</li>
                <li>● Banco PSD2 + categorización IA</li>
                <li>● Modelos 130/131 · 303 · 390</li>
                <li>● Estimación IRPF al día</li>
                <li>● App móvil + voz</li>
              </ul>
              <Link href="/autonomos-empresas/registro" className="button" style={{ width: "100%" }}>Empezar</Link>
            </article>
          </Reveal>
          <Reveal delay={140}>
            <article className="price-card highlight glow-border">
              <div className="card-eyebrow">Pyme · más popular</div>
              <div className="metric"><span className="sym">€</span>39<small style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>/mes</small></div>
              <ul>
                <li>● Todo lo de Autónomo</li>
                <li>● Contabilidad PGC completa</li>
                <li>● Nóminas hasta 25 empleados</li>
                <li>● Modelos 200 · 347 · 349 · 111 · 115</li>
                <li>● Fichaje + portal cliente</li>
                <li>● Hasta 3 usuarios</li>
              </ul>
              <Link href="/autonomos-empresas/registro" className="button" style={{ width: "100%", background: "white", color: "var(--accent)", borderColor: "white" }}>Empezar</Link>
            </article>
          </Reveal>
          <Reveal delay={200}>
            <article className="price-card">
              <div className="card-eyebrow">Gestoría</div>
              <div className="metric"><span className="sym">€</span>4<small style={{ fontSize: 14, color: "var(--muted)", fontWeight: 500 }}>/cliente/mes</small></div>
              <ul>
                <li>● Cartera ilimitada</li>
                <li>● Multiempresa + multifirma</li>
                <li>● Cl@ve + certificado FNMT</li>
                <li>● API + webhooks · integraciones</li>
                <li>● Onboarding asistido</li>
                <li>● SLA 99,9 % · soporte humano</li>
              </ul>
              <Link href="/autonomos-empresas/registro" className="button" style={{ width: "100%" }}>Hablar con ventas</Link>
            </article>
          </Reveal>
        </div>
      </section>

      <section className="landing-section" id="seguridad">
        <Reveal>
          <span className="eyebrow">Seguridad y cumplimiento</span>
        </Reveal>
        <Reveal delay={60}>
          <h2 className="title" style={{ fontSize: 48, maxWidth: 880 }}>Tu información, donde tiene que estar.</h2>
        </Reveal>
        <div className="features-grid">
          {[
            { title: "ISO 27001", body: "Gestión de seguridad de la información certificada." },
            { title: "SOC 2 · Type II", body: "Auditoría continua de controles operativos." },
            { title: "ENS · Nivel Medio", body: "Esquema Nacional de Seguridad — listo para Administración." },
            { title: "Datos en UE", body: "Frankfurt + Dublín. Nunca salen de la Unión Europea." },
            { title: "TLS 1.3 · cifrado", body: "Tránsito y reposo con AES-256. Logs de acceso por usuario." },
            { title: "GDPR + LOPDGDD", body: "Portabilidad y derecho al olvido nativos." },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <article className="feature tilt">
                <strong>{f.title}</strong>
                <p>{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-cta-final">
        <Reveal>
          <h2 className="display" style={{ fontSize: "clamp(40px, 6vw, 88px)" }}>
            Tu próximo cierre <em>es en 12 segundos.</em>
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p style={{ color: "var(--muted)", maxWidth: 620, marginInline: "auto", fontSize: 18 }}>
            Empieza gratis hoy. Migramos tus datos desde A3, Sage, Holded o Quipu sin coste.
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div className="landing-hero-cta" style={{ justifyContent: "center" }}>
            <Link href="/autonomos-empresas/registro" className="button" style={{ padding: "16px 24px", fontSize: 14 }}>
              Empezar gratis · 14 días
            </Link>
            <Link href="/login" className="button ghost" style={{ padding: "16px 24px" }}>
              Ya tengo cuenta →
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="landing-foot">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <Link href="/" className="sb-brand">
              <span className="sb-brand-mark m26-mark">M26</span>
              <span>Modelo 26</span>
            </Link>
            <p className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12, maxWidth: 280, lineHeight: 1.5 }}>
              Tecnología fiscal y laboral del futuro. Hecho en Valencia.
            </p>
            <div className="ticker" style={{ marginTop: 8 }}>
              <span className="pulse-dot" />
              <span>Sistemas operativos · AEAT directa</span>
            </div>
          </div>
          <div className="landing-foot-cols">
            <div>
              <span className="card-eyebrow">Producto</span>
              <a href="#asesores">Para asesorías</a>
              <a href="#autonomos">Para autónomos</a>
              <a href="#empresas">Para pymes</a>
              <a href="#precios">Precios</a>
            </div>
            <div>
              <span className="card-eyebrow">Empresa</span>
              <Link href="/login">Acceder</Link>
              <Link href="/autonomos-empresas/registro">Registro</Link>
              <a href="mailto:hola@m26.app">Contacto</a>
            </div>
            <div>
              <span className="card-eyebrow">Legal</span>
              <a href="#">Privacidad</a>
              <a href="#">Términos</a>
              <a href="#">DPO</a>
            </div>
          </div>
        </div>
        <div className="login-foot" style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
          <span>AEAT · VERI*FACTU</span>
          <span>ISO 27001</span>
          <span>SOC 2 · TYPE II</span>
          <span>ENS · MEDIO</span>
          <span style={{ marginLeft: "auto" }}>© 2026 Modelo 26 — todos los derechos reservados</span>
        </div>
      </footer>

      <div className="floating-cta" role="complementary" aria-label="Demo en vivo">
        <span className="pulse-dot" aria-hidden="true" />
        <span className="floating-cta-text">12.402 cierres procesados hoy</span>
        <Link href="/autonomos-empresas/registro" className="button compact accent">
          Empezar
        </Link>
      </div>
    </div>
  );
}
