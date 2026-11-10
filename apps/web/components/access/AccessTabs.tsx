const TABS = [
  { key: 'accounts', label: 'Accounts', href: '/users' },
  { key: 'roles', label: 'Roles and permissions', href: '/users/roles' },
  { key: 'history', label: 'Access history', href: '/users/history' },
] as const;

export type AccessTab = (typeof TABS)[number]['key'];

/** REQ-IAM-003: the tabs of Users and roles; each opens its own page of the area. */
export function AccessTabs({ current }: { current: AccessTab }) {
  return (
    <nav className="tabs" aria-label="Users and roles">
      {TABS.map((tab) => (
        <a
          key={tab.key}
          className={tab.key === current ? 'tab on' : 'tab'}
          href={tab.href}
          aria-current={tab.key === current ? 'page' : undefined}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
