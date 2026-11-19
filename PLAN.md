# PLAN.md — Multi-Company CRM + ERP (Qatar Trading & Services Group)

Status: **DRAFT FOR YOUR APPROVAL. No feature code has been written.**
Companies: REZINKO (primary), CONQUEST INTERNATIONAL, OLYMPIAN FITNESS.

---

## 0. Plain-language summary (read this first)

- We build **one web application** that runs on your computer first (nothing is published online). You open it in a browser like a website.
- One login. A **company switcher** at the top changes which company's books you are looking at. Each company has its own accounts, numbering, taxes and reports. Customers, suppliers and products can be shared across companies where useful.
- Everything money-related goes through **one accounting engine**. When you post an invoice, receive goods or pay a bill, the engine updates stock, receivables/payables and the books together, or not at all. You cannot end up with half-saved data.
- Posted documents are **never edited or deleted**. You fix mistakes with a reversal / credit note, which leaves a clear trail for your accountant.
- I will build in 8 phases. After each phase the app runs, tests pass, and the work is saved in git. I will explain in plain words what changed and what to click.
- Section 11 lists the **questions I need you to answer** before I start. Each has a recommended default, so you can reply "use your defaults" if you prefer.

---

## 1. Proposed technology stack (with reasons)

| Area | Choice | Why (plain language) |
|---|---|---|
| Language | **TypeScript** everywhere | One language for screens and server; the compiler catches many mistakes before you ever see them. Important for money code. |
| Web framework | **Next.js (App Router)** | Industry standard, one project for UI + server, good for responsive/phone use. |
| Database | **PostgreSQL 16** | The most trustworthy open-source database for accounting: real transactions, exact decimal numbers, triggers and constraints that can *refuse* bad data (needed for "unbalanced entries are rejected in the database"). |
| DB access | **Prisma** (+ hand-written SQL migrations for triggers/constraints) | Type-safe queries and migrations. Prisma cannot express DB triggers, so those go in raw SQL migration files. |
| UI | **Tailwind CSS + shadcn/ui** | Clean, accessible components; easy to keep simple and consistent. |
| Forms/validation | **React Hook Form + Zod** | Same Zod rules validate in the browser and on the server. Keyboard-friendly line grids (Tab/Enter/arrow navigation) built on top. |
| Tables | **TanStack Table** (server-side sort/filter/pagination) | Needed for "sorting, filtering, saved views and pagination everywhere". |
| Charts | **Recharts** | As you proposed. |
| Money maths | **decimal.js** + Postgres `NUMERIC` | Never use floating point for money or quantity. |
| Auth | **Own implementation**: argon2id password hashes, database-backed sessions with expiry, optional TOTP 2FA (`otplib`) | Full control over audit logging and per-company permissions; avoids fighting a library. |
| Background jobs | **pg-boss** (job queue inside Postgres) | Daily backups, notification checks, depreciation, membership expiry. No extra Redis service to run. |
| PDFs | **Headless Chromium (Playwright) rendering HTML templates → PDF** | Handles Arabic shaping and right-to-left properly, logo/signature blocks are just HTML/CSS. (Alternative in §10.) |
| Excel / CSV | **exceljs** (xlsx), **papaparse** (CSV) | Import with dry-run and export from every list/report. |
| Email | **nodemailer** (SMTP). Dev uses **Mailpit** (fake inbox) | Nothing is really sent while developing. |
| Files | Local disk volume (`/data/attachments`), metadata in DB | Included in backups. Storage interface so it can move to S3-type storage later. |
| Tests | **Vitest** (unit + DB integration against a real test Postgres), **Playwright** (end-to-end) | As you proposed. Accounting rules are tested against a real database, not mocks. |
| Packaging | **Docker Compose**: `app`, `worker`, `db`, `mailpit` | `docker compose up` is the only command you need. |
| Lint/format | ESLint, Prettier, TypeScript strict mode | Quality gate on every commit. |

**Architecture style:** a *modular monolith*. One application, one database, cleanly separated modules (CRM, Sales, Purchasing, Inventory, Accounting, …). No microservices — far simpler for you to run and for me to keep correct.

---

## 2. Architecture

