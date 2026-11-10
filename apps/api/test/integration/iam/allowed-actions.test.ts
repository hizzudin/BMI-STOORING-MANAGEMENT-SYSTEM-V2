import {
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Role } from '@bmi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { CLOCK, EMAIL, PASSWORD_HASHER, PG_POOL } from '../../../src/app.tokens.js';
import {
  allowedActions,
  assertAllowed,
  inState,
  notOwnWork,
  onlyOwner,
  withinScope,
  type Policies,
} from '../../../src/core/iam/actions.js';
import {
  actorOf,
  CurrentSession,
  SessionGuard,
  type SignedIn,
} from '../../../src/http/auth/auth-http.js';
import { ScryptPasswordHasher } from '../../../src/infra/crypto/scrypt-password-hasher.js';
import { findContractBreaks, type ContractCase } from '../harness/allowed-actions-contract.js';
import { testPool } from '../harness/database.js';
import { seedRolePermissions } from '../harness/role-permissions.js';
import { FakeClock } from '../harness/fake-clock.js';
import { FakeEmail, insertAccount, postJson } from './auth-harness.js';

// A record type for the contract only, shaped like an SPK: the real ones arrive with their tasks.
interface Order {
  id: number;
  status: 'Draft' | 'Pending_Approval' | 'Approved';
  createdBy: number;
  vehicleId: number;
}
const ACTIONS = ['submit', 'approve', 'cancel', 'issue_part'] as const;
type OrderAction = (typeof ACTIONS)[number];

const policies: Policies<Order, OrderAction> = {
  submit: {
    anyOf: ['spk.create'],
    rules: [
      inState((o) => o.status, ['Draft'], 'Only a draft can be submitted.'),
      onlyOwner((o) => o.createdBy, 'Only its creator can submit this draft.'),
    ],
  },
  approve: {
    anyOf: ['spk.approve'],
    rules: [
      inState((o) => o.status, ['Pending_Approval'], 'This SPK is not waiting for approval.'),
      notOwnWork((o) => o.createdBy, 'You cannot approve an SPK you created.'),
    ],
  },
  cancel: {
    anyOf: ['spk.cancel'],
    rules: [
      inState(
        (o) => o.status,
        ['Draft', 'Pending_Approval'],
        'An approved SPK is not cancelled here.',
      ),
    ],
  },
  issue_part: {
    anyOf: ['stock.issue'],
    rules: [
      inState((o) => o.status, ['Approved'], 'Parts are issued only for an approved SPK.'),
      withinScope(
        (o, input) => (input as { vehicleId?: number }).vehicleId === o.vehicleId,
        'This part is for another vehicle than the SPK names.',
      ),
    ],
  },
};

const orders = new Map<number, Order>();

@Controller('probe-orders')
@UseGuards(SessionGuard)
class ProbeOrdersController {
  @Get(':id')
  read(@Param('id') id: string, @CurrentSession() session: SignedIn) {
    const order = this.find(id);
    return { ...order, allowedActions: allowedActions(policies, actorOf(session), order) };
  }

  // A dry run: the same check a real action makes, without changing the record.
  @Post(':id/:action')
  @HttpCode(200)
  act(
    @Param('id') id: string,
    @Param('action') action: OrderAction,
    @Body() body: { vehicleId?: number },
    @CurrentSession() session: SignedIn,
  ) {
    const order = this.find(id);
    assertAllowed(policies, actorOf(session), order, action, body);
    return { ok: true };
  }

  private find(id: string): Order {
    const order = orders.get(Number(id));
    if (!order) throw new NotFoundException();
    return order;
  }
}

@Module({ imports: [AppModule], controllers: [ProbeOrdersController] })
class ProbeModule {}

const ROLES: Role[] = [
  'Planner',
  'Mechanic',
  'Warehouse_Manager',
  'Supervisor',
  'GM',
  'System_Admin',
  'Accounting',
];
const clock = FakeClock.atWib('2026-11-10 08:00');
let app: INestApplication;
let baseUrl: string;
const tokens = new Map<string, string>();
const ids = new Map<string, number>();

async function setting(key: string, value: unknown): Promise<void> {
  await testPool().query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2::jsonb)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
    [key, JSON.stringify(value)],
  );
}

async function account(key: string, role: Role): Promise<void> {
  const created = await insertAccount({ role });
  const response = await postJson(baseUrl, '/auth/sign-in', {
    email: created.email,
    password: created.password,
    client: 'mobile',
  });
  tokens.set(key, ((await response.json()) as { accessToken: string }).accessToken);
  ids.set(key, created.id);
}

const headers = (who: string) => ({
  authorization: `Bearer ${tokens.get(who)}`,
  'content-type': 'application/json',
});

