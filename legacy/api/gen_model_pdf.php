<?php
/**
 * Nexus AI — gen_model_pdf.php
 * Genera el PDF del modelo tributario con el layout oficial AEAT.
 *
 * POST /api/gen_model_pdf.php
 * Authorization: Bearer <supabase_jwt>
 * Content-Type: application/json
 *
 * Body:
 * {
 *   "modelo":  "303",          // 303, 130, 111
 *   "periodo": "2T",
 *   "ejercicio": "2026",
 *   "nif":     "B12398765",
 *   "razon_social": "Innova Apps S.L.",
 *   "casillas": {              // valores por número de casilla
 *     "01": 10000.00,
 *     "03": 2100.00,
 *     ...
 *   }
 * }
 *
 * Response:
 * { "ok": true, "b64": "<base64>", "ref": "NX-...", "filename": "modelo303_2T_2026_NX-....pdf" }
 */

require_once __DIR__ . '/auth.php';
$user = nx_auth_required();

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!$body) nx_error('Body JSON inválido');

$modelo    = preg_replace('/[^0-9]/', '', $body['modelo']   ?? '303');
$periodo   = strtoupper(trim($body['periodo']   ?? '2T'));
$ejercicio = preg_replace('/[^0-9]/', '', $body['ejercicio'] ?? '2026');
$nif       = strtoupper(trim($body['nif']       ?? ''));
$rs        = trim($body['razon_social'] ?? 'Sin nombre');
$casillas  = $body['casillas'] ?? [];
$ref       = nx_ref();

$pdf = new AeatModeloPDF();
$pdf->generar($modelo, $periodo, $ejercicio, $nif, $rs, $casillas);
$bytes = $pdf->output();

nx_json([
    'ok'       => true,
    'ref'      => $ref,
    'b64'      => base64_encode($bytes),
    'hash'     => hash('sha256', $bytes),
    'filename' => 'modelo' . $modelo . '_' . $periodo . '_' . $ejercicio . '_' . $ref . '.pdf',
    'size'     => strlen($bytes),
]);


/* ═══════════════════════════════════════════════════════════════════
   AeatModeloPDF — Generador de modelos AEAT sin dependencias
   Reproduce el layout visual de los formularios oficiales.
   ═══════════════════════════════════════════════════════════════════ */
class AeatModeloPDF
{
    // ── Constantes de layout ──────────────────────────────────────────
    const PAGE_W  = 595;
    const PAGE_H  = 842;
    const MARGIN  = 28;
    const BOX_H   = 28;   // alto de una fila de casilla
    const COL1_W  = 200;  // ancho columna etiqueta
    const COL2_W  = 90;   // ancho columna valor

    // ── Estado interno ────────────────────────────────────────────────
    private string $buf     = '';
    private array  $offsets = [];
    private int    $nObj    = 0;
    private string $page    = '';
    private int    $y       = 0;
    private array  $cas     = [];

    // ── Colores AEAT ─────────────────────────────────────────────────
    private array $colorAzul   = [0.00, 0.30, 0.60]; // azul corporativo AEAT
    private array $colorGris   = [0.85, 0.87, 0.90]; // fondo casilla
    private array $colorNegro  = [0.00, 0.00, 0.00];
    private array $colorBlanco = [1.00, 1.00, 1.00];

