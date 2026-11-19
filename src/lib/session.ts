import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getPool } from '@/lib/db';
import { ensureProfile, listUserCompanies } from '@/modules/setup/service';
import { loadPermissions } from '@/lib/permissions';

export const COMPANY_COOKIE = 'active_company';

/** The signed-in user, or redirect to /login. Also makes sure their profile row exists. */
export async function requireUser() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  await ensureProfile(user.id, user.email ?? '', (user.user_metadata?.full_name as string) ?? '');
  return { id: user.id, email: user.email ?? '' };
}

/** User + their companies + the active company (cookie) + permissions. Sends new users to /setup. */
export async function requireContext() {
  const user = await requireUser();
  const pool = getPool();
  const companies = await listUserCompanies(pool, user.id);
  if (companies.length === 0) redirect('/setup');
  const wanted = (await cookies()).get(COMPANY_COOKIE)?.value;
  const company = companies.find((c) => c.id === wanted) ?? companies[0];
  const permissions = await loadPermissions(pool, user.id, company.id);
  return { user, companies, company, permissions, can: (p: string) => permissions.has(p) };
}
