<?php
/**
 * Nexus AI — gen_doc.php
 * Genera el PDF del documento a firmar y lo devuelve como base64
 *
 * POST /api/gen_doc.php
 * Authorization: Bearer <supabase_jwt>
 * Content-Type: application/json
 *
 * Body:
 * {
 *   "doc_tipo":   "Poder notarial",
 *   "empresa_id": "uuid-de-la-empresa",
 *   "empresa":    "Innova Apps S.L.",
 *   "nif":        "B12398765",
 *   "gestoria":   "Gabinete Nexus Asesores",
 *   "gestor":     "María García",
 *   "descripcion":"Autorización al gestor para actuar ante la AEAT...",
 *   "fecha":      "13/04/2026"
 * }
 *
 * Response:
 * {
 *   "ok":    true,
 *   "ref":   "NX-MABCDE-F1A2",
 *   "b64":   "<base64 del PDF>",
 *   "hash":  "<sha256 del PDF>",
 *   "filename": "NX-MABCDE-F1A2.pdf"
 * }
 */

require_once __DIR__ . '/auth.php';

// ── Auth ──────────────────────────────────────────────────────────────
$user = nx_auth_required();

// ── Input ─────────────────────────────────────────────────────────────
$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!$body) {
    nx_error('Body JSON inválido');
}

$doc_tipo   = trim($body['doc_tipo']   ?? 'Documento');
$empresa    = trim($body['empresa']    ?? '—');
$nif        = trim($body['nif']        ?? '—');
$gestoria   = trim($body['gestoria']   ?? 'Mi Gestoría');
$gestor     = trim($body['gestor']     ?? '—');
$descripcion= trim($body['descripcion'] ?? '');
$fecha      = trim($body['fecha']      ?? date('d/m/Y'));
$ref        = nx_ref();

// ── Generar PDF ───────────────────────────────────────────────────────
// Usamos la clase NexusPDF incluida abajo — no requiere dependencias externas.
// Si tienes FPDF en el servidor, descomenta la alternativa al final del archivo.

$pdf  = new NexusPDF();
$pdf->addPage($doc_tipo, $gestoria);
$pdf->addHeader($doc_tipo, $ref, $fecha);
$pdf->addSection('DATOS DE LA PARTE FIRMANTE', [
    ['Cliente / Empresa', $empresa],
    ['NIF / CIF',         $nif],
    ['Asesor responsable', $gestor],
    ['Gestoría',          $gestoria],
]);
$pdf->addSection('OBJETO DEL DOCUMENTO', []);
$pdf->addParagraph($descripcion ?: 'Documento generado por Nexus AI Business OS para firma electrónica con certificado cualificado.');
$pdf->addSection('INFORMACIÓN DE FIRMA', [
    ['Referencia Nexus AI', $ref],
    ['Fecha de generación',  date('d/m/Y H:i:s')],
    ['Plataforma',           'Nexus AI Business OS — kelvinc8.sg-host.com'],
    ['Normativa aplicable',  'Reglamento eIDAS (UE) 910/2014 · Ley 6/2020'],
]);
$pdf->addSignatureBlock();
$pdfBytes = $pdf->output();

// ── Respuesta ─────────────────────────────────────────────────────────
nx_json([
    'ok'       => true,
    'ref'      => $ref,
    'b64'      => base64_encode($pdfBytes),
    'hash'     => hash('sha256', $pdfBytes),
    'filename' => $ref . '.pdf',
    'size'     => strlen($pdfBytes),
]);


// ═══════════════════════════════════════════════════════════════════════
// NexusPDF — Generador de PDF mínimo sin dependencias externas
// Genera un PDF 1.4 estático con tipografía Helvetica embebida.
// ═══════════════════════════════════════════════════════════════════════
class NexusPDF {

    private string $buf = '';
    private array  $offsets = [];
    private int    $objCount = 0;
    private array  $pages = [];
    private string $currentPage = '';
    private int    $y = 700;  // posición vertical actual (puntos, origen abajo)
    private int    $pageHeight = 842;
    private int    $pageWidth  = 595;
    private int    $marginL    = 60;
    private int    $marginR    = 60;

    // ── Internals ────────────────────────────────────────────────────

    private function obj(): int {
        $this->objCount++;
        $this->offsets[$this->objCount] = strlen($this->buf);
        $this->buf .= $this->objCount . " 0 obj\n";
        return $this->objCount;
    }

