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
 * Equivalente a card 2525 do Metabase ("Lista todas as avaliacoes"):
 *  - junta `lesson_history_feedback_stars` com user, lesson, journey,
 *    cluster, module e a string agregada de motivos (`reasons`);
 *  - filtra pela janela de datas;
 *  - desempata avaliacoes duplicadas (mesmo user x mesma aula) ficando
 *    com a mais recente via ROW_NUMBER();
 *  - ordena por nota ascendente (notas baixas primeiro).
 *
 * Parametros:
 *   $1 = from (timestamp inclusivo)
 *   $2 = to   (timestamp inclusivo)
 *   $3 = journey_slug (opcional; null = sem filtro)
 */
const SQL = `
WITH avaliacoes_unicas AS (
  SELECT
    lhfs.id AS id,
    lhfs.stars AS stars,
    lhfs.additional_information AS comment,
    lhfs.created_at AS created_at,
    CONCAT(u.name, ' (', u.email, ')') AS user_name,
    lh.title AS lesson_title,
    j.title AS journey_title,
    c.title AS cluster_title,
    lg.title AS module_title,
    j.slug AS journey_slug,
    COALESCE(r.reasons_agg, '') AS reasons,
    ROW_NUMBER() OVER (
      PARTITION BY lhfs.user_id, lhfs.lesson_history_id
      ORDER BY lhfs.created_at DESC
    ) AS rn
  FROM lesson_history_feedback_stars lhfs
  JOIN users u ON u.id = lhfs.user_id
  JOIN lesson_history lh ON lh.id = lhfs.lesson_history_id
  LEFT JOIN lesson_journeys lj
    ON lj.lesson_history_id = lhfs.lesson_history_id
   AND lhfs.journey_id = lj.journey_id
  LEFT JOIN journeys j ON j.id = lhfs.journey_id
  LEFT JOIN clusters c ON c.id = lj.cluster_id
  LEFT JOIN lesson_groups lg ON lg.id = lj.lesson_group_id
  LEFT JOIN (
    SELECT
      fr.lesson_history_feedback_star_id,
      STRING_AGG(r.text, ', ' ORDER BY r.text ASC) AS reasons_agg
    FROM feedbacks_reasons fr
    LEFT JOIN reasons r ON r.id = fr.reason_id
    GROUP BY fr.lesson_history_feedback_star_id
  ) r ON r.lesson_history_feedback_star_id = lhfs.id
  WHERE lhfs.created_at >= $1
    AND lhfs.created_at <= $2
    AND lhfs.created_at >= j.released_at
    AND ($3::text IS NULL OR j.slug = $3)
)
SELECT
  id, stars, comment, created_at,
  user_name, lesson_title, journey_title,
  cluster_title, module_title, journey_slug, reasons
FROM avaliacoes_unicas
WHERE rn = 1
ORDER BY stars ASC, created_at DESC
`;

export async function fetchSkylabFeedbacks(opts: FetchOpts): Promise<CsatFeedback[]> {
  const params: any[] = [opts.from, opts.to, opts.journeySlug ?? null];
  const rows = await skylabQuery<FeedbackRow>(SQL, params);
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
