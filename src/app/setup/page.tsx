import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { requireUser, COMPANY_COOKIE } from '@/lib/session';
import { createCompany, FEATURES } from '@/modules/setup/service';
import { COMPANY_PRESETS } from '@/modules/accounting/coa-template';

const FEATURE_LABELS: Record<string, string> = {
  trading: 'Trading (purchasing, stock, sales)', contracting: 'Contracting / projects & jobs', transport: 'Transportation (vehicles, trips)',
  pipeline_services: 'Pipeline services & equipment (Conquest)', gym: 'Gym (members, POS, shareholders)',
};

async function create(formData: FormData) {
  'use server';
  const user = await requireUser();
  let companyId: string;
  try {
    ({ companyId } = await createCompany(user.id, {
      code: String(formData.get('code')), name: String(formData.get('name')),
      legalName: String(formData.get('legalName') || '') || undefined,
      commercialRegNo: String(formData.get('cr') || '') || undefined,
      taxRegNo: String(formData.get('tax') || '') || undefined,
      features: formData.getAll('features').map(String) as never,
      fiscalYearStartMonth: 1, fiscalYear: Number(formData.get('year')),
    }));
  } catch (e) {
    redirect('/setup?error=' + encodeURIComponent(e instanceof Error ? e.message : 'Something went wrong'));
  }
  (await cookies()).set(COMPANY_COOKIE, companyId, { path: '/', httpOnly: true, sameSite: 'lax' });
  redirect('/');
}

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string; preset?: string }> }) {
  await requireUser();
  const { error, preset = 'rezinko' } = await searchParams;
  const p = COMPANY_PRESETS[preset] ?? COMPANY_PRESETS.rezinko;
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Set up your first company</h1>
      <p className="text-slate-600">This creates the company, a starter chart of accounts, this year&apos;s monthly accounting periods and document numbering. You can edit everything later. Add your other companies afterwards from Settings.</p>
      <nav className="flex flex-wrap gap-2" aria-label="Company type">
        {Object.entries(COMPANY_PRESETS).map(([k, v]) => (
          <a key={k} href={`/setup?preset=${k}`} className={k === preset ? 'btn' : 'btn-secondary'}>{v.label}</a>
        ))}
      </nav>
      {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <form action={create} className="card space-y-3" key={preset}>
        <div><label className="label" htmlFor="name">Company name</label><input id="name" name="name" required defaultValue={p.suggestedName} className="input" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="code">Short code (used in document numbers)</label><input id="code" name="code" required maxLength={12} defaultValue={p.suggestedName.split(' ')[0].slice(0, 4)} className="input" /></div>
          <div><label className="label" htmlFor="year">First accounting year</label><input id="year" name="year" type="number" required defaultValue={new Date().getFullYear()} className="input" /></div>
        </div>
        <div><label className="label" htmlFor="legalName">Legal name (optional)</label><input id="legalName" name="legalName" className="input" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="cr">Commercial registration no. (optional)</label><input id="cr" name="cr" className="input" /></div>
          <div><label className="label" htmlFor="tax">Tax registration no. (optional)</label><input id="tax" name="tax" className="input" /></div>
        </div>
        <fieldset><legend className="label">What does this company do?</legend>
          {FEATURES.map((f) => (
            <label key={f} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" name="features" value={f} defaultChecked={p.features.includes(f)} />{FEATURE_LABELS[f]}</label>
          ))}
        </fieldset>
        <button className="btn">Create company</button>
      </form>
    </main>
  );
}
