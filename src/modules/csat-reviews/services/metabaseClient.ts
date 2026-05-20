import axios from 'axios';
import { CSAT_REVIEWS_CONFIG } from '../config';

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

/**
 * Busca os feedbacks CSAT no Metabase (card 2525) para um intervalo.
 *
 * O card espera parameters como template tags `starts_at` / `ends_at` no
 * formato `YYYY-MM-DD HH:mm:ss`.
 */
export async function fetchMetabaseFeedbacks(opts: {
  from: Date;
  to: Date;
  journeySlug?: string;
}): Promise<CsatFeedback[]> {
  const apiKey = process.env.METABASE_API_KEY;
  if (!apiKey) {
    console.warn('[csat-reviews] METABASE_API_KEY ausente.');
    return [];
  }

  const fmt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const parameters: Array<{ type: string; target: any; value: any }> = [
    {
      type: 'date/single',
      target: ['variable', ['template-tag', 'starts_at']],
      value: fmt(opts.from),
    },
    {
      type: 'date/single',
      target: ['variable', ['template-tag', 'ends_at']],
      value: fmt(opts.to),
    },
  ];
  if (opts.journeySlug) {
    parameters.push({
      type: 'category',
      target: ['variable', ['template-tag', 'journey_slug']],
      value: opts.journeySlug,
    });
  }

  try {
    const res = await axios.post(
      CSAT_REVIEWS_CONFIG.metabaseUrl,
      { parameters },
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      }
    );

    const rows = (res.data?.data?.rows || []) as Array<any[]>;
    return rows.map((row) => {
      // ordem segundo o card antigo:
      // [id, stars, comment, createdAt, user, lessonTitle, journeyTitle,
      //  clusterTitle, moduleTitle, lessonSlug, journeySlug, reasons]
      const [
        id,
        stars,
        comment,
        createdAt,
        user,
        lessonTitle,
        journeyTitle,
        clusterTitle,
        moduleTitle,
        _lessonSlug,
        journeySlug,
        reasons,
      ] = row;
      return {
        id: String(id),
        stars: Number(stars),
        comment: String(comment || ''),
        createdAt: String(createdAt),
        studentName: String(user || ''),
        lessonTitle: String(lessonTitle || ''),
        journeyTitle: journeyTitle ? String(journeyTitle) : null,
        journeySlug: journeySlug ? String(journeySlug) : null,
        clusterTitle: clusterTitle ? String(clusterTitle) : null,
        moduleTitle: moduleTitle ? String(moduleTitle) : null,
        reasons: reasons ? String(reasons) : null,
      } as CsatFeedback;
    });
  } catch (err: any) {
    console.error(
      '[csat-reviews] metabase error:',
      err?.response?.status,
      err?.response?.data || err?.message || err
    );
    return [];
  }
}
