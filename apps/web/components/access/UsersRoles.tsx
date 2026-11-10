'use client';

import {
  ASSIGNABLE_ROLES,
  formatDateTimeWib,
  type Account,
  type AccountListResponse,
  type AccountStatus,
  type AccountUpdateRequest,
  type Role,
} from '@bmi/shared';
import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import type { AccountsApi } from '../../lib/accounts-api';
import type { Outcome } from '../../lib/auth-api';
import { Button } from '../kit/Button';
import { ConfirmDialog } from '../kit/ConfirmDialog';
import { DataTable, type Column } from '../kit/DataTable';
import { Icon } from '../kit/Icon';
import { StatusPill, type Tone } from '../kit/StatusPill';
import { PageHead } from '../shell/AppShell';

type RowAction = 'unlock' | 'reset_password' | 'deactivate' | 'activate';

export const roleLabel = (role: Role | null) => (role ? role.replaceAll('_', ' ') : 'No role');
const TONE: Record<AccountStatus, Tone> = {
  Active: 'success',
  Locked: 'danger',
  Inactive: 'neutral',
};

const COLUMNS: Column<Account>[] = [
  { key: 'name', label: 'Name', value: (a) => a.name, searchable: true },
  { key: 'email', label: 'Email', value: (a) => a.email, searchable: true },
  { key: 'role', label: 'Role', value: (a) => roleLabel(a.role) },
  {
    key: 'status',
    label: 'Status',
    value: (a) => a.status,
    render: (a) => <StatusPill tone={TONE[a.status]}>{a.status}</StatusPill>,
  },
  {
    key: 'lastSignIn',
    label: 'Last sign-in',
    value: (a) =>
      a.lastSignInAt ? formatDateTimeWib(new Date(a.lastSignInAt)).slice(0, 16) : 'Never',
  },
];

/** REQ-IAM-003: the tabs of Users and roles; each opens its own page of the area. */
function AccessTabs() {
  return (
    <nav className="tabs" aria-label="Users and roles">
      <a className="tab on" href="/users" aria-current="page">
        Accounts
      </a>
      <a className="tab" href="/users/roles">
        Roles and permissions
      </a>
      <a className="tab" href="/users/history">
        Access history
      </a>
    </nav>
  );
}

type Panel =
  | { kind: 'none' }
  | { kind: 'new' }
  | { kind: 'account'; account: Account }
  | { kind: 'password'; account: Account; temporaryPassword: string }
  | { kind: 'move' };

type Confirm =
  | { kind: 'none' }
  | { kind: 'deactivate'; account: Account }
  | { kind: 'move'; to: Account; reason: string };

