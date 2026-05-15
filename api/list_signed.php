<?php
/**
 * Nexus AI — list_signed.php
 * Lista los documentos firmados del gestor autenticado.
 * Filtra opcionalmente por empresa_id.
 *
 * GET /api/list_signed.php[?empresa_id=uuid]
 * Authorization: Bearer <supabase_jwt>
 *
 * Response:
 * {
 *   "ok": true,
 *   "docs": [
 *     {
 *       "ref": "NX-MABCDE-F1A2",
 *       "empresa": "Innova Apps S.L.",
 *       "doc_tipo": "Poder notarial",
 *       "timestamp_firma": "2026-04-13T14:32:00Z",
 *       "formato": "P7S",
 *       "file_size": 48230,
 *       "url": "/dashboard/api/get_signed.php?ref=NX-MABCDE-F1A2"
 *     }, ...
 *   ]
 * }
 */

require_once __DIR__ . '/auth.php';

$user       = nx_auth_required();
$empresa_id = trim($_GET['empresa_id'] ?? '');

// ── Consultar Supabase ────────────────────────────────────────────────
$params = [
    'gestor_id' => 'eq.' . $user['id'],
    'order'     => 'timestamp_firma.desc',
    'limit'     => '100',
];
if ($empresa_id) {
    $params['empresa_id'] = 'eq.' . $empresa_id;
}

$qs  = http_build_query($params);
$url = NX_SUPABASE_URL . '/rest/v1/firma_docs?select=*&' . $qs;

$ctx = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => implode("\r\n", [
            'Authorization: ' . ($_SERVER['HTTP_AUTHORIZATION'] ?? ''),
            'apikey: ' . NX_SUPABASE_KEY,
        ]),
        'timeout' => 5,
        'ignore_errors' => true,
    ]
]);

$resp = @file_get_contents($url, false, $ctx);
$rows = ($resp ? json_decode($resp, true) : null) ?? [];

// Si Supabase no responde, leer desde disco como fallback
if (empty($rows) && is_dir(NX_SIGNED_DIR)) {
    $rows = [];
    foreach (glob(NX_SIGNED_DIR . '/NX-*.{p7s,pdf}', GLOB_BRACE) as $f) {
        $ref = basename($f, '.' . pathinfo($f, PATHINFO_EXTENSION));
        $rows[] = [
            'ref'             => $ref,
            'empresa'         => '—',
            'doc_tipo'        => '—',
            'timestamp_firma' => date('Y-m-d\TH:i:s\Z', filemtime($f)),
            'formato'         => strtoupper(pathinfo($f, PATHINFO_EXTENSION)),
            'file_size'       => filesize($f),
        ];
    }
}

// Añadir URL de descarga
$docs = array_map(function($row) {
    $row['url'] = '/dashboard/api/get_signed.php?ref=' . urlencode($row['ref'] ?? '');
    return $row;
}, $rows);

nx_json(['ok' => true, 'docs' => $docs, 'total' => count($docs)]);
