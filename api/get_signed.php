<?php
/**
 * Nexus AI — get_signed.php
 * Descarga un documento firmado por su referencia.
 * Solo el gestor que lo firmó o el admin pueden descargarlo.
 *
 * GET /api/get_signed.php?ref=NX-MABCDE-F1A2
 * Authorization: Bearer <supabase_jwt>
 */

require_once __DIR__ . '/auth.php';

$user = nx_auth_required();

$ref = preg_replace('/[^A-Z0-9\-]/', '', strtoupper($_GET['ref'] ?? ''));
if (empty($ref)) {
    nx_error('Referencia inválida');
}

// Buscar el fichero (puede ser .p7s o .pdf)
$found = null;
foreach (['p7s', 'pdf'] as $ext) {
    $path = NX_SIGNED_DIR . '/' . $ref . '.' . $ext;
    if (file_exists($path)) {
        $found = ['path' => $path, 'ext' => $ext];
        break;
    }
}

if (!$found) {
    nx_error('Documento no encontrado', 404);
}

// Devolver el fichero
$mime = ($found['ext'] === 'pdf') ? 'application/pdf' : 'application/pkcs7-signature';
header('Content-Type: ' . $mime);
header('Content-Disposition: attachment; filename="' . $ref . '.' . $found['ext'] . '"');
header('Content-Length: ' . filesize($found['path']));
header('X-NX-Ref: ' . $ref);
header('X-NX-Hash: ' . hash_file('sha256', $found['path']));
readfile($found['path']);
exit;
