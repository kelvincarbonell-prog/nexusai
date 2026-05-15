<?php
/**
 * Nexus AI — Auth helper para endpoints de firma
 * Valida el JWT de Supabase antes de procesar cualquier petición
 *
 * Uso en cada endpoint:
 *   require_once __DIR__ . '/auth.php';
 *   $user = nx_auth_required();  // termina con 401 si no está autenticado
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');   // En producción: cambiar por tu dominio
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-NX-Token');

// Preflight CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Config ────────────────────────────────────────────────────────────
// Tu URL de Supabase y anon key.
// IMPORTANTE: reemplaza estos valores con los tuyos reales.
define('NX_SUPABASE_URL',  getenv('NX_SUPABASE_URL')  ?: 'https://tewmywtgkqeaiyqbrgnk.supabase.co');
define('NX_SUPABASE_KEY',  getenv('NX_SUPABASE_KEY')  ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRld215d3Rna3FlYWl5cWJyZ25rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTA0MjYsImV4cCI6MjA5MTIyNjQyNn0.Qxwvz2P72ImBfydFcoaHQHTW-csk3vXbk5tXNmN0dY0');

// Directorio donde se guardan los PDFs firmados
// En SiteGround: /home/[user]/public_html/dashboard/uploads/signed/
define('NX_SIGNED_DIR',    __DIR__ . '/uploads/signed');
define('NX_SIGNED_URL',    '/dashboard/api/uploads/signed'); // URL relativa pública

// ── Helpers ───────────────────────────────────────────────────────────

function nx_json(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function nx_error(string $msg, int $code = 400): void {
    nx_json(['ok' => false, 'error' => $msg], $code);
}

/**
 * Valida el JWT de Supabase llamando a /auth/v1/user
 * Devuelve el array del usuario o termina con 401
 */
function nx_auth_required(): array {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (empty($auth) || !str_starts_with($auth, 'Bearer ')) {
        nx_error('No autorizado — falta token', 401);
    }
    $token = substr($auth, 7);

    $ctx = stream_context_create([
        'http' => [
            'method'  => 'GET',
            'header'  => implode("\r\n", [
                'Authorization: Bearer ' . $token,
                'apikey: ' . NX_SUPABASE_KEY,
            ]),
            'timeout' => 5,
            'ignore_errors' => true,
        ]
    ]);

    $resp = @file_get_contents(NX_SUPABASE_URL . '/auth/v1/user', false, $ctx);
    if ($resp === false) {
        nx_error('No se pudo verificar el token — error de conexión con Supabase', 503);
    }

    $user = json_decode($resp, true);
    if (empty($user['id'])) {
        nx_error('Token inválido o expirado', 401);
    }

    return $user;
}

/**
 * Genera un ID de referencia único estilo NX-XXXXXX-XXXX
 */
function nx_ref(): string {
    $ts  = base_convert((string)time(), 10, 36);
    $rnd = strtoupper(substr(bin2hex(random_bytes(3)), 0, 4));
    return 'NX-' . strtoupper($ts) . '-' . $rnd;
}

/**
 * Asegura que el directorio de uploads existe y está protegido
 */
function nx_ensure_dir(): void {
    if (!is_dir(NX_SIGNED_DIR)) {
        mkdir(NX_SIGNED_DIR, 0750, true);
        // Bloquear acceso directo al directorio
        file_put_contents(NX_SIGNED_DIR . '/.htaccess',
            "Options -Indexes\n<FilesMatch \"\\.pdf$\">\n  Require valid-user\n</FilesMatch>\n"
        );
    }
}
