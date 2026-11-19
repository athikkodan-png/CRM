export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export interface TemplateAccount {
  code: string; name: string; type: AccountType; subtype?: string; control?: boolean;
  role?: string;            // posting role: the posting engine looks accounts up by role
  feature?: string;         // only added if the company has this feature
}

/** Standard starter chart of accounts. Fully editable after creation. Accountant should review. */
export const COA_TEMPLATE: TemplateAccount[] = [
  // Assets
  { code: '1000', name: 'Cash on Hand', type: 'asset', subtype: 'cash', role: 'CASH' },
  { code: '1010', name: 'Bank - Main Account', type: 'asset', subtype: 'bank', role: 'BANK' },
  { code: '1020', name: 'Cheques in Hand (Post-dated)', type: 'asset', subtype: 'cheques', role: 'CHEQUES_RECEIVED' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset', subtype: 'receivable', control: true, role: 'AR_CONTROL' },
  { code: '1110', name: 'Retention Receivable', type: 'asset', subtype: 'receivable', role: 'RETENTION_RECEIVABLE', feature: 'contracting' },
  { code: '1120', name: 'Advances to Suppliers', type: 'asset', subtype: 'prepayment', role: 'SUPPLIER_ADVANCES' },
  { code: '1200', name: 'Inventory', type: 'asset', subtype: 'inventory', control: true, role: 'INVENTORY', feature: 'trading' },
  { code: '1210', name: 'Goods Received Not Invoiced (Clearing)', type: 'liability', subtype: 'accrual', role: 'GRNI', feature: 'trading' },
  { code: '1300', name: 'VAT Input (Recoverable)', type: 'asset', subtype: 'tax', role: 'VAT_INPUT' },
  { code: '1400', name: 'Prepayments', type: 'asset', subtype: 'prepayment' },
  { code: '1500', name: 'Fixed Assets - Cost', type: 'asset', subtype: 'fixed_asset', control: true, role: 'FIXED_ASSETS' },
  { code: '1590', name: 'Accumulated Depreciation', type: 'asset', subtype: 'accum_depreciation', control: true, role: 'ACCUM_DEPRECIATION' },
  // Liabilities
  { code: '2000', name: 'Accounts Payable', type: 'liability', subtype: 'payable', control: true, role: 'AP_CONTROL' },
  { code: '2010', name: 'Customer Advances', type: 'liability', subtype: 'advance', role: 'CUSTOMER_ADVANCES' },
  { code: '2020', name: 'Accrued Expenses', type: 'liability', subtype: 'accrual' },
  { code: '2100', name: 'VAT Output (Payable)', type: 'liability', subtype: 'tax', role: 'VAT_OUTPUT' },
  { code: '2200', name: 'Loans Payable', type: 'liability', subtype: 'loan', control: true, role: 'LOANS' },
  { code: '2300', name: 'Deferred Membership Revenue', type: 'liability', subtype: 'deferred_revenue', role: 'DEFERRED_REVENUE', feature: 'gym' },
  { code: '2400', name: 'Retention Payable', type: 'liability', subtype: 'retention', role: 'RETENTION_PAYABLE', feature: 'contracting' },
  // Equity
  { code: '3000', name: 'Share Capital', type: 'equity', subtype: 'capital', role: 'SHARE_CAPITAL' },
  { code: '3100', name: 'Retained Earnings', type: 'equity', subtype: 'retained', role: 'RETAINED_EARNINGS' },
  { code: '3200', name: 'Shareholder Current Accounts', type: 'equity', subtype: 'shareholder', control: true, role: 'SHAREHOLDER_CURRENT' },
  { code: '3300', name: 'Owner Drawings / Distributions', type: 'equity', subtype: 'drawings', role: 'DISTRIBUTIONS' },
  // Income
  { code: '4000', name: 'Sales Revenue', type: 'income', subtype: 'sales', role: 'SALES_REVENUE' },
  { code: '4100', name: 'Service Revenue', type: 'income', subtype: 'service', role: 'SERVICE_REVENUE' },
  { code: '4200', name: 'Contract Revenue', type: 'income', subtype: 'contract', role: 'CONTRACT_REVENUE', feature: 'contracting' },
  { code: '4210', name: 'Pipeline Survey & Rehabilitation Revenue', type: 'income', subtype: 'contract', feature: 'pipeline_services' },
  { code: '4300', name: 'Transportation Revenue', type: 'income', subtype: 'service', feature: 'transport' },
  { code: '4400', name: 'Membership Revenue', type: 'income', subtype: 'membership', role: 'MEMBERSHIP_REVENUE', feature: 'gym' },
  { code: '4410', name: 'POS Sales (Accessories & Supplements)', type: 'income', subtype: 'pos', feature: 'gym' },
  { code: '4900', name: 'Other Income', type: 'income', subtype: 'other' },
  { code: '4950', name: 'Foreign Exchange Gain', type: 'income', subtype: 'fx', role: 'FX_GAIN' },
  // Expenses
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense', subtype: 'cogs', role: 'COGS', feature: 'trading' },
  { code: '5010', name: 'Purchases / Direct Costs', type: 'expense', subtype: 'cogs', role: 'PURCHASES' },
  { code: '5020', name: 'Stock Adjustment Variance', type: 'expense', subtype: 'variance', role: 'STOCK_VARIANCE', feature: 'trading' },
  { code: '5030', name: 'Damaged Stock Write-off', type: 'expense', subtype: 'variance', role: 'STOCK_WRITE_OFF', feature: 'trading' },
  { code: '5040', name: 'Freight, Customs & Landed Costs (Clearing)', type: 'expense', subtype: 'landed', role: 'LANDED_COST', feature: 'trading' },
  { code: '5100', name: 'Subcontractor Costs', type: 'expense', subtype: 'direct', feature: 'contracting' },
  { code: '5200', name: 'Vehicle Fuel', type: 'expense', subtype: 'vehicle', feature: 'transport' },
  { code: '5210', name: 'Vehicle Maintenance & Repairs', type: 'expense', subtype: 'vehicle', feature: 'transport' },
  { code: '5220', name: 'Equipment Operating & Repairs', type: 'expense', subtype: 'equipment', feature: 'pipeline_services' },
  { code: '6000', name: 'Salaries & Wages', type: 'expense', subtype: 'staff' },
  { code: '6010', name: 'Staff Welfare', type: 'expense', subtype: 'staff' },
  { code: '6100', name: 'Rent', type: 'expense', subtype: 'premises' },
  { code: '6110', name: 'Electricity & Water', type: 'expense', subtype: 'premises' },
  { code: '6200', name: 'Office & General Expenses', type: 'expense', subtype: 'admin' },
  { code: '6300', name: 'Professional Fees', type: 'expense', subtype: 'admin' },
  { code: '6400', name: 'Bank Charges', type: 'expense', subtype: 'finance' },
  { code: '6410', name: 'Loan Interest', type: 'expense', subtype: 'finance', role: 'LOAN_INTEREST' },
  { code: '6500', name: 'Depreciation Expense', type: 'expense', subtype: 'depreciation', role: 'DEPRECIATION_EXPENSE' },
  { code: '6600', name: 'Trainer Commissions', type: 'expense', subtype: 'gym', feature: 'gym' },
  { code: '6610', name: 'Target Commissions', type: 'expense', subtype: 'gym', feature: 'gym' },
  { code: '6620', name: 'Laundry', type: 'expense', subtype: 'gym', feature: 'gym' },
  { code: '6630', name: 'Counter Staffing', type: 'expense', subtype: 'gym', feature: 'gym' },
  { code: '6640', name: 'Staff Room Rent', type: 'expense', subtype: 'gym', feature: 'gym' },
  { code: '6650', name: 'Gym Accessories (Cost)', type: 'expense', subtype: 'gym', feature: 'gym' },
  { code: '6900', name: 'Foreign Exchange Loss', type: 'expense', subtype: 'fx', role: 'FX_LOSS' },
  { code: '6910', name: 'Rounding Differences', type: 'expense', subtype: 'other', role: 'ROUNDING' },
];

export const COMPANY_PRESETS: Record<string, { label: string; features: string[]; suggestedName: string }> = {
  rezinko: { label: 'Trading, contracting & transportation (Rezinko)', features: ['trading', 'contracting', 'transport'], suggestedName: 'REZINKO' },
  conquest: { label: 'Pipeline survey, rehabilitation & cleaning (Conquest)', features: ['contracting', 'pipeline_services', 'transport'], suggestedName: 'CONQUEST INTERNATIONAL' },
  gym: { label: 'Gym (Olympian Fitness)', features: ['gym'], suggestedName: 'OLYMPIAN FITNESS' },
  custom: { label: 'Other / custom', features: ['trading'], suggestedName: '' },
};

export const DOC_TYPES: { type: string; prefix: string }[] = [
  ['quotation', 'QT'], ['sales_order', 'SO'], ['delivery_note', 'DN'], ['invoice', 'INV'], ['credit_note', 'CN'],
  ['receipt', 'RC'], ['purchase_order', 'PO'], ['goods_receipt', 'GR'], ['supplier_invoice', 'SI'],
  ['debit_note', 'DBN'], ['payment_voucher', 'PV'], ['journal', 'JV'],
].map(([type, p]) => ({ type, prefix: p + '-' }));
