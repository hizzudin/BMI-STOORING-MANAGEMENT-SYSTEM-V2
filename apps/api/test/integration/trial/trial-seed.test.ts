import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ROLES, SPK_STATUSES, type SpkResponse } from '@bmi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { PG_POOL, PLANNER_APPROVAL_END } from '../../../src/app.tokens.js';
import {
  seedTrial,
  TrialAlreadySeededError,
  type TrialAccount,
} from '../../../src/infra/db/trial/trial-seed.js';
import {
  TRIAL_TARGET_MESSAGE,
  trialDatabaseUrl,
} from '../../../src/infra/db/trial/trial-target.js';
import type { PlannerApprovalEndScheduler } from '../../../src/ports/planner-approval.js';
import { testPool } from '../harness/database.js';
import { seedRolePermissions } from '../harness/role-permissions.js';
import { postJson } from '../iam/auth-harness.js';

// TASK-131: the local trial seed (DEC-113, DEC-130, ADR-0003). It runs here against the test
// database only; the trial itself uses bmi_trial, which tests never touch.

class NoScheduler implements PlannerApprovalEndScheduler {
  scheduleEnd(): Promise<void> {
    return Promise.resolve();
  }
}

let app: INestApplication;
let baseUrl: string;
let accounts: TrialAccount[] = [];

const account = (role: string) => {
  const found = accounts.find((item) => item.role === role);
  if (!found) throw new Error(`no trial ${role}`);
  return found;
};

async function signIn(role: string): Promise<{ status: number; token: string }> {
  const { email, password } = account(role);
  const response = await postJson(baseUrl, '/auth/sign-in', { email, password, client: 'mobile' });
  const body = (await response.json()) as { accessToken?: string };
  return { status: response.status, token: body.accessToken ?? '' };
}

beforeAll(async () => {
  // The harness empties role_permissions; a migrated trial database holds the default matrix.
  await seedRolePermissions();
  const client = await testPool().connect();
  try {
    accounts = await seedTrial(client, {
      now: new Date('2026-11-16T01:00:00Z'),
      password: () => `Trial${Math.random().toString(36).slice(2, 10)}7`,
    });
  } finally {
    client.release();
  }
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PG_POOL)
    .useValue(testPool())
    .overrideProvider(PLANNER_APPROVAL_END)
    .useValue(new NoScheduler())
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  baseUrl = await app.getUrl();
});

afterAll(async () => {
  await app.close();
});

describe('DEC-130 the trial runs only on a local bmi_trial database', () => {
  it('DEC-130 localhost and 127.0.0.1 with bmi_trial are accepted; the default is local', () => {
    expect(trialDatabaseUrl({})).toBe('postgres://bmi:bmi_local_dev@localhost:5432/bmi_trial');
    expect(
      trialDatabaseUrl({ TRIAL_DATABASE_URL: 'postgres://u:p@127.0.0.1:5433/bmi_trial' }),
    ).toBe('postgres://u:p@127.0.0.1:5433/bmi_trial');
  });

  it('ADR-0003 another host, bmi_dev or any other database is refused', () => {
    for (const url of [
      'postgres://u:p@db.example.com:5432/bmi_trial',
      'postgres://u:p@10.0.0.5:5432/bmi_trial',
      'postgres://u:p@localhost:5432/bmi_dev',
      'postgres://u:p@localhost:5432/postgres',
    ]) {
      expect(() => trialDatabaseUrl({ TRIAL_DATABASE_URL: url })).toThrow(TRIAL_TARGET_MESSAGE);
    }
  });
});

