<?php

namespace App\Libraries;

/**
 * Email notification service using CodeIgniter's Email library.
 * All sends are wrapped in try/catch — never breaks the main request.
 *
 * Configuration via .env:
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS,
 *   EMAIL_FROM, EMAIL_FROM_NAME, EMAIL_ENABLED
 */
class EmailService
{
    private static bool $enabled;

    private static function isEnabled(): bool
    {
        if (!isset(self::$enabled)) {
            self::$enabled = filter_var(env('EMAIL_ENABLED', 'false'), FILTER_VALIDATE_BOOLEAN);
        }
        return self::$enabled;
    }

    /**
     * Send a raw email.
     */
    public static function send(string $to, string $subject, string $body, bool $html = true): bool
    {
        if (!self::isEnabled()) {
            log_message('debug', "EmailService: disabled, skipping email to {$to}: {$subject}");
            return false;
        }

        try {
            $email = \Config\Services::email();
            $email->initialize([
                'protocol'  => 'smtp',
                'SMTPHost'  => env('EMAIL_HOST', 'localhost'),
                'SMTPPort'  => (int) env('EMAIL_PORT', 587),
                'SMTPUser'  => env('EMAIL_USER', ''),
                'SMTPPass'  => env('EMAIL_PASS', ''),
                'SMTPCrypto'=> 'tls',
                'mailType'  => $html ? 'html' : 'text',
                'charset'   => 'utf-8',
                'newline'   => "\r\n",
            ]);

            $email->setFrom(env('EMAIL_FROM', 'noreply@piap.local'), env('EMAIL_FROM_NAME', 'PIAP'));
            $email->setTo($to);
            $email->setSubject($subject);
            $email->setMessage($body);

            $sent = $email->send(false);
            if (!$sent) {
                log_message('error', 'EmailService send failed: ' . $email->printDebugger(['headers']));
            }
            return $sent;
        } catch (\Throwable $e) {
            log_message('error', 'EmailService exception: ' . $e->getMessage());
            return false;
        }
    }

    // ── Pre-built templates ─────────────────────────────────────────────────────

    private static function wrap(string $title, string $content): string
    {
        $appName = env('EMAIL_FROM_NAME', 'MaeWallisCorp PIAP');
        $frontUrl = env('APP_FRONTEND_URL', 'https://piap.maewalliscorp.org');
        return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;margin:0;padding:20px}
  .card{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .header{background:#6366f1;padding:24px;color:#fff}
  .header h1{margin:0;font-size:20px}
  .body{padding:24px;color:#334155;line-height:1.6}
  .btn{display:inline-block;background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px}
  .footer{padding:16px 24px;background:#f1f5f9;font-size:12px;color:#94a3b8;text-align:center}
</style></head>
<body>
<div class="card">
  <div class="header"><h1>$appName</h1></div>
  <div class="body"><h2 style="margin-top:0;color:#1e293b">$title</h2>$content</div>
  <div class="footer">
    <a href="$frontUrl" style="color:#6366f1">Ir a la plataforma</a> · Este mensaje es automático, no respondas.
  </div>
</div>
</body></html>
HTML;
    }

    public static function mention(string $toEmail, string $toName, string $byName, string $taskTitle, string $taskUrl): bool
    {
        $body = self::wrap(
            '¡Te han mencionado!',
            "<p>Hola <strong>$toName</strong>,</p>
             <p><strong>$byName</strong> te mencionó en un comentario de la tarea <em>$taskTitle</em>.</p>
             <a class='btn' href='$taskUrl'>Ver comentario</a>"
        );
        return self::send($toEmail, "Te mencionaron en \"$taskTitle\"", $body);
    }

    public static function taskStatusChanged(string $toEmail, string $toName, string $taskTitle, string $oldStatus, string $newStatus, string $taskUrl): bool
    {
        $body = self::wrap(
            'Estado de tarea actualizado',
            "<p>Hola <strong>$toName</strong>,</p>
             <p>La tarea <em>$taskTitle</em> cambió de <strong>$oldStatus</strong> a <strong>$newStatus</strong>.</p>
             <a class='btn' href='$taskUrl'>Ver tarea</a>"
        );
        return self::send($toEmail, "Tarea actualizada: $taskTitle", $body);
    }

    public static function milestoneOverdue(string $toEmail, string $toName, string $milestoneName, string $projectName, string $dueDate, string $url): bool
    {
        $body = self::wrap(
            '⚠ Hito vencido',
            "<p>Hola <strong>$toName</strong>,</p>
             <p>El hito <em>$milestoneName</em> del proyecto <strong>$projectName</strong>
             venció el <strong>$dueDate</strong> y aún no está completado.</p>
             <a class='btn' href='$url'>Ver proyecto</a>"
        );
        return self::send($toEmail, "Hito vencido: $milestoneName", $body);
    }

    public static function reminder(string $toEmail, string $toName, string $taskTitle, string $taskUrl): bool
    {
        $body = self::wrap(
            '⏰ Recordatorio de tarea',
            "<p>Hola <strong>$toName</strong>,</p>
             <p>Este es tu recordatorio para la tarea: <em>$taskTitle</em>.</p>
             <a class='btn' href='$taskUrl'>Ver tarea</a>"
        );
        return self::send($toEmail, "Recordatorio: $taskTitle", $body);
    }

    public static function docApproved(string $toEmail, string $toName, string $docTitle, string $projectName, string $url): bool
    {
        $body = self::wrap(
            '✅ Documento aprobado',
            "<p>Hola <strong>$toName</strong>,</p>
             <p>El documento <em>$docTitle</em> del proyecto <strong>$projectName</strong>
             ha sido <strong>aprobado</strong>.</p>
             <a class='btn' href='$url'>Ver documento</a>"
        );
        return self::send($toEmail, "Documento aprobado: $docTitle", $body);
    }
}
