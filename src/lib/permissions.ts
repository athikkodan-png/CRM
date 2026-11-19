import type { PoolClient } from 'pg';

export class ForbiddenError extends Error {
  constructor(public permission: string) { super(`You do not have permission: ${permission}`); }
}

/** All permissions a user has in one company (empty set if they have no access to it). */
export async function loadPermissions(c: Pick<PoolClient, 'query'>, userId: string, companyId: string): Promise<Set<string>> {
  const r = await c.query(
    `select distinct rp.permission from user_company_roles ucr
       join role_permissions rp on rp.role_id = ucr.role_id
       join profiles p on p.id = ucr.user_id and p.is_active
       join companies co on co.id = ucr.company_id and co.is_active
      where ucr.user_id = $1 and ucr.company_id = $2`, [userId, companyId]);
  return new Set(r.rows.map((x) => x.permission as string));
}

/** Every service action calls this first. This is what blocks users in the API, not just the screen. */
export async function requirePermission(c: Pick<PoolClient, 'query'>, userId: string, companyId: string, permission: string) {
  const perms = await loadPermissions(c, userId, companyId);
  if (!perms.has(permission)) throw new ForbiddenError(permission);
  return perms;
}