### 2.1 Layers

```
Browser (React pages, forms, tables)
   │  server actions / route handlers (thin: parse input, call a service)
   ▼
Service layer  ──  the ONLY place business rules and DB writes live
   │   • every service call: authenticate → authorize (company + permission) → validate (Zod)
   │   • runs inside ONE database transaction
   │   • writes audit log entries in the same transaction
   ▼
Posting engine (Accounting) + Stock engine (Inventory) + Numbering + Approvals
   ▼
PostgreSQL (constraints + triggers as the last line of defence)
```

- **UI never talks to the database.** API routes and server actions never contain business logic. This is what makes "blocked in both the UI and the API" testable: permission is checked in the service layer, so every entry point is covered; the UI additionally hides buttons.
- **One service per business action** (e.g. `postSalesInvoice`, `receiveGoods`, `recordPayment`, `reverseDocument`). Each runs in a single transaction: all-or-nothing, as required in section 13 of the brief.

### 2.2 Multi-company model

- A `Company` row is a separate legal entity. **Every transactional table has `company_id`** (NOT NULL, foreign key, indexed). Composite foreign keys (`company_id`, `id`) stop a document in company A from pointing at a record in company B.
- `UserCompanyRole` links user ↔ company ↔ role. A user sees only companies they are assigned to. The service layer injects the `company_id` filter into every query through a single tenant-scoped data-access helper (no raw unscoped queries in modules).
- **Defence in depth:** Postgres Row-Level Security policies keyed on a per-transaction setting (`app.company_ids`). Even a coding mistake cannot leak another company's rows. (Tested.)
- **Shared master data (recommended):** `Party` (customer/supplier/both), `Product` and `Contact` are **group-level records**, with a per-company extension row (`PartyCompany`, `ProductCompany`) holding credit limit, payment terms, control accounts, prices, reorder levels, etc. A customer shared between Rezinko and Conquest has one name/TRN/contacts but separate balances and terms in each company's books. See open question Q3.
- **Adding a new company later** = insert a company, pick a chart-of-accounts template and a role set in a setup wizard. No schema or code changes. Company-type feature flags (`trading`, `contracting`, `transport`, `pipeline_services`, `gym`) switch modules on/off per company and drive the sidebar.

### 2.3 Money, quantities, currency, time

- All amounts `NUMERIC(18,4)`; quantities `NUMERIC(18,4)`; exchange rates `NUMERIC(18,8)`. Rounding rule configurable (default 2 decimals QAR, round-half-up) and applied at line level; any rounding difference posts to a rounding account.
- Every transaction stores: transaction currency, `fx_rate` to QAR **as used**, amount in both currencies. Rates come from an `ExchangeRate` table (date, from, to, rate) maintained in Settings (manual entry + CSV import; no external feed without your approval).
- Dates stored as `DATE`/`TIMESTAMPTZ`; displayed `DD/MM/YYYY`, timezone `Asia/Qatar`. Currency display `QAR 1,234.50`.
- **Arabic-ready:** all UI text goes through an i18n dictionary (`next-intl`), CSS uses logical properties (`margin-inline-start`, etc.) so a right-to-left switch later is a translation task, not a rewrite. English only at launch; PDFs get an optional bilingual header.

### 2.4 Integrity rules enforced in the **database** (not only in code)

| Rule | Mechanism |
|---|---|
| Journal entry must balance | Deferred `CONSTRAINT TRIGGER` on `journal_lines` checks `SUM(debit)=SUM(credit)` per entry at commit; also checked in code before insert. |
| Posted journal entries are immutable | `BEFORE UPDATE/DELETE` triggers on `journal_entries` / `journal_lines` raise an error once `status='posted'`. Corrections = new reversing entry (`reverses_entry_id`). |
| Stock ledger is append-only | `BEFORE UPDATE/DELETE` trigger on `stock_movements` raises error. Reversals are new opposite movements. |
| Audit log is append-only | Same trigger pattern; the app's DB role has no UPDATE/DELETE grant on it. |
| Posted/approved documents cannot be deleted | Trigger on each document header table blocks DELETE and blocks edits to protected columns when `status` ≠ draft. |
| Closed/locked fiscal period | Trigger on `journal_entries` insert rejects dates inside a closed/locked period. |
| Gapless numbering | Number is assigned **at posting time**, inside the posting transaction, from `document_sequences` using `SELECT … FOR UPDATE`. If the transaction rolls back the counter rolls back too, so no gaps. Drafts show "DRAFT", not a number. Unique `(company_id, doc_type, number)`. |
| Stock never edited directly | No `quantity` column on product; "on hand" is `SUM(stock_movements)`. A trigger-maintained `stock_balances` table is an optimisation only; a test asserts it always equals the sum. |
| Negative stock | Setting per company/warehouse: block (default) or allow with warning. |

