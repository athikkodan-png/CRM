import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/session';
import { visibleNav } from '@/components/nav';

export default async function ComingSoon({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const { company, can } = await requireContext();
  const item = visibleNav(company.features, can).find((n) => n.key === module);
  if (!item) notFound();   // not allowed or not enabled for this company
  return (
    <div className="card max-w-xl"><h1 className="text-xl font-semibold">{item.label}</h1>
      <p className="mt-2 text-slate-600">This area is planned for a later build phase and is not available yet. Nothing is wrong. It will appear here as soon as it is built.</p></div>
  );
}
