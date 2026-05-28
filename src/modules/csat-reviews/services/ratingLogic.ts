/**
 * Mapeamento de nota numerica (1-5) pra representacao binaria
 * like/dislike, que e o que a plataforma da Rocketseat aceita hoje.
 *
 * - Novas entradas: a plataforma so grava 1 (dislike) ou 5 (like).
 * - Entradas legadas: ainda existem 2, 3 e 4 no banco. Usamos o
 *   criterio CSAT top-2-box (>= 4 = satisfeito) pra binarizar — assim
 *   um 4/5 historico aparece como curtiu, e 1/2/3 como nao curtiu.
 *
 * Centralizado neste arquivo pra manter a politica em um lugar so:
 * se um dia mudarmos o ponto de corte (ex: top-3-box), basta editar
 * `LIKE_THRESHOLD` aqui.
 */

export const LIKE_THRESHOLD = 4;

export function isLike(stars: number): boolean {
  return Number.isFinite(stars) && stars >= LIKE_THRESHOLD;
}

export function ratingLabel(like: boolean): string {
  return like ? ':+1: Curtiu' : ':-1: Não curtiu';
}
