# ASSUMPTIONS (for accountant review)

Each item is a decision made so work could proceed. Items marked **CONFIRM** need an accountant or the owner to confirm. Everything listed is configurable unless stated.

## General
1. Base currency QAR; dates DD/MM/YYYY; timezone Asia/Qatar.
2. Fiscal year is the calendar year (Jan-Dec) for all companies; 12 monthly periods are created at setup. Posting into a missing, closed or locked period is refused by the database.
3. Journal entries are created as draft and then posted; posting checks debits = credits (database-enforced). Posted entries are immutable; corrections are reversals.
4. Invoice/document numbers are assigned at posting time, sequential per company and document type with no gaps. Format `<COMPANYCODE>-<PREFIX>-00001`.
5. Amounts stored to 4 decimal places; displayed to 2. Rounding differences post to a rounding account.

## Tax - CONFIRM
6. **No tax rate is hardcoded.** Tax codes (input/output; standard, zero-rated, exempt) are created at **0%** as placeholders. An accountant must confirm whether any tax applies and the correct rate and effective dates in Settings before any tax figure is relied on.

## Chart of accounts - CONFIRM
7. The starter chart (`src/modules/accounting/coa-template.ts`) is a generic template, filtered by company type. Account codes, names and the mapping of "posting roles" (AR, AP, inventory, GRNI, COGS, VAT, FX, etc.) must be reviewed by the accountant. It is editable.

## Open business questions: defaults used (owner approved "use defaults")
8. Gym manager is a separate payee taking 20% of profit first; remaining profit 79%/21% between shareholders (rules will be data, never hardcoded). **CONFIRM**
9. Capital items (new machines, loan principal) are shown separately and borne 79:21; they do not reduce the manager's 20%. **CONFIRM**
10. Gym loan interest is an ordinary expense. Loss months: carried forward within the year. **CONFIRM**
11. Gym membership revenue is deferred and recognised monthly (switchable setting `gym.revenue_recognition`).
12. Customer credit limit exceeded: warn only by default, block per customer optionally (setting `sales.credit_limit_mode`).
13. Costing: weighted average per product per company (setting `inventory.costing`). Negative stock is blocked by default.
14. Landed cost added after goods were sold: difference goes to cost of sales.
15. Initial approval thresholds (editable): discount 10%, purchase order 20,000, payment 10,000, expense 5,000 QAR, credit notes always need approval.
16. Shared customers/suppliers/products: one group-level record with per-company balances and terms.

## Security / data
17. Users sign in with Supabase Auth (passwords hashed by Supabase). Business tables are closed to the public API (row level security on, no public policies); only the app server reads/writes.
18. Permissions are checked in the service layer for every action; hiding menu items is only cosmetic.
19. The audit log is append-only (database-enforced) and records who/what/when/old/new for changes to core tables.
20. No real ID, bank, card or personal phone numbers are stored in seed or demo data.
