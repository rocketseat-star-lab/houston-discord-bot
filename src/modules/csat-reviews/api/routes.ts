import { Router } from 'express';
import axios from 'axios';
import { apiKeyAuth } from '../../../api/middlewares/apiKeyAuth';
import { dispatchCsatReviews } from '../services/dispatcher';

const router = Router();

router.use(apiKeyAuth);

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
