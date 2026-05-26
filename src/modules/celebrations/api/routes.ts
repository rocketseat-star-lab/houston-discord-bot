import { Router } from 'express';
import { apiKeyAuth } from '../../../api/middlewares/apiKeyAuth';
import { dispatchCelebrations } from '../services/dispatcher';
import { toolsClient } from '../services/toolsClient';
import { slackClient } from '../services/slackClient';

const router = Router();

router.use(apiKeyAuth);

/**
 * GET /api/v1/celebrations/upcoming?days=7
 * Returns next boosters (birthday + admission) for the next N days.
 * Used by the admin UI on Tools to preview the calendar.
 */
router.get('/upcoming', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 7, 60);
    const today = new Date();
    const results: Array<{
      date: string;
      birthdays: Array<{ full_name: string; email: string }>;
      admissions: Array<{ full_name: string; email: string }>;
    }> = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const [birthdays, admissions] = await Promise.all([
        toolsClient.findBoosters('birthday', month, day),
        toolsClient.findBoosters('admission', month, day),
      ]);
      if (birthdays.length === 0 && admissions.length === 0) continue;
      results.push({
        date: d.toISOString().slice(0, 10),
        birthdays: birthdays.map((b) => ({ full_name: b.full_name, email: b.email })),
        admissions: admissions.map((b) => ({ full_name: b.full_name, email: b.email })),
      });
    }

    res.json({ items: results });
  } catch (err: any) {
    console.error('[celebrations] /upcoming error:', err);
    res.status(500).json({ error: err?.message || 'Erro ao buscar próximas celebrações' });
  }
});

/**
 * POST /api/v1/celebrations/dispatch
 * Body: { dryRun?: boolean }
 *
 * Runs the celebrations dispatcher. When dryRun is true, returns the rendered
 * messages and image URLs without posting to Slack.
 */
router.post('/dispatch', async (req, res) => {
  try {
    const dryRun = req.body?.dryRun === true;
    const result = await dispatchCelebrations(new Date(), { dryRun });
    res.json(result);
  } catch (err: any) {
    console.error('[celebrations] /dispatch error:', err);
    res.status(500).json({ error: err?.message || 'Erro ao executar dispatcher' });
  }
});

/**
 * POST /api/v1/celebrations/refresh-avatars
 *
 * Itera os boosters ativos e, pra cada um, tenta resolver slack_user_id
 * (via email se preciso) e o avatar via users.info. O resultado e
 * persistido no Tools — inclusive nulls, pra UI conseguir distinguir
 * "ainda nao tentou" de "tentou e nao achou".
 *
 * Roda sequencialmente pra nao estourar rate limit do Slack (tier 2,
 * ~20 req/min em users.info e users.lookupByEmail).
 */
router.post('/refresh-avatars', async (_req, res) => {
  try {
    const boosters = await toolsClient.listActiveBoosters();
    const summary = {
      total: boosters.length,
      withAvatar: 0,
      withoutAvatar: 0,
      withoutSlackUser: 0,
    };

    for (const b of boosters) {
      let slackId = b.slack_user_id;
      if (!slackId) {
        slackId = await slackClient.lookupUserIdByEmail(b.email);
      }
      if (!slackId) {
        await toolsClient.updateBoosterSlackData(b.id, {
          slackUserId: null,
          avatarUrl: null,
        });
        summary.withoutSlackUser++;
        continue;
      }
      const avatarUrl = await slackClient.getUserImageUrl(slackId);
      await toolsClient.updateBoosterSlackData(b.id, {
        slackUserId: slackId,
        avatarUrl: avatarUrl ?? null,
      });
      if (avatarUrl) summary.withAvatar++;
      else summary.withoutAvatar++;
    }

    res.json(summary);
  } catch (err: any) {
    console.error('[celebrations] /refresh-avatars error:', err);
    res.status(500).json({ error: err?.message || 'Erro ao atualizar avatares' });
  }
});

export default router;
