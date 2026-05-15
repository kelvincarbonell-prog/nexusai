import Link from "next/link";

export const metadata = {
  title: "Nexus · El copiloto fiscal que cierra impuestos en 12 segundos",
  description:
    "Plataforma con IA real para autónomos, pymes y gestorías. Cierra IVA, nóminas y bancos en minutos. Auditoría AEAT nativa, VeriFactu opcional, firma electrónica integrada.",
};

const LOGOS = [
  "Gabinete Nexus",
  "Asesoría Pons",
  "Onklub Talent",
  "Reditorial Iberia",
  "Innova Apps",
  "Vertical Studio",
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Link href="/" className="sb-brand" aria-label="Inicio">
          <span className="sb-brand-mark">N</span>
          <span>Nexus</span>
        </Link>
        <nav aria-label="Secciones">
          <a href="#producto">Producto</a>
          <a href="#asesores">Para asesores</a>
          <a href="#autonomos">Para autónomos</a>
          <a href="#empresas">Para pymes</a>
          <a href="#precios">Precios</a>
          <a href="#seguridad">Seguridad</a>
        </nav>
        <div className="landing-cta">
          <Link href="/login" className="button ghost compact">Entrar</Link>
          <Link href="/autonomos-empresas/registro" className="button compact">
            Empezar gratis <span className="kbd" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", borderColor: "transparent" }}>↵</span>
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <span className="eyebrow">● Sistema fiscal certificado · Q2 2026 · AEAT directa</span>
        <h1 className="display" style={{ fontSize: "clamp(48px, 7vw, 96px)", marginTop: 18 }}>
          El copiloto fiscal <em>que cierra</em> el trimestre <em>en lo que tardas</em> en hacerte un café.
        </h1>
        <p className="subtitle" style={{ fontSize: 18, maxWidth: 720 }}>
          Nexus conecta tu correo, tu banco y tu AEAT, presenta tus modelos y firma tus nóminas — sin que muevas un dedo.
          Autónomos, pymes y gestorías cierran IVA en <strong>12 segundos de media</strong> con auditoría completa.
        </p>
        <div className="landing-hero-cta">
          <Link href="/autonomos-empresas/registro" className="button" style={{ padding: "14px 18px", fontSize: 14 }}>
            Empezar gratis · 14 días <span className="kbd" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", borderColor: "transparent" }}>↵</span>
          </Link>
          <Link href="#demo" className="button secondary" style={{ padding: "14px 18px", fontSize: 14 }}>
            Ver demo de 2 minutos →
          </Link>
        </div>
        <ul className="landing-bullets">
          <li>● Sin tarjeta para empezar</li>
          <li>● Migración asistida desde A3, Sage, Holded o Quipu</li>
          <li>● Cancelas en un clic</li>
        </ul>

        <div className="landing-stats">
          <div className="login-stat"><strong>1.842</strong><small>gestorías activas</small></div>
          <div className="login-stat"><strong>€ 2,4 Bn</strong><small>facturado · Q2</small></div>
          <div className="login-stat"><strong>99,2 %</strong><small>automatizado · IA</small></div>
          <div className="login-stat"><strong>12 s</strong><small>cierre medio · IVA</small></div>
        </div>
      </section>

      <section className="landing-logos" aria-label="Clientes y partners">
        <span className="eyebrow">● Asesorías y empresas que ya operan con Nexus</span>
        <div className="logos-row">
          {LOGOS.map((name) => (
            <span key={name} style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--muted)" }}>
              {name}
            </span>
          ))}
        </div>
      </section>

      <section className="landing-section" id="producto">
        <span className="eyebrow">● Producto</span>
        <h2 className="title" style={{ fontSize: 44, maxWidth: 820 }}>
          No es otro software de gestión. <em>Es un equipo entero</em> trabajando contigo.
        </h2>
        <div className="features-grid">
          <article className="feature">
            <span className="card-eyebrow">Agente extractor</span>
            <strong>Tus facturas se procesan solas.</strong>
            <p>Cada empresa recibe un buzón único <code>facturas-xxx@inbox.nexusai.app</code>. Reenvías un PDF y aparece en contabilidad con proveedor, base, IVA y cuenta PGC — categorizado.</p>
          </article>
          <article className="feature">
            <span className="card-eyebrow">Agente fiscal</span>
            <strong>Modelos AEAT generados solos.</strong>
            <p>303, 111, 115, 130, 390, 347, 349, 200. Nexus monta el borrador, detecta IVA inusual y deducciones perdidas. Tú firmas con certificado y se presenta.</p>
          </article>
          <article className="feature">
            <span className="card-eyebrow">Agente laboral</span>
            <strong>Nóminas, contratos y fichaje.</strong>
            <p>Alta de trabajador en 90 segundos. Vacaciones, IT, maternidad. Fichaje RD 8/2019 obligatorio resuelto en móvil con foto del trabajador y geolocalización.</p>
          </article>
          <article className="feature">
            <span className="card-eyebrow">Asistente de voz</span>
            <strong>«¿Cuánto IVA llevo este trimestre?»</strong>
            <p>Pregunta a Nexus en voz alta desde el móvil. Responde sobre IVA, gastos por categoría, vacaciones, fichajes y facturas pendientes — al instante.</p>
          </article>
          <article className="feature">
            <span className="card-eyebrow">Conciliación SEPA</span>
            <strong>Tu banco, conciliado en silencio.</strong>
            <p>PSD2 con BBVA, Santander, Sabadell, CaixaBank, Bankinter y +90 entidades europeas. Cada cobro se concilia con su factura. Cada gasto se categoriza.</p>
          </article>
          <article className="feature">
            <span className="card-eyebrow">VeriFactu opcional</span>
            <strong>Listo para 2027. Sin obligarte hoy.</strong>
            <p>Cuando entre en vigor, lo activas con un switch. Hash encadenado, QR y envío a AEAT sin tocar tu flujo de facturación actual.</p>
          </article>
        </div>
      </section>

      <section className="landing-section landing-dark" id="asesores">
        <span className="eyebrow">● Para asesorías y gestorías</span>
        <h2 className="title" style={{ fontSize: 44, maxWidth: 820 }}>
          Atiende <em>3× más clientes</em> con el mismo equipo.
        </h2>
        <p className="subtitle" style={{ fontSize: 18 }}>
          Un gestor medio de Nexus cierra 16 carteras en lugar de 5. La IA hace el trabajo repetitivo. Tú firmas, asesoras y vendes más.
        </p>
        <div className="features-grid">
          <article className="feature dark">
            <strong>—31 h al mes</strong>
            <p>Tiempo medio que Nexus le ahorra a un asesor. Datos reales de 1.842 gestorías.</p>
          </article>
          <article className="feature dark">
            <strong>+€840/mes</strong>
            <p>Ingreso adicional por gestor: nuevos clientes onboardeados con Cl@ve sin trabajo manual.</p>
          </article>
          <article className="feature dark">
            <strong>0 plazos perdidos</strong>
            <p>Calendario fiscal unificado por cliente. La IA te avisa el día que toca y prepara el borrador.</p>
          </article>
          <article className="feature dark">
            <strong>Portal cliente integrado</strong>
            <p>Tus clientes ven sus facturas, suben gastos por WhatsApp y firman con Cl@ve. Tú no pierdes el control.</p>
          </article>
        </div>
        <div className="testimonial">
          <p style={{ fontStyle: "italic", fontSize: 22, lineHeight: 1.4 }}>
            «Atendíamos 8 clientes por gestor. Con Nexus llevamos 18 sin contratar a nadie y mis asesores salen a su hora.»
          </p>
          <p style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--muted-soft)" }}>
            — María González · socia · Gabinete Nexus · Valencia
          </p>
        </div>
      </section>

      <section className="landing-section" id="autonomos">
        <span className="eyebrow">● Para autónomos</span>
        <h2 className="title" style={{ fontSize: 44, maxWidth: 820 }}>
          Factura, cobra y declara. <em>Desde el móvil.</em>
        </h2>
        <div className="features-grid three">
          <article className="feature">
            <strong>📸 Foto = gasto</strong>
            <p>Le haces una foto al ticket y Nexus monta el gasto, lo categoriza y lo guarda para tu IRPF.</p>
          </article>
          <article className="feature">
            <strong>📬 Buzón único</strong>
            <p>Reenvías la factura del SaaS o del coworking y aparece en tu contabilidad. Sin abrir el ordenador.</p>
          </article>
          <article className="feature">
            <strong>📊 Estimación IRPF</strong>
            <p>Nexus calcula cuánto te toca pagar de renta cada mes para que no llegues a abril con sorpresas.</p>
          </article>
          <article className="feature">
            <strong>🧾 Modelo 130/131</strong>
            <p>Pago fraccionado trimestral generado solo. Firmas y se presenta. 4 € al mes.</p>
          </article>
          <article className="feature">
            <strong>🎙️ Voz</strong>
            <p>«Nexus, ¿cuánto puedo gastarme este mes sin descuadrar mis impuestos?» — y te responde.</p>
          </article>
          <article className="feature">
            <strong>💳 Banco conectado</strong>
            <p>Tus ingresos y gastos entran solos vía PSD2. Nada de subir extractos a mano.</p>
          </article>
        </div>
        <Link href="/autonomos-empresas/registro" className="button" style={{ marginTop: 24, padding: "14px 18px" }}>
          Empezar como autónomo · 9 €/mes
        </Link>
      </section>

      <section className="landing-section" id="empresas">
        <span className="eyebrow">● Para pymes y empresas</span>
        <h2 className="title" style={{ fontSize: 44, maxWidth: 820 }}>
          Contabilidad PGC, nóminas y bancos. <em>Sin software, sin servidor, sin Excel.</em>
        </h2>
        <div className="features-grid three">
          <article className="feature">
            <strong>Contabilidad PGC</strong>
            <p>Diario, mayor, balance de sumas y saldos, P&G y balance. Conciliación bancaria y activos fijos incluidos.</p>
          </article>
          <article className="feature">
            <strong>Nóminas con convenio</strong>
            <p>12 emp. cerradas en 9 minutos. Variables, ausencias, IT y bonificaciones SS automáticas.</p>
          </article>
          <article className="feature">
            <strong>Modelos AEAT + Intrastat</strong>
            <p>303, 390, 200 (IS), 347 operaciones con terceros, 349 intracomunitarias. Validados antes de presentar.</p>
          </article>
          <article className="feature">
            <strong>Cierre y apertura</strong>
            <p>Regularización 6/7, asiento de cierre y apertura del ejercicio. Auditoría AEAT lista en un clic.</p>
          </article>
          <article className="feature">
            <strong>Fichaje legal</strong>
            <p>Registro horario RD 8/2019 desde web, móvil o reloj físico. Reporte mensual descargable.</p>
          </article>
          <article className="feature">
            <strong>Multiempresa</strong>
            <p>Grupo consolidado, eliminaciones intercompañía y reporting consolidado en un solo panel.</p>
          </article>
        </div>
      </section>

      <section className="landing-section landing-precios" id="precios">
        <span className="eyebrow">● Precios honestos</span>
        <h2 className="title" style={{ fontSize: 44 }}>Sin permanencia. Sin sorpresas.</h2>
        <div className="pricing">
          <article className="price-card">
            <div className="card-eyebrow">Autónomo</div>
            <div className="metric"><span className="sym">€</span>9<small style={{ fontSize: 14, color: "var(--muted)", fontWeight: 500 }}>/mes</small></div>
            <ul>
              <li>● Facturas ilimitadas + buzón único</li>
              <li>● Banco PSD2 + categorización IA</li>
              <li>● Modelos 130/131 · 303 · 390</li>
              <li>● Estimación IRPF al día</li>
              <li>● Móvil + voz</li>
            </ul>
            <Link href="/autonomos-empresas/registro" className="button" style={{ width: "100%", justifyContent: "center" }}>Empezar</Link>
          </article>
          <article className="price-card highlight">
            <div className="card-eyebrow">Pyme · más popular</div>
            <div className="metric"><span className="sym">€</span>39<small style={{ fontSize: 14, color: "var(--muted-soft)", fontWeight: 500 }}>/mes</small></div>
            <ul>
              <li>● Todo lo de Autónomo</li>
              <li>● Contabilidad PGC completa</li>
              <li>● Nóminas hasta 25 empleados</li>
              <li>● Modelos 200 · 347 · 349 · 111 · 115</li>
              <li>● Fichaje + portal cliente</li>
              <li>● Hasta 3 usuarios</li>
            </ul>
            <Link href="/autonomos-empresas/registro" className="button secondary" style={{ width: "100%", justifyContent: "center", background: "white", color: "var(--ink)", borderColor: "white" }}>Empezar</Link>
          </article>
          <article className="price-card">
            <div className="card-eyebrow">Gestoría</div>
            <div className="metric"><span className="sym">€</span>4<small style={{ fontSize: 14, color: "var(--muted)", fontWeight: 500 }}>/cliente/mes</small></div>
            <ul>
              <li>● Cartera ilimitada</li>
              <li>● Multiempresa + multifirma</li>
              <li>● Cl@ve + certificado FNMT</li>
              <li>● API + webhook · integraciones</li>
              <li>● Onboarding asistido</li>
              <li>● SLA 99,9 % · soporte humano</li>
            </ul>
            <Link href="/autonomos-empresas/registro" className="button" style={{ width: "100%", justifyContent: "center" }}>Hablar con ventas</Link>
          </article>
        </div>
      </section>

      <section className="landing-section landing-faq" id="seguridad">
        <span className="eyebrow">● Seguridad y cumplimiento</span>
        <h2 className="title" style={{ fontSize: 44, maxWidth: 820 }}>Tu información, donde tiene que estar.</h2>
        <div className="features-grid">
          <article className="feature"><strong>ISO 27001</strong><p>Gestión de seguridad de la información certificada.</p></article>
          <article className="feature"><strong>SOC 2 · Type II</strong><p>Auditoría continua de controles operativos.</p></article>
          <article className="feature"><strong>ENS · Nivel Medio</strong><p>Esquema Nacional de Seguridad — preparado para Administración.</p></article>
          <article className="feature"><strong>Datos en UE</strong><p>Frankfurt + Dublín. Nunca salen de la Unión Europea.</p></article>
          <article className="feature"><strong>TLS 1.3 · cifrado</strong><p>Tránsito y reposo con AES-256. Logs de acceso por usuario.</p></article>
          <article className="feature"><strong>GDPR + LOPDGDD</strong><p>Portabilidad y derecho al olvido implementados nativamente.</p></article>
        </div>
      </section>

      <section className="landing-cta-final">
        <h2 className="display" style={{ fontSize: "clamp(40px, 6vw, 80px)", color: "white" }}>
          Tu próximo cierre <em style={{ color: "rgba(255,255,255,0.55)" }}>es en 12 segundos.</em>
        </h2>
        <p style={{ color: "rgba(255,255,255,0.7)", maxWidth: 580, marginInline: "auto", fontSize: 18 }}>
          Empieza gratis hoy. Migramos tus datos desde A3, Sage, Holded o Quipu sin coste.
        </p>
        <div className="landing-hero-cta" style={{ justifyContent: "center" }}>
          <Link href="/autonomos-empresas/registro" className="button" style={{ padding: "14px 22px", background: "white", color: "var(--ink)", borderColor: "white" }}>
            Empezar gratis · 14 días
          </Link>
          <Link href="/login" className="button ghost" style={{ padding: "14px 22px", color: "white" }}>
            Ya tengo cuenta →
          </Link>
        </div>
      </section>

      <footer className="landing-foot">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 24, alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <Link href="/" className="sb-brand">
              <span className="sb-brand-mark">N</span>
              <span>Nexus</span>
            </Link>
            <p className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12, maxWidth: 280 }}>
              Sistema operativo fiscal y laboral para autónomos, pymes y gestorías. Hecho en Valencia.
            </p>
          </div>
          <div className="landing-foot-cols">
            <div>
              <span className="card-eyebrow">Producto</span>
              <a href="#asesores">Para asesores</a>
              <a href="#autonomos">Para autónomos</a>
              <a href="#empresas">Para pymes</a>
              <a href="#precios">Precios</a>
            </div>
            <div>
              <span className="card-eyebrow">Empresa</span>
              <Link href="/login">Acceder</Link>
              <Link href="/autonomos-empresas/registro">Registro</Link>
              <a href="mailto:hola@nexusai.app">Contacto</a>
            </div>
            <div>
              <span className="card-eyebrow">Legal</span>
              <a href="#">Política de privacidad</a>
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
          <span style={{ marginLeft: "auto" }}>© 2026 Nexus — todos los derechos reservados</span>
        </div>
      </footer>
    </div>
  );
}