    // ── MODELOS ───────────────────────────────────────────────────────
    private static array $DEFS = [
        '303' => [
            'titulo'    => 'MODELO 303 — I.V.A. Autoliquidación',
            'subtitulo' => 'Impuesto sobre el Valor Añadido',
            'secciones' => [
                ['titulo' => 'IDENTIFICACIÓN', 'tipo' => 'id'],
                ['titulo' => 'I.V.A. DEVENGADO', 'tipo' => 'casillas', 'casillas' => [
                    ['01', 'Base imponible operaciones corrientes 21%',   ''],
                    ['03', 'Cuota devengada 21%',                         ''],
                    ['06', 'Base imponible tipo reducido 10%',             ''],
                    ['08', 'Cuota devengada 10%',                         ''],
                    ['09', 'Base imponible tipo superreducido 4%',        ''],
                    ['11', 'Cuota devengada 4%',                          ''],
                    ['28', 'TOTAL CUOTA DEVENGADA',                       'total'],
                ]],
                ['titulo' => 'I.V.A. DEDUCIBLE', 'tipo' => 'casillas', 'casillas' => [
                    ['29', 'Base deducible operaciones interiores corrientes', ''],
                    ['30', 'Cuota deducible operaciones interiores corrientes',''],
                    ['46', 'TOTAL A DEDUCIR',                                  'total'],
                ]],
                ['titulo' => 'LIQUIDACIÓN', 'tipo' => 'casillas', 'casillas' => [
                    ['47', 'Resultado régimen general  (28-46)',              ''],
                    ['64', 'Suma de resultados',                              ''],
                    ['65', 'Atribuible a la Administración del Estado (100%)',''],
                    ['69', 'Resultado de la liquidación',                     ''],
                    ['71', 'RESULTADO (a ingresar / a devolver)',             'total'],
                ]],
            ],
        ],
        '130' => [
            'titulo'    => 'MODELO 130 — I.R.P.F. Pago Fraccionado',
            'subtitulo' => 'Estimación Directa · Actividades Económicas',
            'secciones' => [
                ['titulo' => 'IDENTIFICACIÓN', 'tipo' => 'id'],
                ['titulo' => 'ACTIVIDADES ECONÓMICAS EN ESTIMACIÓN DIRECTA', 'tipo' => 'casillas', 'casillas' => [
                    ['01', 'Ingresos computables del período',               ''],
                    ['02', 'Gastos fiscalmente deducibles del período',      ''],
                    ['03', 'Rendimiento neto  (01-02)',                       ''],
                    ['05', '20% del rendimiento neto (base del pago fraccionado)', ''],
                    ['07', 'Retenciones e ingresos a cuenta soportados',     ''],
                    ['09', 'Pagos fraccionados ingresados en períodos anteriores', ''],
                    ['11', 'RESULTADO  (a ingresar o cero)',                  'total'],
                ]],
            ],
        ],
        '111' => [
            'titulo'    => 'MODELO 111 — Retenciones e Ingresos a Cuenta del I.R.P.F.',
            'subtitulo' => 'Rendimientos del trabajo, actividades económicas, premios y determinadas ganancias',
            'secciones' => [
                ['titulo' => 'IDENTIFICACIÓN', 'tipo' => 'id'],
                ['titulo' => 'RENDIMIENTOS DEL TRABAJO', 'tipo' => 'casillas', 'casillas' => [
                    ['01', 'N.º de perceptores',                              ''],
                    ['02', 'Base de retención / ingreso a cuenta',            ''],
                    ['03', 'Retenciones e ingresos a cuenta practicados',     ''],
                ]],
                ['titulo' => 'RENDIMIENTOS DE ACTIVIDADES ECONÓMICAS', 'tipo' => 'casillas', 'casillas' => [
                    ['07', 'N.º de perceptores',                              ''],
                    ['08', 'Base de retención',                               ''],
                    ['09', 'Retenciones practicadas',                         ''],
                ]],
                ['titulo' => 'LIQUIDACIÓN', 'tipo' => 'casillas', 'casillas' => [
                    ['28', 'TOTAL INGRESOS A CUENTA (suma retenciones)',       ''],
                    ['30', 'Resultado   (=28)',                                'total'],
                ]],
            ],
        ],
    ];

    // ── API ───────────────────────────────────────────────────────────

    public function generar(string $modelo, string $periodo, string $eje,
                            string $nif, string $rs, array $casillas): void
    {
        $this->cas = array_change_key_case($casillas, CASE_LOWER);
        $def = self::$DEFS[$modelo] ?? self::$DEFS['303'];

        $this->y = self::PAGE_H - self::MARGIN;
        $this->page = '';

        $this->drawHeader($def['titulo'], $def['subtitulo'], $modelo, $periodo, $eje);

        foreach ($def['secciones'] as $sec) {
            if ($sec['tipo'] === 'id') {
                $this->drawIdSection($nif, $rs, $periodo, $eje);
            } else {
                $this->drawSection($sec['titulo'], $sec['casillas']);
            }
        }

        $this->drawFooter($nif, $rs, $periodo, $eje, $modelo);
    }

