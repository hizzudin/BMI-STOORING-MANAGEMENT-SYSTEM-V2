import { Icon, type IconName } from '../kit/Icon';
import { PageHead } from '../shell/AppShell';

interface SettingsItem {
  label: string;
  href: string;
  icon: IconName;
}

// 7.2 Settings and NAV-6: three groups of cards, each opening its own page; Users and roles is not here.
const GROUPS: { title: string; items: SettingsItem[] }[] = [
  {
    title: 'Surat Perintah Kerja',
    items: [
      { label: 'SPK presets', href: '/settings/spk-presets', icon: 'spk' },
      { label: 'PM packages', href: '/settings/pm-packages', icon: 'schedule' },
      { label: 'Alert rules', href: '/settings/alert-rules', icon: 'bell' },
      { label: 'Service catalog', href: '/settings/service-catalog', icon: 'wrench' },
    ],
  },
  {
    title: 'Fleet and maintenance',
    items: [
      { label: 'Classes and chassis layouts', href: '/settings/chassis-layouts', icon: 'vehicles' },
      { label: 'Document types', href: '/settings/document-types', icon: 'documents' },
      { label: 'Tyre statuses', href: '/settings/tyre-statuses', icon: 'tyre' },
      { label: 'Part item types', href: '/settings/part-item-types', icon: 'clock' },
    ],
  },
  {
    title: 'Alerts and system',
    items: [
      { label: 'Alert thresholds', href: '/settings/alert-thresholds', icon: 'alert' },
      { label: 'Stooring rates', href: '/settings/stooring-rates', icon: 'route' },
      { label: 'Vendors', href: '/settings/vendors', icon: 'cart' },
      { label: 'Invoices and tax', href: '/settings/billing', icon: 'invoices' },
    ],
  },
];

export function SettingsHome() {
  return (
    <>
      <PageHead title="Settings" />
      {GROUPS.map((group) => (
        <section key={group.title}>
          <h2 className="group-title">{group.title}</h2>
          <div className="grid g4">
            {group.items.map((item) => (
              <a key={item.href} className="card card-link" href={item.href}>
                <span className="circle-ic">
                  <Icon name={item.icon} />
                </span>
                <b>{item.label}</b>
              </a>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
