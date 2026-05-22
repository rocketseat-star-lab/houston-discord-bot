import { skylabQuery } from '../../../core/db/skylab';

export interface CsatFeedback {
  id: string;
  stars: number;
  comment: string;
  createdAt: string;
  studentName: string;
  lessonTitle: string;
  journeyTitle?: string | null;
  journeySlug?: string | null;
  clusterTitle?: string | null;
  moduleTitle?: string | null;
  reasons?: string | null;
}

interface FetchOpts {
  from: Date;
  to: Date;
  journeySlug?: string;
}

interface FeedbackRow {
  id: string | number;
  stars: number | string;
  comment: string | null;
  created_at: string | Date;
  user_name: string | null;
  lesson_title: string | null;
  journey_title: string | null;
  cluster_title: string | null;
  module_title: string | null;
  journey_slug: string | null;
  reasons: string | null;
}

/**
 * Busca os feedbacks CSAT diretamente do banco read-only da Skylab.
 *
 * TODO(csat-reviews): substituir o SQL placeholder pela query equivalente à
 * card 2525 do Metabase ("Lista todas as avaliações"). Placeholders já
 * casam com o resto do pipeline:
 *   $1 = from (timestamp inclusivo, início do dia)
 *   $2 = to   (timestamp inclusivo, fim do dia)
 *   $3 = journey_slug (opcional, filtra por jornada se passado)
 *
 * As colunas retornadas devem ter exatamente estes aliases:
 *   id, stars, comment, created_at, user_name, lesson_title,
 *   journey_title, cluster_title, module_title, journey_slug, reasons
 */
export async function fetchSkylabFeedbacks(opts: FetchOpts): Promise<CsatFeedback[]> {
  const params: any[] = [opts.from, opts.to];
  if (opts.journeySlug) params.push(opts.journeySlug);

  // TODO(csat-reviews): trocar pelo SELECT real da card 2525.
  const sql = `
    SELECT
      ''::text AS id,
      0::int AS stars,
      ''::text AS comment,
      now() AS created_at,
      ''::text AS user_name,
      ''::text AS lesson_title,
      NULL::text AS journey_title,
      NULL::text AS cluster_title,
      NULL::text AS module_title,
      NULL::text AS journey_slug,
      NULL::text AS reasons
    WHERE false
  `;

  const rows = await skylabQuery<FeedbackRow>(sql, params);
  return rows.map((row) => ({
    id: String(row.id),
    stars: Number(row.stars),
    comment: String(row.comment ?? ''),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    studentName: String(row.user_name ?? ''),
    lessonTitle: String(row.lesson_title ?? ''),
    journeyTitle: row.journey_title ? String(row.journey_title) : null,
    journeySlug: row.journey_slug ? String(row.journey_slug) : null,
    clusterTitle: row.cluster_title ? String(row.cluster_title) : null,
    moduleTitle: row.module_title ? String(row.module_title) : null,
    reasons: row.reasons ? String(row.reasons) : null,
  }));
}
