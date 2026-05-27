import crypto from 'node:crypto';

/**
 * Verifica a assinatura do Slack em requests do Events API e Interactivity.
 * Documentacao: https://api.slack.com/authentication/verifying-requests-from-slack
 *
 * O Slack envia dois headers:
 *  - X-Slack-Request-Timestamp: epoch seconds do request
 *  - X-Slack-Signature: HMAC-SHA256 de `v0:{timestamp}:{rawBody}` usando
 *    o signing secret, prefixado por "v0="
 *
 * Aborta se o timestamp tiver mais de 5 minutos (anti-replay).
 *
 * IMPORTANTE: precisa do raw body antes do JSON.parse. O Express com
 * `express.json()` joga fora o raw — por isso a rota usa
 * `express.raw({ type: '*\/*' })` e parseia manualmente depois.
 */
export function verifySlackSignature(opts: {
  signingSecret: string;
  timestampHeader: string | undefined;
  signatureHeader: string | undefined;
  rawBody: string;
}): { valid: boolean; reason?: string } {
  const { signingSecret, timestampHeader, signatureHeader, rawBody } = opts;

  if (!signingSecret) return { valid: false, reason: 'signing secret ausente' };
  if (!timestampHeader || !signatureHeader) {
    return { valid: false, reason: 'headers do Slack ausentes' };
  }

  const timestamp = parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestamp)) {
    return { valid: false, reason: 'timestamp invalido' };
  }

  const FIVE_MINUTES = 5 * 60;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > FIVE_MINUTES) {
    return { valid: false, reason: 'timestamp fora da janela de replay' };
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');
  const expected = `v0=${hmac}`;

  // timingSafeEqual exige buffers do mesmo tamanho — se nao bater, ja falha.
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return { valid: false, reason: 'tamanho de assinatura diferente' };
  if (!crypto.timingSafeEqual(a, b)) return { valid: false, reason: 'assinatura nao bate' };

  return { valid: true };
}
