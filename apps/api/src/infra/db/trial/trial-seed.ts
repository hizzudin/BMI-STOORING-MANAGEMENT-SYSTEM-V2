import {
  formatDocumentNumber,
  NUMBERING_CONFIG,
  NumberingConfigSchema,
  type Role,
} from '@bmi/shared';
import type pg from 'pg';
import { ScryptPasswordHasher } from '../../crypto/scrypt-password-hasher.js';

/**
 * DEC-113, DEC-130, ADR-0003: dummy data for the local trial, typed by hand (never read from the
 * artboards, ADR-0001). Never used by the app's tests as fixtures, never loaded into staging or
 * production. Each later task adds the dummy data its feature needs here.
 */

export interface TrialAccount {
  role: Role;
  name: string;
  email: string;
  password: string;
}

export class TrialAlreadySeededError extends Error {
  constructor() {
    super('This database already holds the local trial; run pnpm trial:reset to start again.');
    this.name = 'TrialAlreadySeededError';
  }
}

const PEOPLE: readonly { role: Role; name: string }[] = [
  { role: 'System_Admin', name: 'Yusuf' },
  { role: 'Planner', name: 'Sari' },
  { role: 'Supervisor', name: 'Budi S.' },
  { role: 'GM', name: 'Hendra' },
  { role: 'Access_Manager', name: 'Rina' },
  { role: 'Mechanic', name: 'Joko' },
  { role: 'Warehouse_Manager', name: 'Andi' },
  { role: 'Field_Coordinator', name: 'Agus' },
  { role: 'Driver', name: 'Dedi' },
  { role: 'Accounting', name: 'Wulan' },
];

const emailOf = (role: Role) => `${role.toLowerCase().replaceAll('_', '-')}@trial.test`;

const LAYOUT = '{"frontDrawing":"None","spareCount":0,"axles":[{"role":"Steer","tyresPerSide":1}]}';

/** One SPK per status of SM-SPK; steps and spk_approvals rows agree with the status. */
const SPKS = [
  {
    status: 'Draft',
    title: 'Tyre rotation',
    category: 'Tyre',
    priority: 'Normal',
    steps: ['Locked', 'Locked'],
  },
  {
    status: 'Pending_Approval',
    title: 'Brake pads front',
    category: 'Corrective',
    priority: 'Urgent',
    steps: ['Locked', 'Locked'],
  },
  {
    status: 'Rejected',
    title: 'Clutch replacement',
    category: 'Corrective',
    priority: 'High',
    steps: ['Locked', 'Locked'],
  },
  {
    status: 'Active',
    title: 'Oil leak at the gearbox',
    category: 'Corrective',
    priority: 'Normal',
    steps: ['Open', 'Locked'],
  },
  {
    status: 'In_Progress',
    title: 'Brake overhaul',
    category: 'Corrective',
    priority: 'High',
    steps: ['Verified', 'Open'],
  },
  {
    status: 'Pending_Verification',
    title: 'Air dryer replacement',
    category: 'Corrective',
    priority: 'Normal',
    steps: ['Verified', 'Submitted'],
  },
  {
    status: 'Pending_Amendment',
    title: 'Radiator hose burst',
    category: 'Corrective',
    priority: 'Urgent',
    steps: ['Verified', 'Open'],
  },
  {
    status: 'Completed',
    title: 'PM 20.000 km',
    category: 'PM',
    priority: 'Normal',
    steps: ['Verified', 'Verified'],
  },
  {
    status: 'Cancelled',
    title: 'Wiper blades',
    category: 'Other',
    priority: 'Low',
    steps: ['Locked', 'Locked'],
  },
] as const;

const APPROVED = new Set([
  'Active',
  'In_Progress',
  'Pending_Verification',
  'Pending_Amendment',
  'Completed',
]);

type Db = Pick<pg.ClientBase, 'query'>;

