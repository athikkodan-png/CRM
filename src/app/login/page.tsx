import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';

async function signIn(formData: FormData) {
  'use server';
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: String(formData.get('email')), password: String(formData.get('password')) });
  if (error) redirect('/login?error=' + encodeURIComponent(error.message));
  redirect('/');
}

async function signUp(formData: FormData) {
  'use server';
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get('email')), password: String(formData.get('password')),
    options: { data: { full_name: String(formData.get('name') ?? '') } },
  });
  if (error) redirect('/login?error=' + encodeURIComponent(error.message));
  if (!data.session) redirect('/login?info=' + encodeURIComponent('Account created. Check your email and click the confirmation link, then sign in.'));
  redirect('/');
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; info?: string }> }) {
  const { error, info } = await searchParams;
  return (
    <main className="mx-auto grid min-h-screen max-w-4xl items-center gap-6 p-4 md:grid-cols-2">
      <div className="card space-y-4">
        <h1 className="text-xl font-semibold">Sign in</h1>
        {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        {info && <p className="rounded bg-green-50 p-2 text-sm text-green-800">{info}</p>}
        <form action={signIn} className="space-y-3">
          <div><label className="label" htmlFor="e1">Email</label><input id="e1" name="email" type="email" required autoComplete="email" className="input" /></div>
          <div><label className="label" htmlFor="p1">Password</label><input id="p1" name="password" type="password" required autoComplete="current-password" className="input" /></div>
          <button className="btn w-full">Sign in</button>
        </form>
      </div>
      <div className="card space-y-4">
        <h2 className="text-xl font-semibold">First time? Create your account</h2>
        <p className="text-sm text-slate-600">The first person to create an account and finish setup becomes the Owner. Other users are added later by the Owner.</p>
        <form action={signUp} className="space-y-3">
          <div><label className="label" htmlFor="n2">Your name</label><input id="n2" name="name" required className="input" /></div>
          <div><label className="label" htmlFor="e2">Email</label><input id="e2" name="email" type="email" required autoComplete="email" className="input" /></div>
          <div><label className="label" htmlFor="p2">Password (min 8 characters)</label><input id="p2" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" /></div>
          <button className="btn-secondary w-full">Create account</button>
        </form>
      </div>
    </main>
  );
}
