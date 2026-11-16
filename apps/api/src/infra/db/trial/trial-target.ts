/** DEC-130, ADR-0003: the local trial runs only on a local database named bmi_trial. */
export const TRIAL_DATABASE = 'bmi_trial';
export const TRIAL_TARGET_MESSAGE =
  'The local trial runs only on a localhost or 127.0.0.1 database named bmi_trial.';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const DEFAULT_URL = `postgres://bmi:bmi_local_dev@localhost:5432/${TRIAL_DATABASE}`;

/** TRIAL_DATABASE_URL, or the local default; anything else is refused (never bmi_dev). */
export function trialDatabaseUrl(env: Record<string, string | undefined>): string {
  const url = env.TRIAL_DATABASE_URL ?? DEFAULT_URL;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(TRIAL_TARGET_MESSAGE);
  }
  if (!LOCAL_HOSTS.has(parsed.hostname) || parsed.pathname !== `/${TRIAL_DATABASE}`) {
    throw new Error(TRIAL_TARGET_MESSAGE);
  }
  return url;
}
