# Group ERP (REZINKO · CONQUEST INTERNATIONAL · OLYMPIAN FITNESS)

A CRM + ERP web app. Your data lives in your Supabase database. The app runs on your own computer; nothing is published online.

**Status:** Phase 1 in progress: login, company setup wizard, company switcher, roles/permissions, audit log, tax codes, chart of accounts, dashboard shell. Other sidebar areas show "planned for a later phase".

## Run it on your computer (first time)

1. **Install Node.js** (the "LTS" version) from https://nodejs.org. Click through the installer.
2. **Open a terminal** in this project folder (Windows: open the folder, type `cmd` in the address bar, press Enter. Mac: right-click the folder, "New Terminal at Folder").
3. Run: `npm install` (takes a minute).
4. **Connect the database.**
   - Copy the file `.env.example` to a new file called `.env.local`.
   - Open https://supabase.com/dashboard, open project **group-erp**, click **Connect** at the top, choose **Session pooler**, and copy the connection string. Replace `[YOUR-PASSWORD]` in it with your database password (Project Settings → Database → *Reset database password* if you do not know it).
   - Paste the whole string after `DATABASE_URL=` in `.env.local`. **Keep this file private. Never send it to anyone or put it in chat.**
5. **Allow instant sign-up:** in Supabase go to **Authentication → Sign In / Providers → Email** and turn **off** "Confirm email" (otherwise you must click a link in an email after creating your account).
6. Run: `npm run dev`, then open http://localhost:3000 in your browser.
7. Click **Create account** (right side), then follow the **Set up your first company** page. You become the Owner.

To stop the app press `Ctrl + C` in the terminal. To start again later just run `npm run dev`.

## Run the tests (developers)

`npm test` runs the checks against a local throwaway Postgres (see `tests/db/reset.sh`). `tests/db/run.sh` runs the accounting-guard checks (unbalanced entries refused, posted entries frozen, etc.).

## Where things are

- `supabase/migrations/` – the database structure (the source of truth). Applied to Supabase and tested locally first.
- `src/modules/` – business rules. `src/app/` – screens. `PLAN.md` – the full plan. `ASSUMPTIONS.md` – every business assumption for your accountant to review.
