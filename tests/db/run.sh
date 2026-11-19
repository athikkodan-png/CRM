#!/usr/bin/env bash
# Runs the SQL guard tests against a throwaway database (needs local Postgres, see README "Developer notes").
set -e
PSQL="psql -h ${PGHOST:-/tmp} -p ${PGPORT:-5433} -U postgres"
$PSQL -qc "drop database if exists erp_guard" -c "create database erp_guard"
for f in supabase/migrations/*.sql; do $PSQL -d erp_guard -q -v ON_ERROR_STOP=1 -f "$f"; done
$PSQL -d erp_guard -f tests/db/core_guards.sql 2>&1 | grep -E "^(---|psql:.*ERROR| status|.*posted)" 
