export interface NavItem { key: string; label: string; href: string; module?: string; feature?: string[]; built?: boolean }
// Sidebar groups from the brief. `feature` = company must have at least one of these features.
export const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/', built: true },
  { key: 'crm', label: 'CRM', href: '/m/crm', module: 'crm' },
  { key: 'sales', label: 'Sales', href: '/m/sales', module: 'sales', feature: ['trading', 'contracting', 'pipeline_services', 'transport'] },
  { key: 'purchasing', label: 'Purchasing', href: '/m/purchasing', module: 'purchasing', feature: ['trading', 'contracting', 'pipeline_services', 'transport'] },
  { key: 'inventory', label: 'Inventory', href: '/m/inventory', module: 'inventory', feature: ['trading'] },
  { key: 'logistics', label: 'Logistics & Transport', href: '/m/logistics', module: 'logistics', feature: ['transport'] },
  { key: 'projects', label: 'Projects & Jobs', href: '/m/projects', module: 'projects', feature: ['contracting', 'pipeline_services'] },
  { key: 'gym', label: 'Gym', href: '/m/gym', module: 'gym', feature: ['gym'] },
  { key: 'accounting', label: 'Accounting', href: '/m/accounting', module: 'accounting' },
  { key: 'reports', label: 'Reports', href: '/m/reports', module: 'reports' },
  { key: 'settings', label: 'Settings', href: '/settings', module: 'settings', built: true },
];
export function visibleNav(features: string[], can: (p: string) => boolean) {
  return NAV.filter((n) => (!n.module || can(`${n.module}.view`)) && (!n.feature || n.feature.some((f) => features.includes(f))));
}
