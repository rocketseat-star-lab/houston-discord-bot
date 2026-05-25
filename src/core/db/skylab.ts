import { Pool, type QueryResultRow } from 'pg';

/**
 * Pool lazy do banco read-only da Skylab.
 *
 * A URL de conexao concede leitura ao banco inteiro da plataforma, entao
 * o client aplica defesa em camadas pra impedir qualquer escrita acidental
 * e qualquer chamada fora de fluxo autenticado:
 *
 *  1. **Inicializacao lazy + opcional**: se `SKYLAB_DATABASE_URL` nao
 *     estiver setada, o pool fica `null` e queries retornam `[]` sem
 *     derrubar o bot. Apenas um warn em primeira chamada.
 *  2. **Transacao READ ONLY**: toda query roda dentro de
 *     `BEGIN READ ONLY ... COMMIT`. O Postgres rejeita qualquer
 *     `INSERT/UPDATE/DELETE/DDL/SELECT FOR UPDATE` no nivel do servidor,
 *     mesmo que o role do usuario do banco fosse mais permissivo.
 *  3. **Whitelist de shape**: `assertReadOnlyShape` exige que o texto da
 *     query comece com `SELECT` ou `WITH` (depois de remover comentarios).
 *     Falha rapido em dev se alguem tentar plugar um statement de escrita.
 *  4. **statement_timeout**: limita cada query a 15s. Sem runaway queries
 *     que possam impactar a Skylab.
 *
 * A camada de transporte usa `application_name` pro DBA conseguir
 * identificar o consumidor no `pg_stat_activity`. Erros nao logam SQL bruto
 * — so codigo + mensagem do Postgres — pra evitar vazar dominio em logs.
 *
 * Quem consome este client e responsavel por gating de rota: a rota HTTP
 * que dispara o pipeline tem que ser autenticada (no caso atual,
 * `apiKeyAuth` em `/api/v1/csat-reviews/dispatch`).
 */
let pool: Pool | null = null;
let warnedMissingUrl = false;

const STATEMENT_TIMEOUT_MS = 15_000;

export function getSkylabPool(): Pool | null {
  if (pool) return pool;
  const url = process.env.SKYLAB_DATABASE_URL;
  if (!url) {
    if (!warnedMissingUrl) {
      console.warn(
        '[skylab-db] SKYLAB_DATABASE_URL ausente — consultas retornarão vazio.'
      );
      warnedMissingUrl = true;
    }
    return null;
  }
  // Nao validamos a URL com `new URL()` aqui porque o `pg-connection-string`
  // (usado internamente pelo `pg`) e mais permissivo — ele aceita senhas com
  // `@`, `#`, `/` sem url-encode pois divide por `@` da direita pra esquerda.
  // O catch em `connect()` ja expoe erro real se a URL nao for parseavel.
  pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'houston-discord-bot',
  });
  pool.on('error', (err: any) => {
    console.error('[skylab-db] idle client error:', err?.code ?? '', err?.message ?? err);
  });
  return pool;
}

function assertReadOnlyShape(sql: string): void {
  // Tira comentarios de linha (--...) e bloco (/* ... */) iniciais e
  // whitespace pra checar a primeira keyword util.
  const stripped = sql
    .replace(/^\s*--.*$/gm, '')
    .replace(/^\s*\/\*[\s\S]*?\*\//g, '')
    .trimStart();
  if (!/^(SELECT|WITH)\b/i.test(stripped)) {
    throw new Error('skylabQuery aceita apenas statements SELECT ou WITH.');
  }
}

export async function skylabQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  assertReadOnlyShape(sql);
  const p = getSkylabPool();
  if (!p) return [];
  // `connect()` pode falhar com URL invalida, host inalcancavel, credenciais
  // erradas etc. Tratamos como "DB indisponivel" e retornamos [] — o
  // dispatcher devolve "Sem feedbacks no período" pro front. Erros ficam
  // visiveis no log do pod pra o TL diagnosticar.
  let client;
  try {
    client = await p.connect();
  } catch (err: any) {
    console.error(
      '[skylab-db] connect error:',
      err?.code ?? '',
      err?.message ?? err
    );
    return [];
  }
  try {
    await client.query('BEGIN READ ONLY');
    await client.query(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    const result = await client.query<T>(sql, params);
    await client.query('COMMIT');
    return result.rows;
  } catch (err: any) {
    // Nao logar SQL/params brutos — podem conter dados sensiveis. Codigo
    // + mensagem do Postgres ja sao suficientes pra triagem.
    console.error(
      '[skylab-db] query error:',
      err?.code ?? '',
      err?.message ?? err
    );
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore — connection ja pode estar inutilizada
    }
    return [];
  } finally {
    client.release();
  }
}

export async function closeSkylabPool(): Promise<void> {
  if (!pool) return;
  try {
    await pool.end();
  } catch (err: any) {
    console.error('[skylab-db] error closing pool:', err?.message ?? err);
  } finally {
    pool = null;
  }
}
