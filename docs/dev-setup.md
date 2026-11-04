# Local development setup

The local services are PostgreSQL 16 and Redis inside WSL Ubuntu 24.04, with no Docker (design.md D-01). The API, web app and tests run on Windows and reach the services on `localhost`.

## First time

1. The distro lives on D: (`D:\wsl\Ubuntu-24.04`). Move a fresh one with `wsl --shutdown`, then `wsl --manage Ubuntu-24.04 --move D:\wsl\Ubuntu-24.04`.
2. Install the services; the script is safe to run again. Run it from PowerShell, because Git Bash rewrites `/mnt/...` paths:

   ```powershell
   wsl -d Ubuntu-24.04 -u root -- bash "/mnt/d/project/BMI Stooring System v2/docs/dev-setup-wsl.sh"
   ```

3. Keep browsers off the small C: drive: `PLAYWRIGHT_BROWSERS_PATH=D:\ms-playwright` (user environment variable).

## Every working session: keep WSL alive

WSL stops as soon as no process is attached, and every later start takes about a minute before PostgreSQL accepts connections. Leave this running in a terminal while you work:

```powershell
wsl -d Ubuntu-24.04 -u root -- sleep infinity
```

If tests report `ECONNREFUSED` on 5432 or 6379, this is the first thing to check. `wsl: Failed to start the systemd user session` is printed at every start and is harmless here: PostgreSQL and Redis are system services.

## Connection values

| Service | Value |
| --- | --- |
| PostgreSQL | `postgres://bmi:bmi_local_dev@localhost:5432/bmi_dev` |
| Redis | `redis://localhost:6379` |

The `bmi` role and its password exist only on this machine: it is a local development role, bound to the private WSL network, and it may create the test databases of design.md D-02. Staging and production credentials live only in Secret Manager.

The server time zone is UTC (NFR-14) and Redis uses `maxmemory-policy noeviction`, which BullMQ needs.

## Checking the services

```powershell
wsl -d Ubuntu-24.04 -u root -- env PGPASSWORD=bmi_local_dev psql -h localhost -U bmi -d bmi_dev -Atc "select version()" -c "show timezone"
wsl -d Ubuntu-24.04 -u root -- redis-cli ping
```

## Viewing the design artifact

`node specs/tools/serve-artifact.mjs` serves `Design Artifact/` on port 4173.