    public function output(): string
    {
        // Construir PDF
        $this->buf = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";

        // Obj 1: catálogo
        $this->obj(); $this->buf .= "<</Type /Catalog /Pages 2 0 R>>\n"; $this->endobj();
        // Obj 2: páginas (placeholder)
        $this->obj(); $this->endobj();
        // Obj 3: fuente regular
        $this->obj(); $this->buf .= "<</Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding>>\n"; $this->endobj();
        // Obj 4: fuente bold
        $this->obj(); $this->buf .= "<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding>>\n"; $this->endobj();
        // Obj 5: recursos
        $this->obj(); $this->buf .= "<</Font <</F1 3 0 R /F2 4 0 R>>>>\n"; $this->endobj();
        // Obj 6: contenido
        $contentObj = $this->obj(); $this->stream($this->page); $this->endobj();
        // Obj 7: página
        $pageObj = $this->obj();
        $this->buf .= "<</Type /Page /Parent 2 0 R /MediaBox [0 0 " . self::PAGE_W . " " . self::PAGE_H . "] "
                    . "/Contents {$contentObj} 0 R /Resources 5 0 R>>\n";
        $this->endobj();
        // Parchar obj 2
        $this->offsets[2] = strlen($this->buf);
        $this->buf .= "2 0 obj\n<</Type /Pages /Kids [{$pageObj} 0 R] /Count 1>>\nendobj\n";

        $xref = strlen($this->buf);
        $this->buf .= "xref\n0 " . ($this->nObj + 1) . "\n0000000000 65535 f \n";
        for ($i = 1; $i <= $this->nObj; $i++) {
            $this->buf .= sprintf("%010d 00000 n \n", $this->offsets[$i] ?? 0);
        }
        $this->buf .= "trailer\n<</Size " . ($this->nObj + 1) . " /Root 1 0 R>>\nstartxref\n{$xref}\n%%EOF\n";

        return $this->buf;
    }

    // ── Dibujar secciones ─────────────────────────────────────────────

    private function drawHeader(string $titulo, string $subtitulo,
                                string $modelo, string $periodo, string $eje): void
    {
        $h = 56;
        // Banda azul superior
        $this->rect(self::MARGIN, self::PAGE_H - self::MARGIN - $h,
                    self::PAGE_W - 2*self::MARGIN, $h, $this->colorAzul, true);
        // Logo texto "Agencia Tributaria"
        $this->text(self::MARGIN + 6, self::PAGE_H - self::MARGIN - 14, 'Agencia Tributaria', 8, true, $this->colorBlanco);
        $this->text(self::MARGIN + 6, self::PAGE_H - self::MARGIN - 26, 'Ministerio de Hacienda', 7, false, [0.8,0.88,0.96]);
        // Número de modelo (grande)
        $modeloX = self::PAGE_W - self::MARGIN - 120;
        $this->text($modeloX, self::PAGE_H - self::MARGIN - 18, 'Mod. ' . $modelo, 20, true, $this->colorBlanco);
        $this->text($modeloX, self::PAGE_H - self::MARGIN - 34, $eje . ' · ' . $periodo, 9, false, [0.8,0.88,0.96]);
        // Título
        $this->text(self::MARGIN + 6, self::PAGE_H - self::MARGIN - 44, $titulo, 9, true, $this->colorBlanco);
        $this->text(self::MARGIN + 6, self::PAGE_H - self::MARGIN - 55, $subtitulo, 7, false, [0.8,0.88,0.96]);

        $this->y = self::PAGE_H - self::MARGIN - $h - 6;
    }

    private function drawIdSection(string $nif, string $rs, string $periodo, string $eje): void
    {
        $this->y -= 4;
        $this->sectionLabel('DATOS IDENTIFICATIVOS DEL DECLARANTE');
        $this->fieldRow('N.I.F.', $nif);
        $this->fieldRow('Apellidos y nombre / Razón social', strtoupper($rs));
        $this->fieldRow('Ejercicio', $eje);
        $this->fieldRow('Período', $periodo);
        $this->y -= 4;
    }