---

## 3. Database schema (summary)

All tables have `id` (UUID), `created_at`, `updated_at`, `created_by` unless noted. Tables marked **[C]** carry `company_id`. The full Prisma schema and SQL triggers are written in Phase 1–2; this is the design.

### 3.1 Core / security (Phase 1)
- `companies` — name, legal name, CR no., tax reg. no., address, logo, base currency (QAR), fiscal year start, feature flags, numbering prefixes.
- `users`, `user_sessions`, `user_totp`, `password_resets`
- `roles`, `permissions` (module × action), `role_permissions`, `user_company_roles` [C], `field_restrictions` (e.g. hide `cost`, `margin` for a role)
- `audit_log` — append-only: actor, company, entity, entity_id, action (create/edit/delete/post/approve/login/permission), old_value JSONB, new_value JSONB, ip, timestamp.
- `settings` [C] — key/value with type (attachment size limit, rounding, negative-stock rule, gym revenue recognition, etc.)
- `tax_codes` [C] — code, name, rate, type (input/output), category (standard/zero/exempt), account mapping, `effective_from`, `effective_to`. **No rate is ever hardcoded.**
- `currencies`, `exchange_rates`
- `document_sequences` [C] — doc_type, prefix, next_number, padding, (fiscal-year reset optional).
- `approval_rules` [C], `approval_requests` [C], `approval_steps` — see 3.9.
- `notifications`, `notification_rules`, `saved_views`, `attachments` (polymorphic: entity_type + entity_id, file metadata, checksum), `email_templates`, `email_log`.

### 3.2 Accounting (Phase 1 chart, Phase 5 rest)
- `accounts` [C] — code, name, type (asset/liability/equity/income/expense), subtype, parent, is_control, is_bank/is_cash, currency, active.
- `account_roles` [C] — maps a *role* (`AR_CONTROL`, `AP_CONTROL`, `INVENTORY`, `GRNI`, `COGS`, `VAT_INPUT`, `VAT_OUTPUT`, `FX_GAIN`, `FX_LOSS`, `STOCK_VARIANCE`, `ROUNDING`, `DEFERRED_REVENUE`, `RETENTION_RECEIVABLE`, `SHAREHOLDER_CURRENT`, …) to an account. The posting engine only ever asks for roles, so charts can be edited safely.
- `fiscal_years`, `fiscal_periods` [C] — status: open / closed / locked.
- `journal_entries` [C] — number, date, period, status (draft/posted), source_type, source_id (link back to document), memo, `reverses_entry_id`, currency/fx.
- `journal_lines` — entry, account, debit, credit, party, project/job/vehicle/dimension tags, tax code, foreign amount + currency.
- `bank_accounts` [C], `bank_statement_imports`, `bank_statement_lines`, `bank_reconciliations`, `reconciliation_matches`.
- `fixed_assets` [C], `depreciation_schedules`, `asset_disposals`.
- `loans` [C], `loan_schedule_lines` (principal / interest split).
- `cheques` [C] — received/issued, number, bank, due date (post-dated), status (held/deposited/cleared/bounced).
- `dimensions` — cost-centre tags (project, job, vehicle, equipment, gym) used on journal lines for profitability reports.

