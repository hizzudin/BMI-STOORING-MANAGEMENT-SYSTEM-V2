// One outline icon set in one stroke weight (ui.md 7.5 Icon, DEC-82). Drawn for this app; never copied from the artboards.
const PATHS = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  spk: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  breakdown: 'M12 3l9 16H3zM12 10v4M12 17v.5',
  schedule: 'M5 5h14v15H5zM5 9h14M9 3v4M15 3v4',
  approvals: 'M5 12l4 4 10-10',
  inventory: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  vehicles: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.1M17 19a2 2 0 1 0 0-.1',
  documents: 'M6 3h9l4 4v14H6zM9 12h7M9 16h7',
  invoices: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  customers:
    'M8 11a3 3 0 1 0 0-.1M3 20c0-3 2.5-5 5-5s5 2 5 5M16 11a3 3 0 1 0 0-.1M14 15c3 0 6 2 6 5',
  reports: 'M5 20V10M11 20V4M17 20v-7',
  settings:
    'M12 9a3 3 0 1 0 0 .1M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  users: 'M9 11a4 4 0 1 0 0-.1M2 21c0-4 3-7 7-7s7 3 7 7M17 7a3 3 0 0 1 0 6M22 21c0-3-2-5-4-6',
  audit: 'M12 8v5l3 2M12 3a9 9 0 1 0 .1 0',
  setup: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
  expand: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6M9 12h11',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  wrench: 'M15 4a5 5 0 0 0-5 7L4 17l3 3 6-6a5 5 0 0 0 7-5l-3 3-3-1-1-3z',
  tyre: 'M12 3a9 9 0 1 0 .1 0M12 8a4 4 0 1 0 .1 0',
  clock: 'M12 3a9 9 0 1 0 .1 0M12 7v5l3 2',
  alert: 'M12 3l9 16H3zM12 9v5M12 17v.5',
  route: 'M6 19a2 2 0 1 0 0-.1M18 7a2 2 0 1 0 0-.1M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7',
  cart: 'M3 4h2l2 11h11l2-8H6M9 20a1 1 0 1 0 0-.1M17 20a1 1 0 1 0 0-.1',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
