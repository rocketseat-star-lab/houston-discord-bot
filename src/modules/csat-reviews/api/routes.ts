import { Router } from 'express';
import axios from 'axios';
import { apiKeyAuth } from '../../../api/middlewares/apiKeyAuth';
import { dispatchCsatReviews } from '../services/dispatcher';

const router = Router();

router.use(apiKeyAuth);

// TEMP(csat-test): executa exatamente o mesmo fetch do dispatcher e retorna
// status/data brutos do Metabase. Útil pra ver se o 401 acontece também no
// /query (caso em que o client estaria engolindo o erro).
router.get('/_debug/query-raw', async (req, res) => {
  try {
    const apiKey = process.env.METABASE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'METABASE_API_KEY ausente' });
    const startsAt = String(req.query.starts_at || '2026-05-20');
    const endsAt = String(req.query.ends_at || '2026-05-22');
    const r = await axios.post(
      'https://metabase.rocketseat.dev/api/card/2525/query',
      {
        parameters: [
          {
            type: 'date/single',
            target: ['variable', ['template-tag', 'starts_at']],
            value: startsAt,
          },
          {
            type: 'date/single',
            target: ['variable', ['template-tag', 'ends_at']],
            value: endsAt,
          },
        ],
      },
      {
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        timeout: 30_000,
        validateStatus: () => true,
      }
    );
    res.json({
      status: r.status,
      starts_at: startsAt,
      ends_at: endsAt,
      row_count: Array.isArray(r.data?.data?.rows) ? r.data.data.rows.length : null,
      error_type: r.data?.error_type,
      error: r.data?.error,
      first_row: r.data?.data?.rows?.[0],
      cols: (r.data?.data?.cols || []).map((c: any) => c?.name),
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'erro no fetch',
      status: err?.response?.status,
      data: err?.response?.data,
      message: err?.message,
    });
  }
});

// TEMP(csat-test): endpoint de inspeção dos template tags da card 2525.
// Remover junto com o resto da diagnose.
router.get('/_debug/card-meta', async (_req, res) => {
  try {
    const apiKey = process.env.METABASE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'METABASE_API_KEY ausente' });
    const r = await axios.get('https://metabase.rocketseat.dev/api/card/2525', {
      headers: { 'x-api-key': apiKey },
      timeout: 20_000,
    });
    const d = r.data || {};
    res.json({
      name: d.name,
      parameters: d.parameters,
      template_tags: d?.dataset_query?.native?.['template-tags'],
      query_first_300: String(d?.dataset_query?.native?.query || '').slice(0, 300),
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'erro ao buscar card',
      status: err?.response?.status,
      data: err?.response?.data,
      message: err?.message,
    });
  }
});

router.post('/dispatch', async (req, res) => {
  try {
    const result = await dispatchCsatReviews({
      dryRun: req.body?.dryRun === true,
      from: req.body?.from,
      to: req.body?.to,
      // TEMP(csat-test): habilita fallback para o último dia com feedbacks
      // quando o dispatch é disparado manualmente pelo Tools. Remover
      // junto com o bloco marcado no dispatcher.
      fallbackToLastDayWithFeedbacks: true,
    });
    res.json(result);
  } catch (err: any) {
    console.error('[csat-reviews] /dispatch error:', err);
    res.status(500).json({ error: err?.message || 'Erro ao executar dispatcher' });
  }
});

export default router;