/** Seeds an empty trial database in one transaction and returns the accounts with their passwords. */
export async function seedTrial(
  db: Db,
  options: { now: Date; password: () => string },
): Promise<TrialAccount[]> {
  const { rows: existing } = await db.query(
    `SELECT 1 FROM users WHERE email LIKE '%@trial.test' LIMIT 1`,
  );
  if (existing.length > 0) throw new TrialAlreadySeededError();

  // Times as UTC text, so the session time zone never shifts them (NFR-14).
  const ago = (hours: number) => new Date(options.now.getTime() - hours * 3_600_000).toISOString();
  const hasher = new ScryptPasswordHasher();

  await db.query('BEGIN');
  // DEC-145, DEC-146: the seed writes SPKs in every status with their steps, so it uses the named
  // exception of the step freeze trigger for its own transaction only (migration 0015).
  await db.query(`SET LOCAL bmi.step_revision = 'on'`);
  try {
    await db.query(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES ('system_mode', '"Live"'::jsonb)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
    );

    const accounts: TrialAccount[] = [];
    const ids = new Map<Role, string>();
    for (const person of PEOPLE) {
      const account = { ...person, email: emailOf(person.role), password: options.password() };
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO users (name, email, password_hash, must_change_password)
         VALUES ($1, $2, $3, false) RETURNING id`,
        [account.name, account.email, await hasher.hash(account.password)],
      );
      const id = rows[0]?.id ?? '';
      ids.set(person.role, id);
      await db.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`, [id, person.role]);
      accounts.push(account);
    }
    const idOf = (role: Role) => ids.get(role) ?? null;

    // Vehicles: one powered class and one towed class; documents come with TASK-601 (DEC-122).
    const layout = async (code: string, name: string) =>
      (
        await db.query<{ id: string }>(
          `INSERT INTO chassis_layouts (code, name, definition, axle_count, tyre_count)
           VALUES ($1, $2, $3::jsonb, 1, 2) RETURNING id`,
          [code, name, LAYOUT],
        )
      ).rows[0]?.id;
    const headLayout = await layout('Trial_Tractor_4x2', 'Tractor 4x2');
    const trailerLayout = await layout('Trial_Trailer', 'Trailer 3 axles');
    const vehicleClass = async (code: string, name: string, unitKind: string, layoutId?: string) =>
      (
        await db.query<{ id: string }>(
          `INSERT INTO vehicle_classes (code, name, unit_kind, default_chassis_layout_id)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [code, name, unitKind, layoutId],
        )
      ).rows[0]?.id;
    const head = await vehicleClass('Trial_Head', 'Tractor head', 'Powered', headLayout);
    const trailer = await vehicleClass('Trial_Tail', 'Trailer tail', 'Towed', trailerLayout);
    const vehicle = async (plate: string, classId?: string, layoutId?: string, km = 0) =>
      (
        await db.query<{ id: string }>(
          `INSERT INTO vehicles (license_plate, vehicle_class_id, chassis_layout_id, current_odometer)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [plate, classId, layoutId, km],
        )
      ).rows[0]?.id;
    const fleet = [
      await vehicle('B 9012 KX', head, headLayout, 48210),
      await vehicle('B 1234 ABC', head, headLayout, 120450),
      await vehicle('B 5521 UY', head, headLayout, 87300),
      await vehicle('B 7710 TR', trailer, trailerLayout),
    ];

    // TASK-112, DEC-134: dummy vendors of three kinds for the vendor master.
    await db.query(
      `INSERT INTO vendors (code, name, vendor_type, phone, address)
       VALUES ('TRIAL_FILTER', 'PT Sumber Filter (dummy)', 'Supplier', '021-555-0101', 'Jl. Industri 12, Cikarang'),
              ('TRIAL_BENGKEL', 'Bengkel Jaya (dummy)', 'Workshop', '021-555-0122', NULL),
              ('TRIAL_VULKAN', 'Vulkanisir Jaya (dummy)', 'Retread', '021-555-0144', NULL)`,
    );

    // Step modules with their PRD codes (9.6); the registry of TASK-207 wins when it exists.
    await db.query(
      `INSERT INTO assignment_modules (code, name, ui_component, executor_roles, scope_rules, completion_section, cost_kind)
       VALUES ('Stock', 'Stock', 'StockStep', '{Warehouse_Manager}', '{}', '{}', 'Parts'),
              ('Part_Purchase', 'Part Purchase', 'PartPurchaseStep', '{Field_Coordinator}', '{}', '{}', 'Parts'),
              ('Mechanic_Action', 'Mechanic Action', 'MechanicActionStep', '{Mechanic}', '{}', '{}', 'Labor')
       ON CONFLICT (code) DO NOTHING`,
    );

    const { rows: formats } = await db.query<{ value: unknown }>(
      `SELECT setting_value AS value FROM app_settings WHERE setting_key = 'numbering_formats'`,
    );
    // The stored formats (migration 0009), or the PRD defaults when a database has none.
    const numbering = formats[0] ? NumberingConfigSchema.parse(formats[0].value) : NUMBERING_CONFIG;
    const planner = idOf('Planner');
    const supervisor = idOf('Supervisor');

    for (const [index, spk] of SPKS.entries()) {
      const createdAt = ago(72 - index * 6);
      const { rows: next } = await db.query<{ value: string }>(
        `SELECT nextval('spk_number_seq')::text AS value`,
      );
      const spkNumber = formatDocumentNumber(
        'SPK',
        BigInt(next[0]?.value ?? '0'),
        new Date(createdAt),
        numbering,
      );
      const approved = APPROVED.has(spk.status);
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO spks (spk_number, vehicle_id, title, category, request_source, description, status,
           priority, created_by, created_at, status_before_amendment, approved_by, approved_at,
           cancelled_by, cancel_reason)
         VALUES ($1, $2, $3, $4, 'Manual_Planner', $5, $6, $7, $8,
           $9::timestamptz AT TIME ZONE 'UTC', $10, $11, $12::timestamptz AT TIME ZONE 'UTC', $13, $14)
         RETURNING id`,
        [
          spkNumber,
          fleet[index % fleet.length],
          spk.title,
          spk.category,
          `${spk.title}: dummy data for the local trial.`,
          spk.status,
          spk.priority,
          planner,
          createdAt,
          spk.status === 'Pending_Amendment' ? 'In_Progress' : null,
          approved ? supervisor : null,
          approved ? ago(70 - index * 6) : null,
          spk.status === 'Cancelled' ? planner : null,
          spk.status === 'Cancelled' ? 'Raised twice by mistake.' : null,
        ],
      );
      const spkId = rows[0]?.id;

      for (const [step, status] of spk.steps.entries()) {
        const started = status !== 'Locked';
        const submitted = status === 'Submitted' || status === 'Verified';
        await db.query(
          `INSERT INTO spk_assignments (spk_id, sequence_no, module, executor_roles, verifier_role, status,
             assigned_to, opened_at, submitted_at, verified_at, verified_by)
           VALUES ($1, $2, $3, $4::role_t[], 'Planner', $5::asg_status_t, $6,
             $7::timestamptz AT TIME ZONE 'UTC', $8::timestamptz AT TIME ZONE 'UTC',
             $9::timestamptz AT TIME ZONE 'UTC', $10)`,
          [
            spkId,
            step + 1,
            step === 0 ? 'Stock' : 'Mechanic_Action',
            step === 0 ? '{Warehouse_Manager}' : '{Mechanic}',
            status,
            started ? idOf(step === 0 ? 'Warehouse_Manager' : 'Mechanic') : null,
            started ? ago(60 - index * 6) : null,
            submitted ? ago(50 - index * 6) : null,
            status === 'Verified' ? ago(45 - index * 6) : null,
            status === 'Verified' ? planner : null,
          ],
        );
      }

      const approval = async (
        stage: string,
        action: string,
        by: string | null,
        role: Role,
        hours: number,
        note: string | null = null,
      ) =>
        db.query(
          `INSERT INTO spk_approvals (spk_id, stage, action, acted_by, approver_role, acted_at, note)
           VALUES ($1, $2, $3, $4, $5, $6::timestamptz AT TIME ZONE 'UTC', $7)`,
          [spkId, stage, action, by, role, ago(hours), note],
        );
      if (spk.status !== 'Draft' && spk.status !== 'Cancelled') {
        await approval('Creation', 'Submit', planner, 'Planner', 71 - index * 6);
      }
      if (spk.status === 'Rejected') {
        await approval(
          'Creation',
          'Reject',
          supervisor,
          'Supervisor',
          70 - index * 6,
          'Combine with the PM 20.000 km job to save a second workshop day.',
        );
      }
      if (approved) await approval('Creation', 'Approve', supervisor, 'Supervisor', 70 - index * 6);
      if (spk.status === 'Completed') {
        await approval('Completion', 'Request_Completion', planner, 'Planner', 40 - index * 6);
        await approval('Completion', 'Approve', idOf('GM'), 'GM', 39 - index * 6);
      }
    }

    await db.query('COMMIT');
    return accounts;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}