    private function drawSection(string $titulo, array $casillas): void
    {
        $this->y -= 4;
        $this->sectionLabel($titulo);
        foreach ($casillas as [$num, $label, $tipo]) {
            $val = $this->cas[$num] ?? $this->cas[ltrim($num,'0')] ?? null;
            $this->casillasRow($num, $label, $val, $tipo === 'total');
        }
        $this->y -= 4;
    }

    private function drawFooter(string $nif, string $rs, string $periodo,
                                string $eje, string $modelo): void
    {
        $this->y -= 10;
        // Línea separadora
        $this->hline();
        $this->y -= 14;
        $this->text(self::MARGIN, $this->y, 'RESULTADO DE LA DECLARACIÓN', 8, true, $this->colorNegro);
        $this->y -= 4;

        // Caja de resultado / ingreso
        $resVal = $this->cas['71'] ?? $this->cas['11'] ?? $this->cas['30'] ?? 0;
        $isIngreso = ((float)$resVal) >= 0;
        $color = $isIngreso ? [0.7, 0.9, 0.7] : [0.9, 0.75, 0.75];
        $this->rect(self::MARGIN, $this->y - 22, 140, 22, $color, true);
        $this->rect(self::MARGIN, $this->y - 22, 140, 22, [0.7,0.7,0.7], false);
        $label = $isIngreso ? 'A INGRESAR' : 'A DEVOLVER';
        $this->text(self::MARGIN + 4, $this->y - 9, $label, 8, true, $this->colorNegro);
        $this->text(self::MARGIN + 4, $this->y - 18, number_format(abs((float)$resVal), 2, ',', '.') . ' €', 10, true, $this->colorNegro);

        // Código NRC / justificante
        $nrcX = self::MARGIN + 150;
        $this->rect($nrcX, $this->y - 22, 200, 22, $this->colorGris, true);
        $this->rect($nrcX, $this->y - 22, 200, 22, [0.7,0.7,0.7], false);
        $this->text($nrcX + 4, $this->y - 9, 'Número de referencia completo (NRC)', 7, false, [0.4,0.4,0.4]);
        $this->text($nrcX + 4, $this->y - 19, '___________________________', 8, false, [0.6,0.6,0.6]);

        $this->y -= 30;

        // Sello / firma
        $this->hline();
        $this->y -= 12;
        $this->text(self::MARGIN, $this->y,
            'Lugar, fecha y firma del declarante / Sello de la entidad colaboradora',
            7, false, [0.4,0.4,0.4]);
        $this->y -= 30;

        $fw = (self::PAGE_W - 2*self::MARGIN - 10) / 2;
        $this->rect(self::MARGIN, $this->y, $fw, 28, $this->colorGris, true);
        $this->rect(self::MARGIN + $fw + 10, $this->y, $fw, 28, $this->colorGris, true);
        $this->text(self::MARGIN + 4, $this->y + 18, 'Firma del declarante / Representante', 7, false, [0.5,0.5,0.5]);
        $this->text(self::MARGIN + $fw + 14, $this->y + 18, 'Sello de presentación / Gestoría', 7, false, [0.5,0.5,0.5]);

        $this->y -= 34;

        // Nota legal
        $this->text(self::MARGIN, $this->y,
            'Generado por Nexus AI Business OS · Documento de trabajo — verificar antes de presentar en sede.agenciatributaria.gob.es',
            6, false, [0.6,0.6,0.6]);
    }

    // ── Primitivas de layout ──────────────────────────────────────────

    private function sectionLabel(string $titulo): void
    {
        $y = $this->y;
        $this->rect(self::MARGIN, $y - 14, self::PAGE_W - 2*self::MARGIN, 14,
                    $this->colorAzul, true);
        $this->text(self::MARGIN + 4, $y - 3, strtoupper($titulo), 7, true, $this->colorBlanco);
        $this->y = $y - 14;
    }

    private function fieldRow(string $label, string $value): void
    {
        $y = $this->y;
        $h = 14;
        $w = self::PAGE_W - 2*self::MARGIN;
        // Fondo alternado
        $this->rect(self::MARGIN, $y - $h, $w, $h, $this->colorGris, true);
        $this->rect(self::MARGIN, $y - $h, $w, $h, [0.8,0.8,0.8], false);
        $this->text(self::MARGIN + 4, $y - 4, $label, 7, false, [0.3,0.3,0.3]);
        $this->text(self::MARGIN + self::COL1_W + 20, $y - 4, $value, 8, true, $this->colorNegro);
        $this->y = $y - $h;
    }

