#!/bin/sh
# Postgres refuses a key it doesn't own, so copy the mounted cert with the right owner before starting
set -e
install -d -o postgres -m 700 /var/lib/postgresql/ssl
install -o postgres -m 600 /certs/server.key /var/lib/postgresql/ssl/server.key
install -o postgres -m 644 /certs/server.crt /var/lib/postgresql/ssl/server.crt
exec docker-entrypoint.sh postgres \
  -c ssl=on \
  -c ssl_cert_file=/var/lib/postgresql/ssl/server.crt \
  -c ssl_key_file=/var/lib/postgresql/ssl/server.key \
  -c hba_file=/etc/tierbase/pg_hba.conf
