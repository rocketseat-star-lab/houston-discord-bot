import express, { Router, Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import prisma from '../../../services/prisma';
import { SLACK_REPORTS_CONFIG } from '../config';
import { verifySlackSignature } from '../services/signatureVerifier';
import { processNewSlackThread, processResolution } from '../services/threadProcessor';
import { ThreadDebouncer } from '../services/threadDebouncer';
import { updateMessage, resolveThreadTs } from '../services/slackClient';
import {
  buildSimilarYesAcknowledged,
  buildSimilarNoAcknowledged,
  buildResolvedCard,
} from '../services/messageBuilder';

// Singleton de debouncer pro modulo. Vive enquanto o pod estiver no ar —
// se o pod reiniciar com threads em janela aberta, a primeira mensagem
// do usuario pos-restart re-agenda; pior caso e o bot processar 15s
// depois ao inves de em tempo real.
const debouncer = new ThreadDebouncer(
  SLACK_REPORTS_CONFIG.threadDebounceMs,
  async (key) => {
    const [channel, threadTs] = key.split(':');
    if (!channel || !threadTs) return;
    await processNewSlackThread({ channel, threadTs });
  }
);

export function shutdownSlackReports(): void {
  debouncer.shutdown();
}

const router = Router();

// Captura body BRUTO em string — necessario pra verificar a assinatura
// HMAC antes do JSON.parse. Slack manda content-type
// `application/json` (Events) ou `application/x-www-form-urlencoded`
// (Interactions); o raw middleware tipa-agnostic resolve os dois.
const rawParser = express.raw({ type: '*/*', limit: '1mb' });

function getRawBody(req: Request): string {
  // express.raw deixa o body como Buffer
  const buf = req.body as Buffer;
  return buf ? buf.toString('utf8') : '';
}

/**
 * Wrapper de signature verification: se a assinatura nao bate, responde
 * 401 sem chamar o handler. Se bater, parseia o JSON/form e segue.
 */
function verified(
  parse: 'json' | 'form',
  handler: (req: Request, res: Response, parsed: any) => Promise<void>
) {
  return async (req: Request, res: Response) => {
    const raw = getRawBody(req);

    // Modo testes: enquanto a env SLACK_SIGNING_SECRET nao for setada,
    // aceitamos os webhooks SEM verificar assinatura. Logamos um warn
    // bem visivel a cada chamada pra ninguem esquecer disso ligado em
    // producao. Quando o secret for adicionado e o pod reiniciar, o
    // codigo passa a verificar automaticamente.
    if (!SLACK_REPORTS_CONFIG.signingSecret) {
      console.warn(
        '[slack-reports] ⚠️  SLACK_SIGNING_SECRET ausente — aceitando webhook SEM verificacao. ' +
          'Configure o secret no K8s assim que possivel.'
      );
    } else {
      const result = verifySlackSignature({
        signingSecret: SLACK_REPORTS_CONFIG.signingSecret,
        timestampHeader: req.header('x-slack-request-timestamp') ?? undefined,
        signatureHeader: req.header('x-slack-signature') ?? undefined,
        rawBody: raw,
      });
      if (!result.valid) {
        console.warn('[slack-reports] Assinatura invalida:', result.reason);
        res.status(401).send('invalid signature');
        return;
      }
    }

    let parsed: any;
    if (parse === 'json') {
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        res.status(400).send('invalid json');
        return;
      }
    } else {
      // form: `payload=...` urlencoded → payload e JSON string
      const params = new URLSearchParams(raw);
      try {
        parsed = JSON.parse(params.get('payload') ?? '{}');
      } catch {
        res.status(400).send('invalid form payload');
        return;
      }
    }

    try {
      await handler(req, res, parsed);
    } catch (err) {
      console.error('[slack-reports] handler error:', err);
      if (!res.headersSent) res.status(500).send('error');
    }
  };
}

/**
 * POST /api/v1/slack-reports/events
 *
 * Recebe eventos do Slack Events API. Slack tem timeout de 3s entao
 * respondemos 200 imediatamente e processamos em background (`void` no
 * promise das chamadas async).
 */
router.post(
  '/events',
  rawParser,
  verified('json', async (_req, res, body) => {
    // URL verification challenge — quando o Slack admin configura a URL.
    if (body.type === 'url_verification') {
      res.json({ challenge: body.challenge });
      return;
    }

    // Reconhece o evento rapido, processa em background.
    res.status(200).send('ok');

    if (body.type !== 'event_callback' || !body.event) return;

    const event = body.event;
    const channel: string | undefined = event.channel;
    if (!channel || channel !== SLACK_REPORTS_CONFIG.channelId) return;

    // Mensagem em thread (reply): se for a primeira da janela, dispara
    // o debouncer pra processar a thread inteira em 15s.
    if (
      event.type === 'message' &&
      !event.bot_id &&
      event.subtype !== 'bot_message' &&
      event.thread_ts &&
      event.thread_ts !== event.ts
    ) {
      debouncer.schedule(channel, event.thread_ts);
      return;
    }

    // Reaction de resolucao em qualquer mensagem da thread (parent OU
    // reply). Resolvemos o thread_ts via API porque o evento traz so o
    // ts da mensagem reagida, sem indicar se ela e pai ou filha.
    if (
      event.type === 'reaction_added' &&
      event.reaction === SLACK_REPORTS_CONFIG.resolutionReaction &&
      event.item?.type === 'message' &&
      event.item.channel === SLACK_REPORTS_CONFIG.channelId
    ) {
      const reactedChannel = event.item.channel;
      const reactedTs = event.item.ts;
      const reactedBy: string | undefined = event.user;
      void (async () => {
        const threadTs = await resolveThreadTs({
          channel: reactedChannel,
          messageTs: reactedTs,
        });
        if (!threadTs) {
          console.warn(
            `[slack-reports] resolveThreadTs nao retornou nada pra ${reactedChannel}/${reactedTs}`
          );
          return;
        }
        await processResolution({
          channel: reactedChannel,
          threadTs,
          resolvedByUserId: reactedBy,
        });
      })().catch((err) =>
        console.error('[slack-reports] processResolution falhou:', err)
      );
      return;
    }
  })
);

