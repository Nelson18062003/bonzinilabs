# Banc d'essai local des propositions (Postgres 16, jetable)

Rejoue les politiques et gardes **telles qu'écrites dans le dépôt**, sur un
schéma minimal, puis applique la proposition et rejoue les attaques.
Aucune connexion à la production.

```bash
D=/tmp/pgv; PGB=/usr/lib/postgresql/16/bin; mkdir -p $D && chmod 777 $D
runuser -u postgres -- $PGB/initdb -D $D/data -U postgres --auth=trust -E UTF8 >/dev/null
runuser -u postgres -- $PGB/pg_ctl -D $D/data -o "-p 5499 -k $D -c listen_addresses=''" -l $D/server.log start
P="psql -h $D -p 5499 -U postgres"
$P -q -f harness_payments.sql && $P -f attack.sql            # AVANT : tout passe (la faille)
$P -q -f rpc_stub.sql
awk '/^begin;/,/^commit;/' ../2026-09-14-payments-ecritures-directes.sql | $P -q
$P -f attack.sql                                              # APRÈS : A1, A2, B1, C2 refusés ; A3, C1 passent
$P -q -f harness_guards.sql && $P -At -f guards_test.sql      # F-033 et F-025 : D1, D2, E1 refusés ; D3, E2, E3 passent
runuser -u postgres -- $PGB/pg_ctl -D $D/data stop
```

Résultat du 14 sept. 2026 : conforme sur les 11 scénarios.
