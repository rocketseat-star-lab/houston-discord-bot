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
let warnedInvalidShape = false;

const STATEMENT_TIMEOUT_MS = 15_000;

/**
 * Parser manual da DSN da Skylab. Existe porque tanto `new URL()` quanto o
 * `pg-connection-string` (usado por `connectionString:` no pg) rejeitam
 * senhas contendo caracteres reservados de URL como `#`, `?`, `/` sem
 * url-encode. Como a Skylab compartilha a mesma senha entre projetos e
 * outros consumidores nao exigem encode, replicamos esse comportamento
 * fazendo o split manualmente e passando os campos ja decompostos pro pg
 * (`user`, `password`, `host`, ...) — bypassa o parser de URL.
 *
 * Convencoes do split (vao da esquerda pra direita pra evitar amb. com
 * caracteres na senha):
 *   - scheme = ate o primeiro `://`
 *   - userinfo = entre `://` e o ULTIMO `@`
 *   - user = ate o PRIMEIRO `:` no userinfo (resto = password, com qualquer
 *     caractere literal exceto `@`)
 *   - host[:port] = ate o PRIMEIRO `/` depois do userinfo
 *   - database = entre o `/` e o `?` (se houver)
 *   - query = depois do `?`
 *
 * Retorna `null` se o shape nao casar com o esperado.
 */
interface ParsedDsn {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
  ssl: boolean;
}

function parseSkylabDsn(raw: string): ParsedDsn | null {
  const schemeMatch = raw.match(/^(postgres(?:ql)?):\/\//i);
  if (!schemeMatch) return null;
  const afterScheme = raw.slice(schemeMatch[0].length);

  const lastAt = afterScheme.lastIndexOf('@');
  if (lastAt === -1) return null;
  const userInfo = afterScheme.slice(0, lastAt);
  const hostPart = afterScheme.slice(lastAt + 1);

  const firstColon = userInfo.indexOf(':');
  if (firstColon === -1) return null;
  const user = userInfo.slice(0, firstColon);
  const password = userInfo.slice(firstColon + 1);

  const queryIdx = hostPart.indexOf('?');
  const beforeQuery = queryIdx >= 0 ? hostPart.slice(0, queryIdx) : hostPart;
  const query = queryIdx >= 0 ? hostPart.slice(queryIdx + 1) : '';

  const slashIdx = beforeQuery.indexOf('/');
  if (slashIdx === -1) return null;
  const hostPort = beforeQuery.slice(0, slashIdx);
  const database = beforeQuery.slice(slashIdx + 1);
  if (!database) return null;

  const portColon = hostPort.lastIndexOf(':');
  const host = portColon >= 0 ? hostPort.slice(0, portColon) : hostPort;
  const port =
    portColon >= 0 ? Number.parseInt(hostPort.slice(portColon + 1), 10) || 5432 : 5432;
  if (!host) return null;

  // Detecta ssl tanto via `?ssl=true` quanto `?sslmode=require|prefer|verify-*`.
  const params = new URLSearchParams(query);
  const sslmode = (params.get('sslmode') || '').toLowerCase();
  const ssl =
    params.get('ssl') === 'true' ||
    sslmode === 'require' ||
    sslmode === 'prefer' ||
    sslmode.startsWith('verify-');

  return { user, password, host, port, database, ssl };
}

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
  const parsed = parseSkylabDsn(url);
  if (!parsed) {
    if (!warnedInvalidShape) {
      console.error(
        '[skylab-db] SKYLAB_DATABASE_URL com shape inesperado — confira scheme/@/`/`. Consultas retornarão vazio.'
      );
      warnedInvalidShape = true;
    }
    return null;
  }
  pool = new Pool({
    user: parsed.user,
    password: parsed.password,
    host: parsed.host,
    port: parsed.port,
    database: parsed.database,
    // AWS RDS usa CA propria que nao esta na trust-store padrao do Node.
    // `rejectUnauthorized: false` aceita a TLS sem validar o CA — adequado
    // pra esse caso (a leitura ja eh read-only e a conexao continua
    // criptografada). Se um dia quiserem hardening, basta plugar o bundle
    // da Amazon aqui.
    ssl: parsed.ssl ? { rejectUnauthorized: false } : false,
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
