#!/usr/bin/env bash
# Recreates the throwaway local test database from the migration files.
set -e
PSQL="psql -h ${PGHOST:-/tmp} -p ${PGPORT:-5433} -U postgres"
$PSQL -qc "drop database if exists erp_test" -c "create database erp_test"
for f in supabase/migrations/*.sql; do $PSQL -d erp_test -q -v ON_ERROR_STOP=1 -f "$f"; done
