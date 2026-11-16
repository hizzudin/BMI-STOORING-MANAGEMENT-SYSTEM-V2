// DEC-130: `pnpm trial` builds, prepares the local bmi_trial database and runs the API and the web
// app together; `pnpm trial:reset` only rebuilds the database. No dependency beyond Node and pnpm.
import { spawn, spawnSync } from 'node:child_process';

const reset = process.argv.includes('--reset');
const shell = process.platform === 'win32';
const trialUrl =
  process.env.TRIAL_DATABASE_URL ?? 'postgres://bmi:bmi_local_dev@localhost:5432/bmi_trial';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('Building the shared package and the API...');
run('pnpm', ['--filter', '@bmi/shared', 'build']);
run('pnpm', ['--filter', '@bmi/api', 'build']);
run('node', ['apps/api/dist/infra/db/trial/trial-cli.js', ...(reset ? ['--reset'] : [])]);
if (reset) process.exit(0);

const children = [];
let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill();
  setTimeout(() => process.exit(0), 500);
}

function start(label, command, args, env) {
  const child = spawn(command, args, { shell, env: { ...process.env, ...env } });
  const prefix = (chunk) =>
    chunk
      .toString()
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => `[${label}] ${line}`)
      .join('\n');
  child.stdout.on('data', (chunk) => console.log(prefix(chunk)));
  child.stderr.on('data', (chunk) => console.error(prefix(chunk)));
  child.on('exit', (code) => {
    console.log(`[${label}] stopped (${code ?? 'signal'})`);
    stopAll();
  });
  children.push(child);
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

start('api', 'node', ['apps/api/dist/main.js'], { DATABASE_URL: trialUrl });
start('web', 'pnpm', ['--filter', '@bmi/web', 'dev'], {});
console.log('\nLocal trial: open http://localhost:3000 (accounts in .data/trial-accounts.md).');
console.log('Press Ctrl+C to stop the API and the web app.\n');
