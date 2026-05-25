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
  const raw = process.env.SKYLAB_DATABASE_URL || '';
  out.url_configured = !!raw;
  // Sem expor a URL inteira. So caracteristicas que ajudam a diagnosticar
  // problema de formatacao: comprimento, scheme detectado, se tem espaco/
  // newline, e se `new URL(...)` aceita.
  if (raw) {
    // Conta caracteres estruturais sem expor user/pass.
    const afterScheme = raw.replace(/^[a-z]+:\/\//i, '');
    const atCount = (raw.match(/@/g) || []).length;
    const lastAtIdx = afterScheme.lastIndexOf('@');
    // Tudo depois do ultimo `@` = host:port/db?query. Pode mostrar sem leak.
    const afterAt = lastAtIdx >= 0 ? afterScheme.slice(lastAtIdx + 1) : '<sem @>';
    // Antes do ultimo `@` = userinfo. So conta sem expor.
    const userInfo = lastAtIdx >= 0 ? afterScheme.slice(0, lastAtIdx) : '';
    const colonsInUserInfo = (userInfo.match(/:/g) || []).length;
    out.url_shape = {
      length: raw.length,
      scheme: raw.slice(0, raw.indexOf('://') + 3) || '<sem ://>',
      has_whitespace: /\s/.test(raw),
      has_newline: /\r|\n/.test(raw),
      at_count: atCount,
      colons_in_userinfo: colonsInUserInfo,
      // Suspeitas comuns no userinfo: caracteres que `new URL` rejeita mesmo
      // depois do split por @ da direita. NAO expoem valores.
      userinfo_has_question: userInfo.includes('?'),
      userinfo_has_hash: userInfo.includes('#'),
      userinfo_has_slash: userInfo.includes('/'),
      userinfo_has_percent: userInfo.includes('%'),
      userinfo_has_bracket: /[\[\]]/.test(userInfo),
      after_at_safe: afterAt, // host:port/db?params — pode logar
    };
    try {
      new URL(raw);
      out.url_parse = { valid: true };
    } catch (err: any) {
      out.url_parse = { valid: false, error: err?.message };
    }
    // Tenta com pg-connection-string explicitamente.
    try {
      const { parse } = await import('pg-connection-string');
      const p = parse(raw);
      out.pgcs_parse = {
        valid: true,
        host: p.host,
        port: p.port,
        database: p.database,
        user_present: !!p.user,
        password_present: !!p.password,
        ssl: p.ssl,
      };
    } catch (err: any) {
      out.pgcs_parse = { valid: false, error: err?.message, code: err?.code };
    }
  }
  const pool = getSkylabPool();
  out.pool_initialized = !!pool;
  if (!pool) {
    return res.json(out);
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