    private function endobj(): void {
        $this->buf .= "endobj\n";
    }

    private function stream(string $data): void {
        $this->buf .= "<<\n/Length " . strlen($data) . "\n>>\nstream\n" . $data . "\nendstream\n";
    }

    private function escStr(string $s): string {
        // Sustituir caracteres especiales para PDF text strings
        $map = ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ñ'=>'n',
                'Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U','Ñ'=>'N',
                'ü'=>'u','Ü'=>'U','ç'=>'c','Ç'=>'C',
                '('=>'\\(', ')'=>'\\)', '\\'=>'\\\\'];
        return strtr($s, $map);
    }

    // ── API pública ──────────────────────────────────────────────────

    public function addPage(string $title, string $gestoria): void {
        $this->y = $this->pageHeight - 80;
    }

    public function addHeader(string $title, string $ref, string $fecha): void {
        // Banda superior indigo
        $this->currentPage .= "q\n0.310 0.275 0.918 rg\n"
            . "{$this->marginL} " . ($this->pageHeight - 70) . " "
            . ($this->pageWidth - $this->marginL - $this->marginR) . " 55 re\nf\nQ\n";
        // Título en blanco
        $this->currentPage .= "BT\n/F2 16 Tf\n1 1 1 rg\n"
            . ($this->marginL + 10) . " " . ($this->pageHeight - 47) . " Td\n"
            . "(" . $this->escStr($title) . ") Tj\nET\n";
        // Ref y fecha
        $this->currentPage .= "BT\n/F1 8 Tf\n0.62 0.62 0.62 rg\n"
            . ($this->pageWidth - $this->marginR - 160) . " " . ($this->pageHeight - 47) . " Td\n"
            . "(" . $this->escStr($ref . "  ·  " . $fecha) . ") Tj\nET\n";
        $this->y = $this->pageHeight - 100;
    }

    public function addSection(string $title, array $rows): void {
        $this->y -= 14;
        // Fondo gris muy sutil
        $this->currentPage .= "q\n0.95 0.95 0.97 rg\n"
            . "{$this->marginL} " . ($this->y - 4) . " "
            . ($this->pageWidth - $this->marginL - $this->marginR) . " 16 re\nf\nQ\n";
        // Texto sección
        $this->currentPage .= "BT\n/F2 9 Tf\n0.31 0.275 0.918 rg\n"
            . ($this->marginL + 4) . " {$this->y} Td\n"
            . "(" . $this->escStr(strtoupper($title)) . ") Tj\nET\n";
        $this->y -= 18;

        foreach ($rows as [$label, $value]) {
            $this->currentPage .= "BT\n/F2 9 Tf\n0.45 0.45 0.45 rg\n"
                . ($this->marginL + 4) . " {$this->y} Td\n"
                . "(" . $this->escStr($label . ":") . ") Tj\nET\n";
            $this->currentPage .= "BT\n/F1 9 Tf\n0 0 0 rg\n"
                . ($this->marginL + 120) . " {$this->y} Td\n"
                . "(" . $this->escStr($value) . ") Tj\nET\n";
            $this->y -= 14;
        }
    }

    public function addParagraph(string $text): void {
        $this->y -= 4;
        $maxW = $this->pageWidth - $this->marginL - $this->marginR - 8;
        // Cortar texto en líneas de ~90 chars
        $words  = explode(' ', $text);
        $line   = '';
        $lines  = [];
        foreach ($words as $word) {
            if (strlen($line . ' ' . $word) > 95) {
                $lines[] = trim($line);
                $line = $word;
            } else {
                $line .= ' ' . $word;
            }
        }
        if ($line) $lines[] = trim($line);

        foreach ($lines as $l) {
            $this->currentPage .= "BT\n/F1 9 Tf\n0 0 0 rg\n"
                . ($this->marginL + 4) . " {$this->y} Td\n"
                . "(" . $this->escStr($l) . ") Tj\nET\n";
            $this->y -= 13;
        }
        $this->y -= 6;
    }

    public function addSignatureBlock(): void {
        $this->y -= 30;
        $w = ($this->pageWidth - $this->marginL - $this->marginR - 20) / 2;
        // Caja firmante
        $this->currentPage .= "q\n0.93 0.93 0.97 RG\n0.5 w\n"
            . "{$this->marginL} " . ($this->y - 60) . " {$w} 60 re\nS\nQ\n";
        $this->currentPage .= "BT\n/F1 8 Tf\n0.5 0.5 0.5 rg\n"
            . ($this->marginL + 4) . " " . ($this->y - 14) . " Td\n"
            . "(Firma del cliente / firmante) Tj\nET\n";
        // Caja gestor
        $x2 = $this->marginL + $w + 20;
        $this->currentPage .= "q\n0.93 0.93 0.97 RG\n0.5 w\n"
            . "{$x2} " . ($this->y - 60) . " {$w} 60 re\nS\nQ\n";
        $this->currentPage .= "BT\n/F1 8 Tf\n0.5 0.5 0.5 rg\n"
            . ($x2 + 4) . " " . ($this->y - 14) . " Td\n"
            . "(Sello / firma de la gestoría) Tj\nET\n";

        $this->y -= 80;
        $this->currentPage .= "BT\n/F1 7 Tf\n0.6 0.6 0.6 rg\n"
            . "{$this->marginL} " . ($this->y) . " Td\n"
            . "(Este documento ha sido generado para firma electronica avanzada (AdES) bajo el Reglamento eIDAS (UE) 910/2014 y la Ley 6/2020.) Tj\nET\n";
    }

    // ── Construir PDF binario ────────────────────────────────────────

    public function output(): string {
        $this->buf = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";  // header con bytes binarios

        // Objeto 1: catálogo
        $this->obj();
        $this->buf .= "<</Type /Catalog /Pages 2 0 R>>\n";
        $this->endobj();

        // Objeto 2: páginas
        $this->obj(); // placeholder
        $this->endobj();

        // Fuentes
        $this->obj(); // 3 — F1 Helvetica
        $this->buf .= "<</Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding>>\n";
        $this->endobj();

        $this->obj(); // 4 — F2 Helvetica-Bold
        $this->buf .= "<</Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding>>\n";
        $this->endobj();

        // Recursos
        $resObj = $this->obj(); // 5
        $this->buf .= "<</Font <</F1 3 0 R /F2 4 0 R>>>>\n";
        $this->endobj();

        // Contenido de la página
        $contentObj = $this->obj(); // 6
        $this->stream($this->currentPage);
        $this->endobj();

        // Página
        $pageObj = $this->obj(); // 7
        $this->buf .= "<</Type /Page /Parent 2 0 R\n"
            . "/MediaBox [0 0 {$this->pageWidth} {$this->pageHeight}]\n"
            . "/Contents {$contentObj} 0 R\n"
            . "/Resources {$resObj} 0 R\n"
            . ">>\n";
        $this->endobj();

        // Parchar objeto 2 (pages) con referencia real
        // Re-escribimos de forma simple buscando el objeto en el buffer
        $this->offsets[2] = strlen($this->buf);
        $pagesUpdate = "2 0 obj\n<</Type /Pages /Kids [{$pageObj} 0 R] /Count 1>>\nendobj\n";
        $this->buf .= $pagesUpdate;

        // XRef table
        $xrefOffset = strlen($this->buf);
        $this->buf .= "xref\n0 " . ($this->objCount + 1) . "\n";
        $this->buf .= "0000000000 65535 f \n";
        for ($i = 1; $i <= $this->objCount; $i++) {
            $this->buf .= sprintf("%010d 00000 n \n", $this->offsets[$i] ?? 0);
        }

        $this->buf .= "trailer\n<</Size " . ($this->objCount + 1) . " /Root 1 0 R>>\n";
        $this->buf .= "startxref\n{$xrefOffset}\n%%EOF\n";

        return $this->buf;
    }
}

/*
 * ── ALTERNATIVA CON FPDF ──────────────────────────────────────────────
 * Si tienes FPDF instalado en /dashboard/api/fpdf/fpdf.php:
 *
 *   require_once __DIR__ . '/fpdf/fpdf.php';
 *
 *   class NexusFPDF extends FPDF {
 *       function Header() { ... }
 *       function Footer() { ... }
 *   }
 *
 *   $pdf = new NexusFPDF();
 *   $pdf->AddPage();
 *   $pdf->SetFont('Arial','B',16);
 *   $pdf->Cell(0,10,$doc_tipo,0,1,'C');
 *   // ...
 *   $pdfBytes = $pdf->Output('S');  // 'S' = string
 *
 * Descarga FPDF en: http://www.fpdf.org/
 * ─────────────────────────────────────────────────────────────────────
 */