/**
 * POST /api/v1/slack-reports/interactions
 *
 * Recebe payloads de Block Kit interactions (botoes "Sim, resolveu" /
 * "Nao, ainda preciso"). Body vem como form-urlencoded com chave
 * `payload` contendo JSON.
 */
router.post(
  '/interactions',
  rawParser,
  verified('form', async (_req, res, payload) => {
    res.status(200).send('ok');

    if (payload.type !== 'block_actions') return;
    const action = payload.actions?.[0];
    if (!action) return;

    let parsedValue: { channel?: string; threadTs?: string } = {};
    try {
      parsedValue = JSON.parse(action.value ?? '{}');
    } catch {
      // ignore
    }

    const messageChannel = payload.channel?.id;
    const messageTs = payload.message?.ts;
    if (!messageChannel || !messageTs) return;

    const clickedByUserId: string | undefined = payload.user?.id;

    if (action.action_id === 'slack_report_similar_yes') {
      const ack = buildSimilarYesAcknowledged();
      await updateMessage({ channel: messageChannel, ts: messageTs, ...ack });

      // "Resolveu via report anterior" = a thread atual ja foi atendida
      // pelos similares — entao tambem documenta a resolucao pra ela.
      if (parsedValue.channel && parsedValue.threadTs) {
        void processResolution({
          channel: parsedValue.channel,
          threadTs: parsedValue.threadTs,
          resolvedByUserId: clickedByUserId,
        }).catch((err) =>
          console.error('[slack-reports] resolution-via-similar falhou:', err)
        );
      }
    } else if (action.action_id === 'slack_report_similar_no') {
      const ack = buildSimilarNoAcknowledged();
      await updateMessage({ channel: messageChannel, ts: messageTs, ...ack });
    } else if (action.action_id === 'slack_report_mark_resolved') {
      // Caminho principal de resolucao. Da feedback instantaneo editando
      // o card pra "Resolvido em X por @user" antes do processamento
      // pesado (GPT + embedding) terminar — usuario nao fica em loading.
      if (!parsedValue.channel || !parsedValue.threadTs || !clickedByUserId) {
        return;
      }
      const resolvedAt = new Date();
      const resolvedCard = buildResolvedCard({
        resolvedByUserId: clickedByUserId,
        resolvedAt,
      });
      await updateMessage({
        channel: messageChannel,
        ts: messageTs,
        ...resolvedCard,
      });

      void processResolution({
        channel: parsedValue.channel,
        threadTs: parsedValue.threadTs,
        resolvedByUserId: clickedByUserId,
      }).catch((err) =>
        console.error('[slack-reports] mark-resolved falhou:', err)
      );
    }
  })
);

// TEMP(slack-reports-debug): endpoint pra inspecionar estado interno —
// scopes ativos no token, contagem de reports do Slack no banco e o
// estado de embeddings. Sem autenticacao porque nao expoe segredos
// (so contagens e metadados). Remover depois de estabilizar.
router.get('/_debug/state', async (_req: Request, res: Response) => {
  const out: Record<string, any> = {};
  out.channelId = SLACK_REPORTS_CONFIG.channelId;
  out.signingSecretConfigured = !!SLACK_REPORTS_CONFIG.signingSecret;

  // Scopes ativos no token: cabecalho `x-oauth-scopes` do Slack a cada
  // chamada autenticada retorna isso. Chama `auth.test` e le os headers.
  try {
    const token = process.env.SLACK_BOT_TOKEN || '';
    const sc = new WebClient(token, { rejectRateLimitedCalls: false });
    const r: any = await sc.apiCall('auth.test', {});
    out.auth = {
      ok: r.ok,
      bot_user: r.user,
      bot_id: r.bot_id,
      team: r.team,
    };
    // O WebClient versao atual nao expoe `response` raw direto.
    // Vamos fazer um fetch manual pra ler o header.
    const headerCheck = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    out.scopes_granted =
      headerCheck.headers.get('x-oauth-scopes') ?? '(header ausente)';
  } catch (err: any) {
    out.auth_error = err?.message ?? String(err);
  }

  // DB: contagem total + sample dos ultimos 5 reports do Slack, e se
  // cada um tem embedding gerado.
  try {
    const total = await prisma.report.count({ where: { platform: 'SLACK' } });
    const recent = await prisma.report.findMany({
      where: { platform: 'SLACK' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        slackChannelId: true,
        slackThreadTs: true,
        category: true,
        solution: true,
        resolvedAt: true,
        createdAt: true,
        embeddings: { select: { id: true } },
      },
    });
    out.db = {
      totalSlackReports: total,
      recent: recent.map((r) => ({
        id: r.id.toString(),
        title: r.title,
        slackChannelId: r.slackChannelId,
        slackThreadTs: r.slackThreadTs,
        category: r.category,
        hasSolution: !!r.solution,
        solutionLen: r.solution?.length ?? 0,
        resolvedAt: r.resolvedAt,
        createdAt: r.createdAt,
        hasEmbedding: r.embeddings.length > 0,
      })),
    };
  } catch (err: any) {
    out.db_error = err?.message ?? String(err);
  }

  res.json(out);
});

export default router;
