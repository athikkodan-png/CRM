import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { getPool, withTx, closePool } from '@/lib/db';
import { createCompany, ensureProfile } from '@/modules/setup/service';
import { loadPermissions, requirePermission, ForbiddenError } from '@/lib/permissions';

const tag = Math.random().toString(36).slice(2, 7).toUpperCase();
async function newUser(name: string) {
  const id = randomUUID();
  await ensureProfile(id, `${name}-${tag}@example.test`.toLowerCase(), name);
  return id;
}
let boss: string;   // the first user to finish setup becomes the Owner
beforeAll(async () => {
  await getPool().query('delete from companies');   // test database only: start with an empty system
  boss = await newUser('boss');
});
afterAll(closePool);

describe('company setup', () => {
  it('creates chart of accounts, periods, numbering, tax codes and owner access in one go', async () => {
    const owner = boss;
    const { companyId } = await createCompany(owner, { code: `RZ${tag}`, name: 'Test Rezinko', features: ['trading', 'transport'], fiscalYear: 2026 });
    const q = (s: string) => getPool().query(s, [companyId]).then((r) => r.rows);
    expect((await q('select * from fiscal_periods where company_id=$1')).length).toBe(12);
    expect((await q('select * from document_sequences where company_id=$1')).length).toBeGreaterThan(5);
    const roles = (await q('select role from account_roles where company_id=$1')).map((r) => r.role);
    for (const r of ['AR_CONTROL', 'AP_CONTROL', 'INVENTORY', 'VAT_INPUT', 'VAT_OUTPUT', 'CASH', 'BANK', 'FIXED_ASSETS', 'ACCUM_DEPRECIATION', 'LOANS', 'SHAREHOLDER_CURRENT', 'COGS', 'FX_GAIN', 'FX_LOSS']) expect(roles).toContain(r);
    // feature filtering: gym-only account must not exist for a trading/transport company
    expect((await q(`select 1 from accounts where company_id=$1 and code='2300'`)).length).toBe(0);
    expect((await q(`select 1 from accounts where company_id=$1 and code='1200'`)).length).toBe(1);
    // tax rates are data, never hardcoded: placeholders at 0
    expect((await q(`select distinct rate from tax_codes where company_id=$1`)).map((r) => Number(r.rate))).toEqual([0]);
    // audit trail has who + what
    const audit = await getPool().query(`select actor_id from audit_log where company_id=$1 and entity='companies' and action='create'`, [companyId]);
    expect(audit.rows.some((a) => a.actor_id === owner)).toBe(true);
  });

  it('a new company is a pure data operation (second company, different features)', async () => {
    const owner = boss;
    await createCompany(owner, { code: `OF${tag}`, name: 'Test Gym', features: ['gym'], fiscalYear: 2026 });
    const second = await createCompany(owner, { code: `CQ${tag}`, name: 'Test Conquest', features: ['pipeline_services'], fiscalYear: 2026 });
    expect(second.companyId).toBeTruthy();
  });

  it('rejects a duplicate company code', async () => {
    const owner = boss;
    await expect(createCompany(owner, { code: `RZ${tag}`, name: 'Dup', features: [], fiscalYear: 2026 })).rejects.toThrow();
  });
});

describe('permissions are enforced in the service layer (API), not only the UI', () => {
  it('blocks users without permission, and users from other companies', async () => {
    const owner = boss;
    const { companyId: a } = await createCompany(owner, { code: `PA${tag}`, name: 'Company A', features: ['trading'], fiscalYear: 2026 });
    const { companyId: b } = await createCompany(owner, { code: `PB${tag}`, name: 'Company B', features: ['trading'], fiscalYear: 2026 });
    const sales = await newUser('sales');
    const partner = await newUser('partner');
    await withTx(owner, (c) => c.query(`insert into user_company_roles select $1,$2,id from roles where key='sales'`, [sales, a]));
    await withTx(owner, (c) => c.query(`insert into user_company_roles select $1,$2,id from roles where key='partner'`, [partner, a]));
    const c = getPool();

    // owner: everything
    await expect(requirePermission(c, owner, a, 'accounting.post')).resolves.toBeTruthy();
    // sales: can create sales docs, cannot post accounting or change settings, cannot see cost
    await expect(requirePermission(c, sales, a, 'sales.create')).resolves.toBeTruthy();
    await expect(requirePermission(c, sales, a, 'accounting.post')).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requirePermission(c, sales, a, 'settings.edit')).rejects.toBeInstanceOf(ForbiddenError);
    expect((await loadPermissions(c, sales, a)).has('field.cost.view')).toBe(false);
    // partner: read-only reports
    await expect(requirePermission(c, partner, a, 'reports.view')).resolves.toBeTruthy();
    await expect(requirePermission(c, partner, a, 'sales.create')).rejects.toBeInstanceOf(ForbiddenError);
    // company isolation: sales user has nothing at all in company B
    expect((await loadPermissions(c, sales, b)).size).toBe(0);
    await expect(requirePermission(c, sales, b, 'sales.view')).rejects.toBeInstanceOf(ForbiddenError);
    // deactivated user loses access
    await withTx(owner, (cl) => cl.query('update profiles set is_active=false where id=$1', [sales]));
    expect((await loadPermissions(c, sales, a)).size).toBe(0);
  });

  it('only an Owner can add companies once the first exists', async () => {
    const stranger = await newUser('stranger');
    await expect(createCompany(stranger, { code: `XX${tag}`, name: 'Nope', features: [], fiscalYear: 2026 })).rejects.toThrow(/Owner/);
  });
});
