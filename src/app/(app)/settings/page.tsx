import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/session';
import { getPool } from '@/lib/db';

export default async function SettingsPage() {
  const { company, can, user } = await requireContext();
  if (!can('settings.view')) notFound();
  const pool = getPool();
  const [taxes, settings, members] = await Promise.all([
    pool.query('select code,name,rate,direction,category,effective_from from tax_codes where company_id=$1 order by direction,code', [company.id]),
    pool.query('select key,value from settings where company_id=$1 order by key', [company.id]),
    pool.query(`select p.email, p.full_name, r.name role from user_company_roles ucr join profiles p on p.id=ucr.user_id join roles r on r.id=ucr.role_id where ucr.company_id=$1 order by p.email`, [company.id]),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <section className="card"><h2 className="font-medium">Company</h2>
        <p className="text-sm text-slate-600">{company.name} ({company.code}) · features: {company.features.join(', ') || 'none'}</p>
        {can('settings.edit') && <Link href="/setup" className="btn-secondary mt-3">Add another company</Link>}
      </section>
      <section className="card overflow-x-auto"><h2 className="font-medium">Tax codes</h2>
        <p className="mb-2 rounded bg-amber-50 p-2 text-sm text-amber-800">Rates start at 0. Your accountant must confirm the correct rate before you rely on any tax figure (see ASSUMPTIONS.md).</p>
        <table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th>Code</th><th>Name</th><th>Rate %</th><th>Type</th><th>Category</th></tr></thead>
          <tbody>{taxes.rows.map((t) => <tr key={t.code} className="border-b"><td>{t.code}</td><td>{t.name}</td><td>{t.rate}</td><td>{t.direction}</td><td>{t.category}</td></tr>)}</tbody></table>
      </section>
      <section className="card overflow-x-auto"><h2 className="font-medium">Users with access</h2>
        <table className="w-full text-left text-sm"><tbody>{members.rows.map((m) => <tr key={m.email} className="border-b"><td>{m.full_name || m.email}</td><td>{m.email}</td><td>{m.role}</td></tr>)}</tbody></table>
        <p className="mt-2 text-xs text-slate-400">Signed in as {user.email}. Adding users and editing roles arrives next.</p>
      </section>
      <section className="card"><h2 className="font-medium">Company settings</h2>
        <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{settings.rows.map((s) => <div key={s.key} className="flex justify-between border-b py-1"><dt className="text-slate-600">{s.key}</dt><dd>{JSON.stringify(s.value)}</dd></div>)}</dl>
      </section>
    </div>
  );
}