### 3.3 Parties & CRM (Phase 2–3)
- `parties` (group-level) — type flags, name, Arabic name, tax reg. no., country, default currency.
- `party_companies` [C] — credit limit + mode (warn/block), payment terms, receivable/payable account override, salesperson, price list.
- `contacts` (several per party), `party_documents` (trade licence, approvals, expiry dates → notifications).
- `leads` [C] — stage (new/contacted/qualified/quotation_sent/won/lost), lost_reason, value, owner, source.
- `activities` (notes, calls, meetings, emails; polymorphic to party/lead), `tasks` (due date, reminder, assignee).

### 3.4 Products & inventory (Phase 2)
- `products` (group-level) — SKU, barcode, category, base UoM, HS code, country of origin, is_stock_item, is_service; `product_companies` [C] — prices, reorder level, default supplier, accounts.
- `uoms`, `uom_conversions` (per product).
- `warehouses` [C] (types: warehouse / project site / vehicle), `bins`.
- `stock_movements` [C] — **append-only ledger**: product, warehouse, bin, qty (signed), unit_cost, movement_type, source_type/source_id, date, `reverses_movement_id`.
- `stock_balances` [C] — derived cache (trigger-maintained, verified by tests).
- `cost_layers` [C] — weighted-average state per product (and FIFO layers if FIFO is switched on).
- `stock_reservations` [C] — created by sales orders.
- `stock_transfers`, `stock_counts`, `stock_adjustments` (approval required).

### 3.5 Sales (Phase 3)
`quotations`, `sales_orders`, `delivery_notes`, `sales_invoices`, `credit_notes`, `receipts` (+ `receipt_allocations` for payment ↔ many invoices, advances) — each with a `_lines` table. Lines link back to the upstream line (`source_line_id`) with `qty_delivered` / `qty_invoiced` derived from linked documents so partial deliveries/invoices are exact.

### 3.6 Purchasing & shipments (Phase 4)
`purchase_requests`, `purchase_orders`, `goods_receipts`, `supplier_invoices`, `supplier_payments` (+ allocations), `debit_notes`, `purchase_returns`, `landed_cost_documents` (+ `landed_cost_lines`, `landed_cost_allocations` by value/weight/quantity), `shipments` (container, BL/AWB, ports, ETD/ETA, status, costs in foreign currency with rate at date), `shipment_documents`.

### 3.7 Operations: transport, projects, equipment (Phase 6)
- `vehicles` [C], `drivers`, `trips` (linked to sales order or project), `fuel_logs`, `maintenance_logs`, `vehicle_documents` (insurance/registration expiry).
- `projects` [C] (used for Rezinko contracts and Conquest jobs) — client, location, budget, status, contract value, retention %; `project_budget_lines`, `project_costs` (view over tagged journal lines + time + equipment usage), `progress_billings` (interim by %, retention withheld/released), `daily_job_logs` (crew, equipment, hours, metres surveyed/repaired, photos via attachments), `timesheets`, `employees` (minimal: name, role, hourly cost rate, no ID numbers).
- `equipment` [C] — type (jetting unit, tanker, super sucker, traffic mgmt vehicle, CCTV kit), purchase cost, depreciation link to fixed asset, usage hours, service due; `equipment_usage`.

### 3.8 Gym (Phase 6)
`gym_members` [C] (minimal contact data), `membership_packages`, `memberships` (start/end, freezes, renewals), `membership_freezes`, `trainers`, `pt_sessions` (commission per session / per target), `gym_pos_sales` (+ lines), `daily_cash_counts` (expected vs counted, variance), `gym_expense_categories`, `shareholders`, `distribution_rules` (versioned, effective-dated), `distribution_runs` (per month, locked after approval), `distribution_run_lines`.

### 3.9 Approvals
`approval_rules`: company, document type (quotation discount %, PO amount, payment amount, stock adjustment, credit note, expense), threshold, approver role. Creating/posting a document over the threshold sets status `pending_approval` and notifies approvers; the posting service refuses to post until approved. Approver cannot be the same user as the requester (configurable).

---

## 4. Posting engine (how every transaction touches the books)

One `PostingService` turns a document into a balanced journal entry using **account roles** and **tax codes**; the stock engine writes movements in the same DB transaction. This is the table from section 13 of your brief, made concrete:

