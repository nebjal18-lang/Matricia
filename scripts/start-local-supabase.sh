#!/usr/bin/env bash
# Start the isolated development stack without touching a hosted project or resetting data.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
export COREPACK_HOME="${COREPACK_HOME:-/workspace/.cache/corepack}"
unset DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH
export DOCKER_HOST=unix:///var/run/docker.sock
docker --host=unix:///var/run/docker.sock info --format '{{.ServerVersion}}' >/dev/null
mkdir -p work
chmod 755 supabase/templates
chmod 644 supabase/templates/magic_link.html

# Preserve registry authentication and proxy destinations; add only local exceptions.
python3 - <<'PY'
import json, os, stat, tempfile
from pathlib import Path
config = Path(os.environ.get('DOCKER_CONFIG', str(Path.home() / '.docker'))) / 'config.json'
if config.exists():
    data = json.loads(config.read_text())
    hosts = ['localhost', '127.0.0.1', '::1', 'supabase_kong_Matricia', 'supabase_db_Matricia',
             'supabase_auth_Matricia', 'supabase_rest_Matricia', 'supabase_storage_Matricia', 'supabase_inbucket_Matricia']
    for proxy in data.get('proxies', {}).values():
        current = [host.strip() for host in proxy.get('noProxy', '').split(',') if host.strip()]
        proxy['noProxy'] = ','.join(current + [host for host in hosts if host not in current])
    fd, temporary = tempfile.mkstemp(dir=config.parent, prefix='.local-supabase-')
    try:
        os.fchmod(fd, stat.S_IMODE(config.stat().st_mode))
        with os.fdopen(fd, 'w') as output:
            json.dump(data, output)
        os.replace(temporary, config)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
PY

# Retain containers while correcting BusyBox's loopback health probe. Readiness is
# enforced below; the CLI's ignore flag alone must never establish success.
python3 - <<'PY_START'
import subprocess
from pathlib import Path
result = subprocess.run(['corepack', 'pnpm', 'exec', 'supabase', 'start', '--ignore-health-check',
                         '--exclude', 'realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor'],
                        capture_output=True, text=True)
# The CLI prints local keys on success. Persist only operational progress lines.
lines = (result.stdout + result.stderr).splitlines()
safe = [line for line in lines if line.startswith(('Starting ', 'Applying migration ', 'Seeding data ', 'Initialising ', 'Stopping '))]
Path('work/local-supabase-start.log').write_text('\n'.join(safe) + '\n')
if result.returncode:
    raise SystemExit('Supabase startup failed; no credentials were logged.')
PY_START

for service in auth storage; do
docker exec --user 0 -i "supabase_${service}_Matricia" sh <<'SH'
mkdir -p /usr/local/bin
cat > /usr/local/bin/wget <<'WRAPPER'
#!/bin/sh
# BusyBox ignores NO_PROXY. Only the exact loopback health probe bypasses it.
if [ "$*" = "--no-verbose --tries=1 --spider http://127.0.0.1:9999/health" ] || [ "$*" = "--no-verbose --tries=1 --spider http://127.0.0.1:5000/status" ]; then
  exec /usr/bin/wget -Y off "$@"
fi
exec /usr/bin/wget "$@"
WRAPPER
chmod 755 /usr/local/bin/wget
SH
done

healthy=false
for ((attempt = 0; attempt < 60; attempt++)); do
  healthy=true
  for service in db auth kong inbucket rest storage; do
    state="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "supabase_${service}_Matricia")"
    if [[ "$state" != healthy && "$state" != running ]]; then healthy=false; fi
  done
  if [[ "$healthy" == true ]]; then break; fi
  sleep 1
done
if [[ "$healthy" != true ]]; then
  echo 'Supabase local health checks did not pass.' >&2
  exit 1
fi
docker exec supabase_auth_Matricia wget --no-verbose --tries=1 --spider http://127.0.0.1:9999/health >/dev/null 2>&1

