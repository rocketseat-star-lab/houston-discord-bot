import { Router } from 'express';
import { apiKeyAuth } from '../../../api/middlewares/apiKeyAuth';
import { dispatchCsatReviews } from '../services/dispatcher';

const router = Router();

router.use(apiKeyAuth);

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
