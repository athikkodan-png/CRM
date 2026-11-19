import { Pool, type PoolClient } from 'pg';

let pool: Pool | undefined;
export function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set. See README: "Connect the database".');
    pool = new Pool({ connectionString: url, max: 5, ssl: /localhost|127\.0\.0\.1|\/tmp/.test(url) ? undefined : { rejectUnauthorized: false } });
  }
  return pool;
}
export async function closePool() { await pool?.end(); pool = undefined; }

/** Run `fn` in ONE database transaction. All-or-nothing. Records who did it for the audit log. */
export async function withTx<T>(userId: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await getPool().connect();
  try {
    await c.query('begin');
    if (userId) await c.query("select set_config('app.user_id', $1, true)", [userId]);
    const out = await fn(c);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
