'use client';

import { useState, type ReactNode } from 'react';

export interface TabItem {
  key: string;
  label: string;
  count?: number;
  content: ReactNode;
}

/** C-06, NAV-2: a tab changes the content of the same page; it never opens a new page. */
export function Tabs({ tabs, initial }: { tabs: TabItem[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.key);
  const current = tabs.find((tab) => tab.key === active) ?? tabs[0];
  return (
    <div>
      <div className="tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === current?.key}
            className={tab.key === current?.key ? 'tab on' : 'tab'}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
            {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current?.content}</div>
    </div>
  );
}
