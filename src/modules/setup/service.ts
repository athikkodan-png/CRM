import type { PoolClient } from 'pg';
import { z } from 'zod';
import { withTx } from '@/lib/db';
import { COA_TEMPLATE, DOC_TYPES } from '@/modules/accounting/coa-template';

export const FEATURES = ['trading', 'contracting', 'transport', 'pipeline_services', 'gym'] as const;

export const createCompanySchema = z.object({
  code: z.string().trim().min(2).max(12).regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, - or _ only').transform((s) => s.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(200).optional(),
  commercialRegNo: z.string().trim().max(50).optional(),
  taxRegNo: z.string().trim().max(50).optional(),
  features: z.array(z.enum(FEATURES)).default([]),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(1),
  fiscalYear: z.number().int().min(2000).max(2100),
});
export type CreateCompanyInput = z.input<typeof createCompanySchema>;

/** Insert 12 monthly fiscal periods starting at the company's fiscal-year start month. */
async function createPeriods(c: PoolClient, companyId: string, startMonth: number, year: number) {
  for (let i = 0; i < 12; i++) {
    const start = new Date(Date.UTC(year, startMonth - 1 + i, 1));
    const end = new Date(Date.UTC(year, startMonth + i, 0));
    const name = start.toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    await c.query('insert into fiscal_periods(company_id,name,start_date,end_date) values ($1,$2,$3,$4)',
      [companyId, name, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]);
  }
}

/**
 * Creates a company with everything it needs to start: owner access for the creator,
 * starter chart of accounts, posting-role mapping, fiscal periods, numbering and default tax codes.
 * Allowed for any signed-in user who has no company yet, or an existing owner of any company.
 */
export async function createCompany(userId: string, raw: CreateCompanyInput) {
  const input = createCompanySchema.parse(raw);
  return withTx(userId, async (c) => {
    const existing = await c.query(`select 1 from user_company_roles ucr join roles r on r.id=ucr.role_id where ucr.user_id=$1 and r.key='owner' limit 1`, [userId]);
    const anyCompanies = await c.query('select 1 from companies limit 1');
    if (anyCompanies.rowCount! > 0 && existing.rowCount === 0) {
      throw new Error('Only an Owner can add a new company.');
    }
    const co = await c.query(
      `insert into companies(code,name,legal_name,commercial_reg_no,tax_reg_no,features,fiscal_year_start_month)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [input.code, input.name, input.legalName ?? null, input.commercialRegNo ?? null, input.taxRegNo ?? null, input.features, input.fiscalYearStartMonth]);
    const companyId: string = co.rows[0].id;

    await c.query(`insert into user_company_roles(user_id,company_id,role_id) select $1,$2,id from roles where key='owner'`, [userId, companyId]);

    for (const a of COA_TEMPLATE) {
      if (a.feature && !input.features.includes(a.feature as (typeof FEATURES)[number])) continue;
      const r = await c.query(
        `insert into accounts(company_id,code,name,type,subtype,is_control) values ($1,$2,$3,$4,$5,$6) returning id`,
        [companyId, a.code, a.name, a.type, a.subtype ?? null, !!a.control]);
      if (a.role) await c.query('insert into account_roles(company_id,role,account_id) values ($1,$2,$3)', [companyId, a.role, r.rows[0].id]);
    }

    await createPeriods(c, companyId, input.fiscalYearStartMonth, input.fiscalYear);
    for (const d of DOC_TYPES) {
      await c.query('insert into document_sequences(company_id,doc_type,prefix) values ($1,$2,$3)', [companyId, d.type, `${input.code}-${d.prefix}`]);
    }

    // Tax codes: rates are placeholders at 0 and MUST be confirmed by an accountant in Settings.
    const vatIn = await c.query(`select account_id from account_roles where company_id=$1 and role='VAT_INPUT'`, [companyId]);
    const vatOut = await c.query(`select account_id from account_roles where company_id=$1 and role='VAT_OUTPUT'`, [companyId]);
    const from = `${input.fiscalYear}-01-01`;
    const taxes: [string, string, number, string, string, string | undefined][] = [
      ['OUT-STD', 'Output - Standard rate', 0, 'output', 'standard', vatOut.rows[0]?.account_id],
      ['OUT-ZERO', 'Output - Zero rated', 0, 'output', 'zero_rated', vatOut.rows[0]?.account_id],
      ['OUT-EXEMPT', 'Output - Exempt', 0, 'output', 'exempt', undefined],
      ['IN-STD', 'Input - Standard rate', 0, 'input', 'standard', vatIn.rows[0]?.account_id],
      ['IN-ZERO', 'Input - Zero rated', 0, 'input', 'zero_rated', vatIn.rows[0]?.account_id],
      ['IN-EXEMPT', 'Input - Exempt', 0, 'input', 'exempt', undefined],
    ];
    for (const [code, name, rate, dir, cat, acc] of taxes) {
      await c.query(`insert into tax_codes(company_id,code,name,rate,direction,category,account_id,effective_from) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [companyId, code, name, rate, dir, cat, acc ?? null, from]);
    }

    const defaults: Record<string, unknown> = {
      'attachments.max_mb': 10, 'inventory.allow_negative_stock': false, 'inventory.costing': 'weighted_average',
      'sales.credit_limit_mode': 'warn', 'gym.revenue_recognition': 'monthly_deferral', 'money.decimals': 2,
      'session.idle_hours': 8,
    };
    for (const [k, v] of Object.entries(defaults)) {
      await c.query('insert into settings(company_id,key,value) values ($1,$2,$3)', [companyId, k, JSON.stringify(v)]);
    }
    await c.query(`insert into audit_log(actor_id,company_id,entity,entity_id,action,new_value) values ($1::uuid,$2::uuid,'companies',$2::text,'create',$3::jsonb)`,
      [userId, companyId, JSON.stringify({ via: 'setup_wizard', code: input.code })]);
    return { companyId };
  });
}

export async function listUserCompanies(c: Pick<PoolClient, 'query'>, userId: string) {
  const r = await c.query(
    `select distinct co.id, co.code, co.name, co.features from companies co
       join user_company_roles ucr on ucr.company_id = co.id
      where ucr.user_id = $1 and co.is_active order by co.name`, [userId]);
  return r.rows as { id: string; code: string; name: string; features: string[] }[];
}

export async function ensureProfile(userId: string, email: string, fullName = '') {
  await withTx(userId, (c) => c.query(
    `insert into profiles(id,email,full_name) values ($1,$2,$3) on conflict (id) do update set email = excluded.email where profiles.email <> excluded.email`,
    [userId, email, fullName]));
}
