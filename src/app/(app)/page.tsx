import { requireContext } from '@/lib/session';

const KPIS: { label: string; feature?: string[]; hint: string }[] = [
  { label: 'Sales this month', hint: 'Appears once you post your first sales invoice.' },
  { label: 'Overdue receivables', hint: 'Invoices past their due date.' },
  { label: 'Payables due this week', hint: 'Supplier bills to pay in the next 7 days.' },
  { label: 'Cash & bank balance', hint: 'Total of your cash and bank accounts.' },
  { label: 'Stock value', feature: ['trading'], hint: 'Value of goods in all warehouses.' },
  { label: 'Open sales orders', feature: ['trading', 'contracting'], hint: 'Orders not yet fully delivered.' },
  { label: 'Active gym members', feature: ['gym'], hint: 'Members with a current membership.' },
  { label: 'Active jobs', feature: ['pipeline_services', 'contracting'], hint: 'Projects and jobs in progress.' },
  { label: 'Vehicles due for service', feature: ['transport', 'pipeline_services'], hint: 'Service or insurance expiring soon.' },
];
const QUICK = ['New Lead', 'New Quotation', 'New Sales Order', 'New Purchase Order', 'Receive Goods', 'New Invoice', 'Record Payment', 'New Expense', 'New Job'];

export default async function Dashboard() {
  const { company } = await requireContext();
  const kpis = KPIS.filter((k) => !k.feature || k.feature.some((f) => company.features.includes(f)));
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Dashboard</h1><p className="text-slate-600">Welcome to {company.name}. Numbers fill in automatically as you record business.</p></div>
      <section aria-label="Quick actions" className="flex flex-wrap gap-2">
        {QUICK.map((q) => <button key={q} disabled title="Coming in a later phase" className="btn-secondary opacity-60">{q}</button>)}
      </section>
      <section aria-label="Key numbers" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="card"><p className="text-sm text-slate-500">{k.label}</p><p className="mt-1 text-2xl font-semibold">QAR 0.00</p><p className="mt-1 text-xs text-slate-400">{k.hint}</p></div>
        ))}
      </section>
      <section className="card"><h2 className="font-medium">Getting started</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Check your company details and tax settings in <a className="text-brand-600 underline" href="/settings">Settings</a>.</li>
          <li>Ask your accountant to confirm the starter chart of accounts and tax rates.</li>
          <li>Next phases add customers, products, sales and purchasing screens.</li>
        </ol>
      </section>
    </div>
  );
}
