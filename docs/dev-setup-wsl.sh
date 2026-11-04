#!/usr/bin/env bash
# Installs the local services of design.md D-01 in WSL Ubuntu 24.04. Safe to run again.
# From Windows: wsl -d Ubuntu-24.04 -u root -- bash "/mnt/d/project/BMI Stooring System v2/docs/dev-setup-wsl.sh"
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get install -y -qq postgresql-16 redis-server

PG_CONF=/etc/postgresql/16/main/postgresql.conf
# NFR-14: everything is stored in UTC; WIB is applied when shown.
sed -i "s/^#\?timezone = .*/timezone = 'UTC'/; s/^#\?log_timezone = .*/log_timezone = 'UTC'/" "$PG_CONF"
# Reachable from Windows through WSL localhost forwarding.
sed -i "s/^#\?listen_addresses = .*/listen_addresses = '*'/" "$PG_CONF"
HBA=/etc/postgresql/16/main/pg_hba.conf
grep -q "bmi local dev" "$HBA" || cat >> "$HBA" <<'EOF'
# bmi local dev: Windows reaches WSL through its private network only
host all bmi 172.16.0.0/12 scram-sha-256
host all bmi 192.168.0.0/16 scram-sha-256
EOF

# BullMQ needs noeviction, which keeps queued jobs from being evicted.
sed -i "s/^#\? *maxmemory-policy .*/maxmemory-policy noeviction/" /etc/redis/redis.conf

systemctl enable postgresql redis-server
systemctl restart postgresql redis-server

# Local development role only; it can create the test databases of design.md D-02. Never used outside this machine.
su postgres -c "psql -v ON_ERROR_STOP=1 -tc \"SELECT 1 FROM pg_roles WHERE rolname='bmi'\"" | grep -q 1 \
  || su postgres -c "psql -v ON_ERROR_STOP=1 -c \"CREATE ROLE bmi LOGIN CREATEDB PASSWORD 'bmi_local_dev'\""
su postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='bmi_dev'\"" | grep -q 1 \
  || su postgres -c "createdb -O bmi bmi_dev"

echo "--- versions"
su postgres -c "psql -tc 'select version()'"
su postgres -c "psql -tc 'show timezone'"
redis-cli ping
redis-cli config get maxmemory-policy | tail -1
