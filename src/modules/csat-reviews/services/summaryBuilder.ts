import { CsatFeedback } from './metabaseClient';

export interface CsatSummary {
  total: number;
  withComment: number;
  withoutComment: number;
  averageStars: number;
  byStars: Record<string, number>;
}

export function buildSummary(feedbacks: CsatFeedback[]): CsatSummary {
  const total = feedbacks.length;
  let withComment = 0;
  let sumStars = 0;
  const byStars: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

  for (const f of feedbacks) {
    if (f.comment && f.comment.trim().length > 0) withComment++;
    sumStars += Number.isFinite(f.stars) ? f.stars : 0;
    const key = String(Math.max(1, Math.min(5, Math.round(f.stars))));
    byStars[key] = (byStars[key] || 0) + 1;
  }

  return {
    total,
    withComment,
    withoutComment: total - withComment,
    averageStars: total > 0 ? sumStars / total : 0,
    byStars,
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
  lines.push(`• Média: *${summary.averageStars.toFixed(2)}/5*`);
  lines.push('');
  lines.push('*Distribuição por nota:*');
  for (const n of [5, 4, 3, 2, 1]) {
    const count = summary.byStars[String(n)] || 0;
    const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
    lines.push(`• ${n}/5 — ${count} (${pct}%)`);
  }
  return lines.join('\n');
}
