import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireContext, COMPANY_COOKIE } from '@/lib/session';
import { visibleNav } from '@/components/nav';
import { supabaseServer } from '@/lib/supabase/server';

async function switchCompany(formData: FormData) {
  'use server';
  const ctx = await requireContext();
  const id = String(formData.get('company'));
  // only allow companies the user belongs to
  if (ctx.companies.some((c) => c.id === id)) (await cookies()).set(COMPANY_COOKIE, id, { path: '/', httpOnly: true, sameSite: 'lax' });
  redirect('/');
}
async function signOut() {
  'use server';
  await (await supabaseServer()).auth.signOut();
  redirect('/login');
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, companies, company, can } = await requireContext();
  const nav = visibleNav(company.features, can);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-brand-900 text-white md:w-60 md:shrink-0">
        <div className="space-y-2 p-3">
          <form action={switchCompany} className="flex gap-2">
            <label htmlFor="company" className="sr-only">Company</label>
            <select id="company" name="company" defaultValue={company.id} className="w-full rounded bg-brand-700 px-2 py-2 text-sm">
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="rounded bg-white/20 px-3 text-sm hover:bg-white/30">Go</button>
          </form>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-2 pb-2 md:block md:space-y-1 md:overflow-visible">
          {nav.map((n) => (
            <Link key={n.key} href={n.href} className="block whitespace-nowrap rounded px-3 py-2 text-sm hover:bg-white/10">{n.label}</Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b bg-white px-4 py-2">
          <p className="text-sm text-slate-600">{company.name}</p>
          <form action={signOut} className="flex items-center gap-3 text-sm"><span className="hidden text-slate-500 sm:inline">{user.email}</span><button className="btn-secondary">Sign out</button></form>
        </header>
        <main className="p-4">{children}</main>
      </div>
    </div>
  );
}