| Action | Journal (Dr / Cr) | Stock |
|---|---|---|
| Goods receipt | Dr Inventory, Cr GRNI (goods received not invoiced) | + qty at cost; weighted avg recalculated |
| Landed cost posted | Dr Inventory, Cr Payable/Accrual; allocated to receipt lines → unit cost updated | cost layer updated (if goods already sold, difference goes to COGS — see Q9) |
| Supplier invoice | Dr GRNI (or Purchases/Expense), Dr VAT input, Cr AP; price differences to a variance account | — |
| Delivery note | Dr COGS, Cr Inventory (at weighted avg cost on that date) | − qty |
| Sales invoice | Dr AR, Cr Revenue, Cr VAT output. (If goods not yet delivered, delivery posts COGS when delivered.) | — |
| Receipt | Dr Bank/Cash, Cr AR (or Cr Customer advances) | — |
| Supplier payment | Dr AP, Cr Bank/Cash | — |
| Credit note | Dr Revenue, Dr VAT output, Cr AR; if goods returned: Dr Inventory, Cr COGS (damaged → Dr Write-off expense) | + qty back at original cost |
| Debit note / purchase return | Dr AP, Cr Inventory/GRNI, Cr VAT input | − qty |
| Stock adjustment (approved) | Dr/Cr Inventory vs Stock variance | ± qty |
| Expense | Dr Expense (+VAT input), Cr Bank/Cash or AP | — |
| Gym membership payment | Dr Cash/Bank, Cr Deferred revenue; monthly job: Dr Deferred, Cr Revenue (configurable: recognise on receipt instead) | — |
| Loan repayment | Dr Loan (principal), Dr Interest expense, Cr Bank | — |
| Asset purchase | Dr Fixed asset, Cr Bank/AP; monthly depreciation: Dr Depreciation exp, Cr Accumulated depreciation | — |
| Interim project invoice | Dr AR, Dr Retention receivable, Cr Revenue (+VAT per rule); release: Dr AR, Cr Retention receivable | — |
| FX revaluation (period end) | Unrealised gain/loss on open foreign AR/AP/bank, auto-reversed next period; realised gain/loss on settlement | — |

**Reversal:** `reverseDocument()` creates the opposite journal entry and opposite stock movements, links them both ways, marks the original `reversed`. Original rows are never touched.

**Costing:** weighted average by default (company setting); FIFO layers are implemented as an optional mode in Phase 4 if you want it (Q8).

---

## 5. Gym shareholder distribution (configurable, never hardcoded)

Rules live in `distribution_rules` (effective-dated, editable by Owner/Accountant only, every change audited):

1. `profit = revenue − ordinary expenses` for the period (month; YTD is the sum of months).
2. `manager_share = 20% × profit` (percent from rules). Taken **first**.
3. `remaining = profit − manager_share`; split **79% / 21%** between majority and other shareholder (percentages from rules).
4. **Capital items** (new machine purchases, loan *principal* repayments) are classified by expense category flag `treatment = capital`. They are **not** deducted before the manager's 20%. They appear in a separate "Reinvestment (capital)" section, borne by shareholders 79:21.
5. Partner role gets a read-only monthly and YTD statement. First import: Jan–Oct from your spreadsheet.
6. Loan **interest** is an ordinary expense unless you say otherwise (Q11). Negative profit months: Q12.

Every choice is written to `ASSUMPTIONS.md` for your accountant.

---

## 6. Roles and permissions

Roles per company: Owner/Admin, Manager, Accountant, Sales, Purchasing, Warehouse, Logistics/Driver, Gym Staff (membership + POS only), Partner (read-only reports).

- Permission = **module × action**: `view, create, edit, approve, post, delete, export` (e.g. `sales.invoice.post`).
- Role templates ship with sensible defaults; Owner can adjust per company.
- **Field-level:** `cost.view` and `margin.view` permissions; when absent, those fields are stripped from API responses (not just hidden in the UI), reports, exports and PDFs.
- Sessions expire (default 8 h idle, configurable). Login throttling. Optional TOTP 2FA per user, enforceable per role.
- `delete` is available only for drafts; posted/approved documents show "Reverse" instead.

---

## 7. Module list → sidebar mapping