async function listed(who: string, orderId: number): Promise<OrderAction[]> {
  const response = await fetch(`${baseUrl}/probe-orders/${orderId}`, { headers: headers(who) });
  return ((await response.json()) as { allowedActions: OrderAction[] }).allowedActions;
}

async function send(
  who: string,
  orderId: number,
  action: OrderAction,
  vehicleId = 7,
): Promise<number> {
  const response = await fetch(`${baseUrl}/probe-orders/${orderId}/${action}`, {
    method: 'POST',
    headers: headers(who),
    body: JSON.stringify({ vehicleId }),
  });
  return response.status;
}

const contractCase = (who: string, orderId: number, what: string): ContractCase<OrderAction> => ({
  label: `${who} on ${what}`,
  listed: () => listed(who, orderId),
  send: (action) => send(who, orderId, action),
});

beforeAll(async () => {
  await seedRolePermissions();
  await setting('system_mode', 'Live');
  const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] })
    .overrideProvider(PG_POOL)
    .useValue(testPool())
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(EMAIL)
    .useValue(new FakeEmail())
    .overrideProvider(PASSWORD_HASHER)
    .useValue(new ScryptPasswordHasher(2 ** 12))
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  baseUrl = await app.getUrl();
  for (const role of ROLES) await account(role, role);
  await account('Planner (creator)', 'Planner');
  const creator = ids.get('Planner (creator)') ?? 0;
  orders.set(1, { id: 1, status: 'Draft', createdBy: creator, vehicleId: 7 });
  orders.set(2, { id: 2, status: 'Pending_Approval', createdBy: creator, vehicleId: 7 });
  orders.set(3, { id: 3, status: 'Approved', createdBy: creator, vehicleId: 7 });
  orders.set(4, {
    id: 4,
    status: 'Pending_Approval',
    createdBy: ids.get('System_Admin') ?? 0,
    vehicleId: 7,
  });
});

afterAll(async () => {
  await app.close();
});

describe('allowedActions contract', () => {
  it('REQ-IAM-014 for every role and every state, the list equals what the server accepts', async () => {
    const cases = [...ROLES, 'Planner (creator)'].flatMap((who) => [
      contractCase(who, 1, 'a Draft'),
      contractCase(who, 2, 'a Pending_Approval SPK'),
      contractCase(who, 3, 'an Approved SPK'),
    ]);
    expect(await findContractBreaks(ACTIONS, cases)).toEqual([]);
  });

  it('REQ-IAM-014 the lists are the ones the matrix and the state give', async () => {
    expect(await listed('Planner (creator)', 1)).toEqual(['submit']);
    expect(await listed('Planner', 1)).toEqual([]);
    expect(await listed('Supervisor', 2)).toEqual(['approve', 'cancel']);
    expect(await listed('GM', 2)).toEqual(['approve', 'cancel']);
    expect(await listed('Warehouse_Manager', 3)).toEqual(['issue_part']);
    expect(await listed('Accounting', 2)).toEqual([]);
    expect(await listed('Mechanic', 3)).toEqual([]);
  });

  it("AC-IAM-010 BR-03 with Planner approval on, a Planner approves another Planner's SPK but never its own", async () => {
    await setting('planner_approval_kinds', ['spk_creation']);
    expect(await listed('Planner', 2)).toEqual(['approve']);
    expect(await listed('Planner (creator)', 2)).toEqual([]);
    expect(await send('Planner (creator)', 2, 'approve')).toBe(403);
    expect(
      await findContractBreaks(ACTIONS, [
        contractCase('Planner', 2, "another Planner's Pending SPK, switch on"),
        contractCase('Planner (creator)', 2, 'its own Pending SPK, switch on'),
      ]),
    ).toEqual([]);
    await setting('planner_approval_kinds', []);
    expect(await listed('Planner', 2)).toEqual([]);
  });

  it('BR-03 the System Admin may approve the SPK it created', async () => {
    expect(await listed('System_Admin', 4)).toContain('approve');
    expect(await send('System_Admin', 4, 'approve')).toBe(200);
  });

  it('BR-02 a listed action is still refused when its payload leaves the scope of the SPK', async () => {
    expect(await send('Warehouse_Manager', 3, 'issue_part', 7)).toBe(200);
    const response = await fetch(`${baseUrl}/probe-orders/3/issue_part`, {
      method: 'POST',
      headers: headers('Warehouse_Manager'),
      body: JSON.stringify({ vehicleId: 8 }),
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { message: string }).message).toBe(
      'This part is for another vehicle than the SPK names.',
    );
  });

  it('REQ-IAM-006 a refused action says why in one sentence', async () => {
    const response = await fetch(`${baseUrl}/probe-orders/2/approve`, {
      method: 'POST',
      headers: headers('Accounting'),
      body: '{}',
    });
    expect(response.status).toBe(403);
    expect(((await response.json()) as { message: string }).message).toBe(
      'You do not have permission to do this.',
    );
  });
});
