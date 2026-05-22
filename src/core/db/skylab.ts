import { Pool, type QueryResultRow } from 'pg';

/**
 * Pool lazy do banco read-only da Skylab.
 *
 * Conexão é compartilhada entre módulos do bot que precisarem ler dados
 * da plataforma (CSAT, futuras métricas de aulas, etc.). A inicialização
 * é preguiçosa: se a env `SKYLAB_DATABASE_URL` não estiver setada, o pool
 * permanece `null` e `skylabQuery` retorna `[]` sem derrubar o bot —
 * apenas registra um warn uma única vez.
 *
 * Read-only deve ser garantido pelo role do usuário Postgres na URL.
 */
let pool: Pool | null = null;
let warnedMissingUrl = false;

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
  pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'houston-discord-bot',
  });
  pool.on('error', (err) => {
    console.error('[skylab-db] idle client error:', err);
  });
  return pool;
}

export async function skylabQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const p = getSkylabPool();
  if (!p) return [];
  try {
    const result = await p.query<T>(sql, params);
    return result.rows;
  } catch (err) {
    console.error('[skylab-db] query error:', err);
    return [];
  }
}

export async function closeSkylabPool(): Promise<void> {
  if (!pool) return;
  try {
    await pool.end();
  } catch (err) {
    console.error('[skylab-db] error closing pool:', err);
  } finally {
    pool = null;
  }
}