| Sidebar group | Contents |
|---|---|
| Dashboard | KPI cards, charts, quick actions, notifications |
| CRM | Leads + pipeline board, customers, contacts, activities, tasks, email log |
| Sales | Quotations, sales orders, delivery notes, invoices, receipts, credit notes, cheques |
| Purchasing | Suppliers, purchase requests, POs, goods receipts, supplier invoices, payments, debit notes, landed costs, shipments |
| Inventory | Products, warehouses, stock on hand, movements, transfers, counts/adjustments, reorder |
| Logistics & Transport | Vehicles, drivers, trips, fuel, maintenance (Rezinko) |
| Projects & Jobs | Projects/jobs, progress billing, daily job log, equipment register (Rezinko contracting, Conquest) |
| Gym | Members, packages, memberships, PT sessions, POS, daily cash, expenses, shareholder statements |
| Accounting | Journals, chart of accounts, banks & reconciliation, fixed assets, loans, periods, tax codes, VAT |
| Reports | Financial, receivables/payables, stock, sales, profitability, VAT, gym/shareholder |
| Settings | Companies, users & roles, approvals, numbering, taxes, currencies, email templates, import/export, backups, audit log, notifications |

Sidebar items appear only if the company's feature flags and the user's permissions allow.

---

## 8. Build phases (each ends: app runs, tests pass, git commit, plain-language handover)

**Phase 1 — Foundation.** Repo, Docker Compose, CI-style `npm test`, DB migrations, auth (hashing, sessions, optional 2FA), companies + switcher, roles/permissions engine, audit log, settings, tax codes, currencies/rates, chart of accounts + starter template, numbering service, guided first-run wizard, dashboard shell with empty states. Also creates `ASSUMPTIONS.md`.
*Exit tests:* login/session expiry; user sees only allowed companies; permission denied in API **and** UI; audit rows written and un-editable; cannot save unbalanced journal (DB-level test).

**Phase 2 — Master data & stock ledger.** Parties, contacts, products, UoM conversions, warehouses/bins, append-only stock movements, opening stock, stock on hand screen, saved views/filters/sorting/pagination framework, attachments, global search v1, CSV/XLSX import framework (dry run, row-level errors, duplicates, templates) used first for customers/suppliers/products.
*Exit tests:* stock on hand = sum of movements; 500-row product CSV with errors reports each row number.

**Phase 3 — CRM & Sales.** Leads/pipeline board, tasks/follow-ups, quotation → sales order (reservation) → delivery note → invoice → receipt, partial delivery/invoice, credit limits, returns/credit notes, payment allocation/advances/cheques, approvals (discount), email templates + log. Posting engine v1 (sales side).
*Exit tests:* partial deliveries/invoices; reversal restores stock and journals; posted docs can't be deleted.

**Phase 4 — Purchasing & shipments.** PR → PO → goods receipt (partial) → supplier invoice → payment, debit notes, landed costs and allocation, shipments, multi-currency with rate at date, weighted-average cost updates, stock transfers/counts/adjustments with approval.

**Phase 5 — Accounting.** Manual journals, reversals, fiscal periods (open/close/lock), receivables/payables ledgers + ageing, bank statement CSV import + reconciliation, fixed assets + depreciation + disposal, loans + schedule, FX revaluation, trial balance, GL, P&L, balance sheet, cash flow (indirect), VAT return.
*Exit tests:* trial balance balances after seed **and after 100 random transactions** (property-style randomised test).

**Phase 6 — Operations & Gym.** Transport (vehicles, trips, fuel, maintenance, cost per trip/vehicle), projects/jobs (budget vs actual, interim billing, retention, daily job log, timesheets), equipment register, gym (members, packages, freezes, renewals, PT commissions, POS, daily cash, expenses), shareholder distribution + partner read-only view, Jan–Oct import.

**Phase 7 — Reports, notifications, documents, backup.** All reports with filter + Excel/CSV/PDF export, dashboard charts, notification engine (in-app + optional email), PDF documents with logo/signature/Arabic header, remaining importers (opening balances must balance, COA, bank statements, gym members, vehicles), daily backup (30-day retention, includes attachments), manual backup/restore with confirmation, full-data ZIP export.
*Exit test:* backup → restore round trip gives identical totals.

