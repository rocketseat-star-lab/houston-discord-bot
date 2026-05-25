import { Router } from 'express';
import { apiKeyAuth } from '../../../api/middlewares/apiKeyAuth';
import { dispatchCsatReviews } from '../services/dispatcher';
import { getSkylabPool } from '../../../core/db/skylab';
import { fetchSkylabFeedbacks } from '../services/skylabClient';

const router = Router();

router.use(apiKeyAuth);

// TEMP(csat-debug): diagnostico do pipeline Skylab. Roda checks crus:
//  1. URL setada
//  2. Conexao reachable
//  3. COUNT na tabela base
//  4. Resultado da query real com datas passadas via query string
// Remover depois que estabilizar.
router.get('/_debug/skylab', async (req, res) => {
  const out: Record<string, any> = {};
  out.url_configured = !!process.env.SKYLAB_DATABASE_URL;
  const pool = getSkylabPool();
  out.pool_initialized = !!pool;
  if (!pool) {
    return res.json({ ...out, error: 'pool nulo — veja logs do pod por motivo' });
  }
  // 1. trivial connection check
  try {
    const r = await pool.query('SELECT 1 AS ok, current_setting($1) AS tz, current_database() AS db, current_schema() AS schema', ['TimeZone']);
    out.trivial = r.rows[0];
  } catch (err: any) {
    return res.status(200).json({ ...out, connect_error: { code: err?.code, message: err?.message } });
  }
  // 2. count rows in feedback table for a date window
  const startsAt = String(req.query.starts_at || '2026-05-24');
  const endsAt = String(req.query.ends_at || '2026-05-24');
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS total,
              MIN(created_at) AS oldest,
              MAX(created_at) AS newest
       FROM lesson_history_feedback_stars
       WHERE created_at::date >= $1::date
         AND created_at::date <= $2::date`,
      [startsAt, endsAt]
    );
    out.raw_count = r.rows[0];
  } catch (err: any) {
    out.raw_count_error = { code: err?.code, message: err?.message };
  }
  // 3. run the actual pipeline query
  try {
    const rows = await fetchSkylabFeedbacks({
      from: new Date(`${startsAt}T00:00:00.000Z`),
      to: new Date(`${endsAt}T23:59:59.999Z`),
    });
    out.pipeline_result = {
      count: rows.length,
      first_3: rows.slice(0, 3).map((r) => ({
        id: r.id,
        stars: r.stars,
        createdAt: r.createdAt,
        studentName: r.studentName,
        lessonTitle: r.lessonTitle,
        journeySlug: r.journeySlug,
      })),
    };
  } catch (err: any) {
    out.pipeline_error = { code: err?.code, message: err?.message };
  }
  res.json(out);
});

router.post('/dispatch', async (req, res) => {
  try {
    const result = await dispatchCsatReviews({
      dryRun: req.body?.dryRun === true,
      from: req.body?.from,
      to: req.body?.to,
    });
    res.json(result);
  } catch (err: any) {
    console.error('[csat-reviews] /dispatch error:', err);
    res.status(500).json({ error: err?.message || 'Erro ao executar dispatcher' });
  }
});

export default router;