# A running container can retain stale Auth settings after config.toml changes.
# Check only non-secret policy values; never print the container environment.
python3 - <<'PY_AUTH'
import json, os, re, subprocess, tomllib
from pathlib import Path
config = tomllib.loads(Path('supabase/config.toml').read_text())['auth']
container = json.loads(subprocess.check_output(['docker', 'inspect', 'supabase_auth_Matricia']))[0]
actual = dict(row.split('=', 1) for row in container['Config']['Env'] if '=' in row)
expected = {
    'GOTRUE_MAILER_OTP_LENGTH': str(config['email']['otp_length']),
    'GOTRUE_MAILER_OTP_EXP': str(config['email']['otp_expiry']),
    'GOTRUE_MFA_TOTP_ENROLL_ENABLED': str(config['mfa']['totp']['enroll_enabled']).lower(),
    'GOTRUE_MFA_TOTP_VERIFY_ENABLED': str(config['mfa']['totp']['verify_enabled']).lower(),
}
if any(actual.get(key) != value for key, value in expected.items()):
    raise SystemExit('Local Auth policy differs from config.toml; stop and restart the local stack without a database reset.')
web_length = os.environ.get('AUTH_EMAIL_OTP_LENGTH')
if not web_length and Path('.env.local').exists():
    for line in Path('.env.local').read_text().splitlines():
        match = re.match(r'^\s*AUTH_EMAIL_OTP_LENGTH\s*=\s*([678])\s*$', line)
        if match:
            web_length = match.group(1)
if (web_length or '6') != expected['GOTRUE_MAILER_OTP_LENGTH']:
    raise SystemExit('AUTH_EMAIL_OTP_LENGTH must match the local Auth email policy.')
PY_AUTH

# Generate only local bindings. Never replace an existing developer configuration.
python3 - <<'PY'
import json, os, subprocess
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import build_opener, ProxyHandler, Request
path = Path('.env.local')
result = subprocess.run(['corepack', 'pnpm', 'exec', 'supabase', 'status', '-o', 'json'],
                        capture_output=True, text=True, check=True)
status = json.loads(result.stdout)
key = status.get('PUBLISHABLE_KEY') or status.get('ANON_KEY')
service_key = status.get('SERVICE_ROLE_KEY') or status.get('SECRET_KEY')
url = status.get('API_URL', '')
if urlsplit(url).hostname not in ('127.0.0.1', 'localhost') or not key or not service_key:
    raise SystemExit('Local Supabase bindings are incomplete or not loopback')
# Direct access is restricted to the verified loopback URL; external HTTPS keeps its proxy.
opener = build_opener(ProxyHandler({}))
with opener.open(url + '/auth/v1/health', timeout=10) as response:
    if response.status != 200:
        raise SystemExit('Local Auth health is unavailable')
request = Request(url + '/rest/v1/rpc/readiness_status', data=b'{}',
                  headers={'apikey': service_key, 'Authorization': 'Bearer ' + service_key,
                           'Content-Type': 'application/json'})
with opener.open(request, timeout=10) as response:
    readiness = json.load(response)
    probe = readiness[0] if isinstance(readiness, list) else readiness
    if response.status != 200 or not probe.get('database_ok') or not probe.get('outbox_ok'):
        raise SystemExit('Local database/outbox readiness failed')
if not path.exists():
    values = {'APP_ENV': 'development', 'NEXT_PUBLIC_APP_URL': 'http://localhost:5173',
              'NEXT_PUBLIC_SUPABASE_URL': url, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': key,
              'SUPABASE_SERVICE_ROLE_KEY': service_key, 'DIRECT_URL': status.get('DB_URL')}
    fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as output:
        for name, value in values.items():
            if value:
                output.write(name + '=' + value + '\n')
PY
# Only bind an unconfigured local database; never overwrite an existing target.
docker exec -i supabase_db_Matricia psql -U postgres -d postgres -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
do $$
begin
  if to_regclass('private.admin_execution_environment_v1') is not null then
    if exists(select 1 from private.admin_execution_environment_v1 where environment is not null and environment <> 'DEVELOPMENT') then
      raise exception 'LOCAL_DATABASE_ENVIRONMENT_MISMATCH';
    end if;
    update private.admin_execution_environment_v1
    set environment='DEVELOPMENT',configured_at=clock_timestamp(),configuration_reference='LOCAL_DOCKER_BOOTSTRAP'
    where singleton and environment is null;
  end if;
end $$;
SQL
echo 'Supabase local: PostgreSQL, Auth, private Storage, API and test mailbox are healthy.'
