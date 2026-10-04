#!/usr/bin/env bash
# ============================================================================
# Rejoue une migration et ses tests de sécurité sur un PostgreSQL local jetable.
#
#   supabase/tests/run.sh                      # toutes les suites *.test.sql
#   supabase/tests/run.sh customs_foundation   # une suite
#
# Il faut un serveur PostgreSQL ≥ 15 joignable par psql (PGHOST, PGPORT,
# PGUSER : un superutilisateur). Chaque suite part d'une base neuve :
# stub_supabase.sql, puis ses migrations (listées dans MIGRATIONS ci-dessous,
# appliquées DEUX fois pour prouver l'idempotence), puis le fichier de test.
# ============================================================================
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"
cd "$(dirname "$0")/../.."

CUSTOMS="supabase/migrations/20260929120000_customs_foundation.sql supabase/migrations/20260929130000_customs_audit_workflow.sql supabase/migrations/20260930090000_customs_notices.sql supabase/migrations/20260930120000_customs_supplier_invites.sql"
CARGO_DOSSIER="supabase/migrations/20261003140000_cargo_document_folders.sql supabase/migrations/20261003150000_cargo_parties.sql supabase/migrations/20261003170000_cargo_packages_mixed.sql supabase/migrations/20261003180000_cargo_voyage_manual.sql supabase/migrations/20261004090000_cargo_steps.sql"
declare -A MIGRATIONS=(
  [customs_foundation]="$CUSTOMS"
  [customs_audit_workflow]="$CUSTOMS"
  [customs_notices]="$CUSTOMS"
  [customs_supplier_invites]="$CUSTOMS"
  [logistics_observed_transit]="supabase/tests/stub_cargo.sql supabase/migrations/20260930150000_logistics_observed_transit.sql"
  [cargo_dossier]="supabase/tests/stub_cargo.sql supabase/tests/stub_cargo_dossier.sql $CARGO_DOSSIER"
)

suites=("$@")
[ ${#suites[@]} -eq 0 ] && suites=("${!MIGRATIONS[@]}")

for suite in "${suites[@]}"; do
  db="bz_test_${suite}"
  psql -q -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS ${db};" -c "CREATE DATABASE ${db};" >/dev/null
  psql -q -v ON_ERROR_STOP=1 -d "$db" -f supabase/tests/stub_supabase.sql >/dev/null
  for m in ${MIGRATIONS[$suite]}; do
    psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$m" >/dev/null
    psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$m" >/dev/null   # idempotence
  done
  psql -q -v ON_ERROR_STOP=1 -o /dev/null -d "$db" -f "supabase/tests/${suite}.test.sql"
  psql -q -d postgres -c "DROP DATABASE IF EXISTS ${db};" >/dev/null
done