describe('DEC-113 DEC-130 the trial seed', () => {
  it('DEC-113 one account per role, each signs in with the password the seed made', async () => {
    expect(accounts.map((item) => item.role).sort()).toEqual([...ROLES].sort());
    for (const item of accounts) {
      expect(item.email).toMatch(/@trial\.test$/);
      expect((await signIn(item.role)).status).toBe(200);
    }
    const { rows } = await testPool().query<{ role: string }>(
      `SELECT r.role FROM users u JOIN user_roles r ON r.user_id = u.id WHERE u.email = $1`,
      [account('Supervisor').email],
    );
    expect(rows).toEqual([{ role: 'Supervisor' }]);
  });

  it('DEC-130 one SPK per status, numbered SPK-yymmddNNNN, with steps and approval rows that agree', async () => {
    const { rows } = await testPool().query<{
      status: string;
      spk_number: string;
      steps: string[];
      actions: string[] | null;
      cancel_reason: string | null;
      status_before_amendment: string | null;
    }>(
      `SELECT s.status, s.spk_number, s.cancel_reason, s.status_before_amendment,
         (SELECT array_agg(a.status::text ORDER BY a.sequence_no) FROM spk_assignments a WHERE a.spk_id = s.id) AS steps,
         (SELECT array_agg(p.action::text ORDER BY p.acted_at, p.id) FROM spk_approvals p WHERE p.spk_id = s.id) AS actions
       FROM spks s JOIN users u ON u.id = s.created_by
       WHERE u.email = $1`,
      [account('Planner').email],
    );
    const byStatus = new Map(rows.map((row) => [row.status, row]));
    expect([...byStatus.keys()].sort()).toEqual([...SPK_STATUSES].sort());
    for (const row of rows) expect(row.spk_number).toMatch(/^SPK-\d{10}$/);

    const steps = (status: string) => byStatus.get(status)?.steps;
    const actions = (status: string) => byStatus.get(status)?.actions ?? [];
    expect(steps('Draft')).toEqual(['Locked', 'Locked']);
    expect(actions('Draft')).toEqual([]);
    expect(actions('Pending_Approval')).toEqual(['Submit']);
    expect(actions('Rejected')).toEqual(['Submit', 'Reject']);
    expect(steps('Active')).toEqual(['Open', 'Locked']);
    expect(actions('Active')).toEqual(['Submit', 'Approve']);
    expect(steps('In_Progress')).toEqual(['Verified', 'Open']);
    expect(steps('Pending_Verification')).toEqual(['Verified', 'Submitted']);
    expect(byStatus.get('Pending_Amendment')?.status_before_amendment).toBe('In_Progress');
    expect(steps('Completed')).toEqual(['Verified', 'Verified']);
    expect(actions('Completed')).toEqual(['Submit', 'Approve', 'Request_Completion', 'Approve']);
    expect(byStatus.get('Cancelled')?.cancel_reason).toBeTruthy();
  });

  it('DEC-130 Verify: the Planner submits the seeded draft, a Supervisor approves it', async () => {
    const planner = await signIn('Planner');
    const { rows } = await testPool().query<{ id: string }>(
      `SELECT s.id FROM spks s JOIN users u ON u.id = s.created_by
       WHERE u.email = $1 AND s.status = 'Draft'`,
      [account('Planner').email],
    );
    const spkId = Number(rows[0]?.id);
    const auth = (token: string) => ({ authorization: `Bearer ${token}` });
    const one = await fetch(`${baseUrl}/spks/${spkId}`, { headers: auth(planner.token) });
    const body = (await one.json()) as SpkResponse & { message?: string };
    expect(`${one.status} ${body.message ?? ''}`).toBe('200 ');
    const { spk } = body;
    const submitted = await fetch(`${baseUrl}/spks/${spkId}/submit`, {
      method: 'POST',
      headers: { ...auth(planner.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: spk.version }),
    });
    expect(submitted.status).toBe(200);
    const supervisor = await signIn('Supervisor');
    const approved = await fetch(`${baseUrl}/approvals/spk/${spkId}/approve`, {
      method: 'POST',
      headers: {
        ...auth(supervisor.token),
        'Content-Type': 'application/json',
        'Idempotency-Key': `trial-${spkId}`,
      },
      body: JSON.stringify({ version: ((await submitted.json()) as SpkResponse).spk.version }),
    });
    expect(approved.status).toBe(200);
  });

  it('DEC-130 a database that already holds the trial is not seeded twice', async () => {
    const client = await testPool().connect();
    try {
      await expect(
        seedTrial(client, { now: new Date(), password: () => 'Trial2nd7' }),
      ).rejects.toBeInstanceOf(TrialAlreadySeededError);
    } finally {
      client.release();
    }
  });
});