**Phase 8 — Polish.** Phone/laptop responsiveness pass, accessibility (keyboard, contrast, labels), empty states and inline help, performance on large lists, demo-data refinement, README with setup steps and plain-language "How to use" guide, final run of all acceptance tests.

Rough sizing: this is a large system. Realistically each phase is several working sessions. I will keep each phase small enough to review.

---

## 9. Testing strategy

- **Unit (Vitest):** money/rounding, tax calc, costing, allocation (landed cost), distribution formula, ageing buckets.
- **Integration (Vitest + real Postgres):** every posting service: assert journal lines, stock movements, balances, audit rows; trigger tests (unbalanced entry rejected, posted entry immutable, ledger append-only, delete blocked).
- **Randomised test:** 100+ random mixed transactions → trial balance debits = credits; stock balance = movement sum for every product/warehouse.
- **Security tests:** a matrix of role × endpoint proving denial at API level; company isolation incl. RLS.
- **E2E (Playwright):** first-run wizard, quote-to-cash, purchase-to-pay, gym membership + shareholder statement, import dry run, backup/restore.
- All 8 acceptance tests from your brief become named tests in `tests/acceptance/`.

---

## 10. Technical choices — options and recommendations

| # | Decision | Options | Recommendation |
|---|---|---|---|
| T1 | PDF engine | (a) Chromium HTML→PDF (b) `@react-pdf/renderer` (c) pdfmake | **(a)**: best Arabic/RTL and easiest to style; costs a larger Docker image. |
| T2 | Auth | (a) own (argon2 + DB sessions) (b) Auth.js | **(a)**: tight audit/permission integration. |
| T3 | Job runner | (a) pg-boss in worker container (b) cron in container (c) Redis + BullMQ | **(a)**: no extra services. |
| T4 | Tenant isolation | (a) service-layer filter only (b) + Postgres RLS | **(b)**: small extra work, strong safety. |
| T5 | Repo layout | (a) single Next.js app with `src/modules/*` (b) pnpm monorepo | **(a)**: simplest for a non-technical owner. |
| T6 | Shared master data | (a) group-level party/product + per-company rows (b) fully separate per company | **(a)**, see Q3. |

Proposed layout:
```
/src/app            pages (App Router)
/src/modules/<name> service, schema (zod), queries, components per module
/src/lib            auth, permissions, money, i18n, pdf, files, jobs
/prisma             schema.prisma, migrations (incl. SQL triggers)
/seed               demo data (fictitious)
/tests              unit, integration, acceptance, e2e
docker-compose.yml  Dockerfile  .env.example  README.md  ASSUMPTIONS.md  PLAN.md
```

**Run locally (what you will eventually do):** install Docker Desktop → `docker compose up` → open `http://localhost:3000` → follow the first-run wizard. Backups write to a Docker volume and an optional folder you choose.

---

## 11. Open questions (reply by number; "default" = use my recommendation)

**Business rules**
1. **Gym manager's 20%:** Is the manager also one of the two shareholders, or a separate person paid only the 20%? *Default: separate payee, shown on the statement.*
2. **Capital items in the gym (machines, loan principal):** Confirm they are paid from the cash that would otherwise be profit, and the "79:21" burden is shown as a deduction from each shareholder's share, not a reduction of the 20%. *Default: as written in the brief.*
3. **Shared customers/suppliers/products:** one group-level record with per-company balances and terms (recommended), or fully separate records per company?
4. **VAT:** Qatar does not currently levy VAT. Should I build full VAT support with rates entered in Settings (default rate 0, nothing hardcoded) so it works if/when introduced? *Default: yes; ASSUMPTIONS.md notes an accountant must confirm.*
5. **Fiscal year:** calendar year (Jan–Dec) for all three companies? *Default: yes, configurable per company.*
6. **Gym revenue recognition:** recognise membership fees monthly over the membership period (deferred revenue), or when cash is received? *Default: monthly deferral, switchable.*
7. **Customer credit limit exceeded:** warn only, or block? *Default: warn, with a per-customer "block" option and manager override.*
8. **Costing:** weighted average per product per company (not per warehouse). FIFO later only if needed? *Default: yes.*
9. **Landed cost added after goods were already sold:** put the difference into cost of sales (recommended) or ignore until restock?
10. **Retention (contracting):** is retention shown as a receivable only on invoice, and is VAT treatment relevant? Typical retention % and release terms for Rezinko / Conquest contracts? *Default: configurable % per project.*
11. **Loan interest in gym:** ordinary expense (reduces profit before the 20%)? *Default: yes.*
12. **Loss months in gym:** does the manager get 0 and shareholders bear the loss 79:21, or is loss carried forward against later profit? *Needs your answer; default: carry forward within the year.*
13. **Approval thresholds:** initial values for discount %, PO amount, payment amount (QAR)? *Default: discount 10%, PO 20,000, payment 10,000, credit notes always approve, expenses 5,000 — all editable.*
14. **Opening position:** Do you have trial balances/opening stock/receivables as of a cut-over date for each company? Which date?
15. **Gym Jan–Oct data:** please provide the spreadsheet (remove phone numbers/IDs) when we reach Phase 6; I will need the monthly revenue and expense lines.

