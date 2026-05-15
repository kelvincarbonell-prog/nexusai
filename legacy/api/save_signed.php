<?php
/**
 * Nexus AI — save_signed.php
 * Recibe el documento firmado (base64 CAdES/PAdES) y lo almacena.
 * Guarda metadatos en Supabase tabla `firma_docs`.
 *
 * POST /api/save_signed.php
 * Authorization: Bearer <supabase_jwt>
 * Content-Type: application/json
 *
 * Body:
 * {
 *   "ref":          "NX-MABCDE-F1A2",
 *   "empresa_id":   "uuid",
 *   "empresa":      "Innova Apps S.L.",
 *   "doc_tipo":     "Poder notarial",
 *   "signed_b64":   "<base64 CAdES firmado>",
 *   "original_hash":"sha256 del PDF original",
 *   "cert_info":    "FNMT · Juan García · Válido hasta 2027-03-15"  (opcional)
 * }
 *
 * Response:
 * {
 *   "ok":        true,
 *   "ref":       "NX-MABCDE-F1A2",
 *   "filename":  "NX-MABCDE-F1A2.p7s",
 *   "url":       "/dashboard/api/get_signed.php?ref=NX-MABCDE-F1A2",
 *   "timestamp": "2026-04-13T14:32:00Z",
 *   "size":      48230
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

$ref           = preg_replace('/[^A-Z0-9\-]/', '', strtoupper($body['ref'] ?? nx_ref()));
$empresa_id    = trim($body['empresa_id']   ?? '');
$empresa       = trim($body['empresa']      ?? 'Sin nombre');
$doc_tipo      = trim($body['doc_tipo']     ?? 'Documento');
$signed_b64    = $body['signed_b64']        ?? '';
$original_hash = trim($body['original_hash'] ?? '');
$cert_info     = trim($body['cert_info']    ?? '');

if (empty($signed_b64)) {
    nx_error('signed_b64 está vacío');
}

// Decodificar y validar tamaño (máx 10 MB)
$signedBytes = base64_decode($signed_b64, true);
if ($signedBytes === false) {
    nx_error('signed_b64 no es base64 válido');
}
if (strlen($signedBytes) > 10 * 1024 * 1024) {
    nx_error('Documento demasiado grande (máx 10 MB)');
}

// ── Guardar fichero ───────────────────────────────────────────────────
nx_ensure_dir();

// Detectar si es CAdES (.p7s) o PAdES (.pdf) por magic bytes
$ext      = (substr($signedBytes, 0, 4) === '%PDF') ? 'pdf' : 'p7s';
$filename = $ref . '.' . $ext;
$path     = NX_SIGNED_DIR . '/' . $filename;

if (file_put_contents($path, $signedBytes) === false) {
    nx_error('Error guardando el fichero en disco', 500);
}

// Calcular hash del documento firmado (evidencia de integridad)
$signedHash = hash('sha256', $signedBytes);
$timestamp  = gmdate('Y-m-d\TH:i:s\Z');

// ── Guardar metadatos en Supabase ─────────────────────────────────────
// Tabla: firma_docs (ver setup.sql)
$meta = [
    'ref'           => $ref,
    'empresa_id'    => $empresa_id ?: null,
    'empresa'       => $empresa,
    'doc_tipo'      => $doc_tipo,
    'gestor_id'     => $user['id'],
    'gestor_email'  => $user['email'] ?? '',
    'original_hash' => $original_hash,
    'signed_hash'   => $signedHash,
    'cert_info'     => $cert_info,
    'filename'      => $filename,
    'file_size'     => strlen($signedBytes),
    'timestamp_firma' => $timestamp,
    'formato'       => strtoupper($ext),
];

$sbResp = nx_supabase_insert('firma_docs', $meta, $user);
// No bloqueamos si Supabase falla — el fichero ya está guardado en disco

// ── Respuesta ─────────────────────────────────────────────────────────
nx_json([
    'ok'        => true,
    'ref'       => $ref,
    'filename'  => $filename,
    'url'       => '/dashboard/api/get_signed.php?ref=' . urlencode($ref),
    'timestamp' => $timestamp,
    'size'      => strlen($signedBytes),
    'hash'      => $signedHash,
    'formato'   => strtoupper($ext),
]);

// ── Helper: insertar en Supabase ──────────────────────────────────────
function nx_supabase_insert(string $table, array $data, array $user): ?array {
    $auth    = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    $payload = json_encode($data);

    $ctx = stream_context_create([
        'http' => [
            'method'      => 'POST',
            'header'      => implode("\r\n", [
                'Content-Type: application/json',
                'Authorization: ' . $auth,
                'apikey: ' . NX_SUPABASE_KEY,
                'Prefer: return=representation',
            ]),
            'content'     => $payload,
            'timeout'     => 5,
            'ignore_errors' => true,
        ]
    ]);

    $resp = @file_get_contents(
        NX_SUPABASE_URL . '/rest/v1/' . $table,
        false,
        $ctx
    );

    return $resp ? json_decode($resp, true) : null;
}