/** UsersRoles and AMAccountForm (REQ-IAM-002 to REQ-IAM-004, DEC-116). */
export function UsersRoles({ api }: { api: AccountsApi }) {
  const [page, setPage] = useState<AccountListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  const [confirm, setConfirm] = useState<Confirm>({ kind: 'none' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const outcome = await api.list();
    if (outcome.ok) setPage(outcome.data);
    else setLoadError(outcome.message);
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const close = () => {
    setPanel({ kind: 'none' });
    setError(null);
  };

  /** C-34: one request at a time; a refusal is one sentence and keeps the panel as typed. */
  const run = async <T,>(work: () => Promise<Outcome<T>>, done: (data: T) => void) => {
    setBusy(true);
    setError(null);
    const outcome = await work();
    setBusy(false);
    if (!outcome.ok) return setError(outcome.message);
    done(outcome.data);
    await load();
  };

  const showAccount = (data: { account: Account }) =>
    setPanel({ kind: 'account', account: data.account });
  const showPassword = (data: { account: Account; temporaryPassword: string }) =>
    setPanel({ kind: 'password', ...data });

  if (loadError) {
    return (
      <>
        <PageHead title="Users and roles" />
        <p className="refusal" role="alert">
          {loadError}
        </p>
      </>
    );
  }
  if (!page) return <PageHead title="Users and roles" />;

  const systemAdmin = page.accounts.find((a) => a.role === 'System_Admin') ?? null;
  const pageActions = new Set(page.allowedActions);
  const selected = panel.kind === 'account' ? String(panel.account.id) : undefined;

  const onAction = (account: Account, action: RowAction) => {
    if (action === 'deactivate') return setConfirm({ kind: 'deactivate', account });
    if (action === 'reset_password') return run(() => api.resetPassword(account.id), showPassword);
    const send = action === 'unlock' ? api.unlock : api.activate;
    return run(() => send(account.id), showAccount);
  };

  return (
    <>
      <PageHead
        title="Users and roles"
        actions={
          <>
            {pageActions.has('move_system_admin') && (
              <Button onClick={() => setPanel({ kind: 'move' })}>Move System Admin role</Button>
            )}
            {pageActions.has('create') && (
              <Button variant="primary" onClick={() => setPanel({ kind: 'new' })}>
                <Icon name="plus" size={16} />
                New account
              </Button>
            )}
          </>
        }
      />
      <AccessTabs />
      <DataTable
        rows={page.accounts}
        columns={COLUMNS}
        rowKey={(a) => String(a.id)}
        selectedKey={selected}
        onSelect={(account) => {
          setError(null);
          setPanel({ kind: 'account', account });
        }}
      />

      {panel.kind === 'new' && (
        <AccountPanel
          account={null}
          busy={busy}
          error={error}
          onClose={close}
          onSave={({ role, ...rest }) =>
            // The new-account form never offers System Admin (BR-14); the server refuses it anyway.
            role === 'System_Admin'
              ? setError('System Admin is given only with Move System Admin role.')
              : run(() => api.create({ ...rest, role }), showPassword)
          }
          onAction={onAction}
        />
      )}

      {panel.kind === 'account' && (
        <AccountPanel
          account={panel.account}
          busy={busy}
          error={error}
          onClose={close}
          onSave={(request) => run(() => api.update(panel.account.id, request), showAccount)}
          onAction={onAction}
        />
      )}

      {panel.kind === 'password' && (
        <TemporaryPasswordPanel
          account={panel.account}
          temporaryPassword={panel.temporaryPassword}
          onClose={close}
        />
      )}

      {panel.kind === 'move' && (
        <MovePanel
          accounts={page.accounts.filter(
            (a) => a.status !== 'Inactive' && a.role !== 'System_Admin',
          )}
          holder={systemAdmin}
          error={error}
          onClose={close}
          onMove={(to, reason) => setConfirm({ kind: 'move', to, reason })}
        />
      )}

      {confirm.kind === 'deactivate' && (
        <ConfirmDialog
          title={`Deactivate ${confirm.account.name}?`}
          body={`${confirm.account.name} can no longer sign in, and every open session ends.`}
          confirmLabel="Deactivate"
          cancelLabel="Cancel"
          onCancel={() => setConfirm({ kind: 'none' })}
          onConfirm={() => {
            const { account } = confirm;
            setConfirm({ kind: 'none' });
            void run(() => api.deactivate(account.id), showAccount);
          }}
        />
      )}

      {confirm.kind === 'move' && (
        <ConfirmDialog
          title={`Move the System Admin role to ${confirm.to.name}?`}
          body={`${confirm.to.name} becomes System Admin${
            systemAdmin ? ` and ${systemAdmin.name} keeps no role until you give one` : ''
          }. The move is written to the audit log.`}
          confirmLabel="Move role"
          cancelLabel="Cancel"
          onCancel={() => setConfirm({ kind: 'none' })}
          onConfirm={() => {
            const { to, reason } = confirm;
            setConfirm({ kind: 'none' });
            void run(() => api.moveSystemAdmin(to.id, reason), close);
          }}
        />
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}

function Refusal({ message }: { message: string | null }) {
  return message ? (
    <p className="refusal" role="alert">
      {message}
    </p>
  ) : null;
}

function Panel({
  label,
  onClose,
  onSubmit,
  children,
}: {
  label: string;
  onClose: () => void;
  onSubmit?: (event: FormEvent) => void;
  children: ReactNode;
}) {
  return (
    <div
      className="overlay right"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.(event);
        }}
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
      >
        {children}
      </form>
    </div>
  );
}

/** AMAccountForm: name, email, exactly one role; the buttons follow the account's allowedActions. */
function AccountPanel({
  account,
  busy,
  error,
  onClose,
  onSave,
  onAction,
}: {
  account: Account | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (request: AccountUpdateRequest) => void;
  onAction: (account: Account, action: RowAction) => void;
}) {
  const [name, setName] = useState(account?.name ?? '');
  const [email, setEmail] = useState(account?.email ?? '');
  const [role, setRole] = useState<string>(account?.role ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const allowed = new Set<string>(account ? account.allowedActions : ['edit']);
  const holdsSystemAdmin = account?.role === 'System_Admin';

  useEffect(() => {
    setName(account?.name ?? '');
    setEmail(account?.email ?? '');
    setRole(account?.role ?? '');
    setProblem(null);
  }, [account]);

  const save = () => {
    if (!name.trim() || !email.trim()) return setProblem('Enter a name and an email address.');
    if (!role) return setProblem('Choose one role.');
    setProblem(null);
    onSave({ name: name.trim(), email: email.trim(), role: role as Role });
  };

  return (
    <Panel label={account ? account.name : 'New account'} onClose={onClose} onSubmit={save}>
      <Field label="Name">
        {(id) => (
          <input
            id={id}
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </Field>
      <Field label="Email">
        {(id) => (
          <input
            id={id}
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </Field>
      <Field label="Role">
        {(id) => (
          <select
            id={id}
            className="input"
            value={role}
            disabled={holdsSystemAdmin}
            onChange={(event) => setRole(event.target.value)}
          >
            {(!account || account.role === null) && (
              <option value="">{account ? 'No role' : 'Choose a role'}</option>
            )}
            {holdsSystemAdmin && <option value="System_Admin">System Admin</option>}
            {ASSIGNABLE_ROLES.map((option) => (
              <option key={option} value={option}>
                {roleLabel(option)}
              </option>
            ))}
          </select>
        )}
      </Field>
      {holdsSystemAdmin && (
        <p className="small muted">
          The System Admin role changes only with Move System Admin role.
        </p>
      )}
      <Refusal message={problem ?? error} />
      <div className="bar">
        {account && allowed.has('deactivate') && (
          <Button variant="danger" disabled={busy} onClick={() => onAction(account, 'deactivate')}>
            Deactivate
          </Button>
        )}
        {account && allowed.has('activate') && (
          <Button disabled={busy} onClick={() => onAction(account, 'activate')}>
            Activate
          </Button>
        )}
        <span className="grow" />
        {account && allowed.has('unlock') && (
          <Button disabled={busy} onClick={() => onAction(account, 'unlock')}>
            Unlock
          </Button>
        )}
        {account && allowed.has('reset_password') && (
          <Button disabled={busy} onClick={() => onAction(account, 'reset_password')}>
            Reset password
          </Button>
        )}
        {allowed.has('edit') && (
          <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>
            Save
          </Button>
        )}
      </div>
    </Panel>
  );
}

/** REQ-IAM-009: shown once; the server never shows it again. */
function TemporaryPasswordPanel({
  account,
  temporaryPassword,
  onClose,
}: {
  account: Account;
  temporaryPassword: string;
  onClose: () => void;
}) {
  return (
    <Panel label={account.name} onClose={onClose} onSubmit={onClose}>
      <h3>{account.name}</h3>
      <div className="note" role="status">
        <Icon name="lock" size={18} />
        <div>
          Temporary password: <b className="temp-password">{temporaryPassword}</b>
          <br />
          Give it to {account.name} now; it is shown only once and is changed at the first sign-in.
        </div>
      </div>
      <div className="bar">
        <Button type="submit" variant="primary">
          Done
        </Button>
      </div>
    </Panel>
  );
}

/** FLW-AM-03: another active account and a reason, then a confirmation (REQ-IAM-004, DEC-116). */
function MovePanel({
  accounts,
  holder,
  error,
  onClose,
  onMove,
}: {
  accounts: Account[];
  holder: Account | null;
  error: string | null;
  onClose: () => void;
  onMove: (to: Account, reason: string) => void;
}) {
  const [toId, setToId] = useState('');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const submit = () => {
    const to = accounts.find((a) => String(a.id) === toId);
    if (!to) return setProblem('Choose the account that becomes System Admin.');
    if (!reason.trim()) return setProblem('Give a reason.');
    setProblem(null);
    onMove(to, reason.trim());
  };

  return (
    <Panel label="Move System Admin role" onClose={onClose} onSubmit={submit}>
      <h3>Move System Admin role</h3>
      <p className="small muted">
        Now held by {holder ? holder.name : 'no account'}. Exactly one account holds System Admin.
      </p>
      <Field label="New System Admin">
        {(id) => (
          <select
            id={id}
            className="input"
            value={toId}
            onChange={(event) => setToId(event.target.value)}
          >
            <option value="">Choose an active account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({roleLabel(a.role)})
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Reason">
        {(id) => (
          <textarea
            id={id}
            className="input"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        )}
      </Field>
      <Refusal message={problem ?? error} />
      <div className="bar">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">
          Move role
        </Button>
      </div>
    </Panel>
  );
}