    private function casillasRow(string $num, string $label, $value, bool $isTotal): void
    {
        $y = $this->y;
        $h = 16;
        $w = self::PAGE_W - 2*self::MARGIN;

        // Fondo de fila
        $bg = $isTotal ? [0.82, 0.88, 0.96] : $this->colorBlanco;
        $this->rect(self::MARGIN, $y - $h, $w, $h, $bg, true);
        $this->rect(self::MARGIN, $y - $h, $w, $h, [0.82,0.82,0.82], false);

        // Número de casilla (en cuadro azul)
        $numW = 22;
        $this->rect(self::MARGIN, $y - $h, $numW, $h, $this->colorAzul, true);
        $this->text(self::MARGIN + 3, $y - 5, str_pad($num, 2, '0', STR_PAD_LEFT), 7, true, $this->colorBlanco);

        // Etiqueta
        $this->text(self::MARGIN + $numW + 4, $y - 5,
                    $this->truncate($label, 72), 7, $isTotal, $this->colorNegro);

        // Valor
        $valX = self::PAGE_W - self::MARGIN - 90;
        $strVal = $value !== null ? number_format((float)$value, 2, ',', '.') . ' €' : '';
        $this->text($valX, $y - 5, $strVal, 8, $isTotal, $isTotal ? $this->colorAzul : $this->colorNegro);

        // Línea vertical separadora antes del valor
        $this->vline($valX - 4, $y - $h, $h);

        $this->y = $y - $h;
    }

    private function hline(): void {
        $this->page .= sprintf("q 0.7 0.7 0.7 RG 0.5 w %d %d m %d %d l S Q\n",
            self::MARGIN, $this->y, self::PAGE_W - self::MARGIN, $this->y);
    }
    private function vline(int $x, int $y, int $h): void {
        $this->page .= sprintf("q 0.7 0.7 0.7 RG 0.3 w %d %d m %d %d l S Q\n", $x, $y, $x, $y + $h);
    }

    private function rect(int $x, int $y, int $w, int $h, array $color, bool $fill): void {
        [$r,$g,$b] = $color;
        if ($fill) {
            $this->page .= sprintf("q %.2f %.2f %.2f rg %d %d %d %d re f Q\n", $r,$g,$b,$x,$y,$w,$h);
        } else {
            $this->page .= sprintf("q %.2f %.2f %.2f RG 0.4 w %d %d %d %d re S Q\n", $r,$g,$b,$x,$y,$w,$h);
        }
    }

    private function text(int $x, int $y, string $text, int $size, bool $bold, array $color): void {
        [$r,$g,$b] = $color;
        $font = $bold ? '/F2' : '/F1';
        $safe = $this->esc($text);
        $this->page .= "BT {$font} {$size} Tf {$r} {$g} {$b} rg {$x} {$y} Td ({$safe}) Tj ET\n";
    }

    private function esc(string $s): string {
        $map = ['á'=>'á','é'=>'é','í'=>'í','ó'=>'ó','ú'=>'ú','ñ'=>'ñ',
                'Á'=>'Á','É'=>'É','Í'=>'Í','Ó'=>'Ó','Ú'=>'Ú','Ñ'=>'Ñ',
                'ü'=>'ü','Ü'=>'Ü','ç'=>'ç','°'=>'o',
                '('=>'\\(', ')'=>'\\)', '\\'=>'\\\\'];
        return strtr($s, $map);
    }

    private function truncate(string $s, int $max): string {
        return mb_strlen($s) > $max ? mb_substr($s, 0, $max - 1) . '…' : $s;
    }

    // ── PDF internals ─────────────────────────────────────────────────
    private function obj(): int {
        $this->nObj++;
        $this->offsets[$this->nObj] = strlen($this->buf);
        $this->buf .= $this->nObj . " 0 obj\n";
        return $this->nObj;
    }
    private function endobj(): void { $this->buf .= "endobj\n"; }
    private function stream(string $data): void {
        $this->buf .= "<<\n/Length " . strlen($data) . "\n>>\nstream\n" . $data . "\nendstream\n";
    }
}
