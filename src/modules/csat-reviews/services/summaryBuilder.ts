import { CsatFeedback } from './skylabClient';
import { isLike } from './ratingLogic';

export interface CsatSummary {
  total: number;
  withComment: number;
  withoutComment: number;
  likes: number;
  dislikes: number;
  likeRate: number; // 0..1
}

export function buildSummary(feedbacks: CsatFeedback[]): CsatSummary {
  const total = feedbacks.length;
  let withComment = 0;
  let likes = 0;

  for (const f of feedbacks) {
    if (f.comment && f.comment.trim().length > 0) withComment++;
    if (isLike(f.stars)) likes++;
  }

  const dislikes = total - likes;
  return {
    total,
    withComment,
    withoutComment: total - withComment,
    likes,
    dislikes,
    likeRate: total > 0 ? likes / total : 0,
  };
}

/**
 * Texto da mensagem-pai da thread (resumo).
 */
export function summaryMessage(opts: {
  dateLabel: string;
  summary: CsatSummary;
}): string {
  const { summary, dateLabel } = opts;
  const lines: string[] = [];
  lines.push(`*Resumo dos feedbacks — ${dateLabel}*`);
  lines.push('');
  lines.push(`• Total de avaliações: *${summary.total}*`);
  lines.push(`• Com comentário: *${summary.withComment}*`);
  lines.push(`• Sem comentário: *${summary.withoutComment}*`);
  lines.push('');
  const likePct = summary.total > 0 ? Math.round(summary.likeRate * 100) : 0;
  const dislikePct = summary.total > 0 ? 100 - likePct : 0;
  lines.push(`• :+1: Curtidas: *${summary.likes}* (${likePct}%)`);
  lines.push(`• :-1: Não curtidas: *${summary.dislikes}* (${dislikePct}%)`);
  return lines.join('\n');
}