**Technical / practical**
16. Where will this run day-to-day: one office PC (Docker Desktop on Windows/Mac), a small server, or later a cloud host? *Affects backup location advice only; nothing will be published without your say.*
17. Do users need Arabic **screens** soon, or only Arabic on printed documents? *Default: Arabic on documents only for now.*
18. Email sending: do you have an SMTP account (e.g. Office 365/Gmail) for real emails later? *Default: Mailpit fake inbox in development.*
19. Numbering format examples (e.g. `RZ-INV-2026-00001` vs `INV-00001`)? *Default: `{prefix}-{00000}` per company and document type, fiscal-year reset optional.*
20. Logos and signature images for the three companies and the document layout you like (send an example invoice if you have one).
21. Conquest: is traffic management billed as a day-rate, or is it only a cost? Are rates per metre / per day / per shift? (Affects job billing templates.) *Default: generic billable items per job; rates in price lists.*

---

## 12. Risks and how the plan addresses them

| Risk | Mitigation |
|---|---|
| Accounting errors are silent and expensive | DB-enforced balance + immutability, randomised integrity tests, accountant-review file (ASSUMPTIONS.md) |
| Scope is very large | Strict phases, each shippable; defer FIFO, bin-level stock, e-invoicing until asked |
| Tax rules change | Tax codes are data with effective dates; nothing hardcoded |
| Data loss | Daily backups with 30-day retention, restore tested in CI, full ZIP export |
| User confusion | Guided first-run, plain labels, empty states, quick actions, no jargon in UI where avoidable |
| Real personal data in demo/fixtures | Seed data is generated and fictitious; fixture scan test fails the build on ID/phone/card-like patterns |

---

## 13. Out of scope unless you ask

Payroll/WPS, e-invoicing integration with any authority, online payment gateways, customer portal, mobile native apps, deployment/hosting of any kind.

---

**Next step:** please review, answer the questions in §11 (or say "use defaults"), and approve — then I start **Phase 1**. I will not write feature code until you approve.

---

## 14. Update — Supabase decision (approved by owner; defaults accepted for all §11 questions)

- The database is a **Supabase project (`group-erp`, region ap-south-1 / Mumbai, nearest to Qatar)**. It is plain PostgreSQL 17, so all the planned triggers and constraints work unchanged.
- **SQL files in `supabase/migrations/` are the source of truth** for the schema (instead of Prisma migrations). Each file is tested on a local Postgres first, then applied to Supabase.
- **Security:** every table has Row Level Security switched on with *no public policies*, so the Supabase public API cannot read or write business data. Only our app server (private database connection) can. Company/permission checks stay in the service layer.
- **Login:** Supabase Auth (passwords hashed, sessions, optional TOTP 2FA) replaces the self-built login. Our `profiles` table mirrors the Auth user id.
- Docker Compose remains for fully-offline local use; the app points at either local Postgres or Supabase via `DATABASE_URL`.
- All §11 questions: **defaults accepted**; each will be recorded in `ASSUMPTIONS.md`.
