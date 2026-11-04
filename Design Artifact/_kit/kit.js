/* BMI Stooring System — artboard kit (DEC-93, DEC-94).
   Renders the floating circle rail, the review strip (role + states) and icons.
   Page config on <body>:
     data-nav="spk"                                       active rail item
     data-roles="Mechanic:start,submit|Planner:verify,return"     roles that reach this module and their allowedActions
   A control with data-act="verify" hides when the chosen role's allowedActions lacks "verify";
   an element with data-role-only="Planner|System Admin" shows only for those roles. */
(function () {
  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="3.5"/><rect x="14" y="3" width="7" height="7" rx="3.5"/><rect x="3" y="14" width="7" height="7" rx="3.5"/><rect x="14" y="14" width="7" height="7" rx="3.5"/>',
    spk: '<rect x="5" y="4" width="14" height="17" rx="3"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
    requests: '<path d="M4 13l2.5-7h11L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 13h4l1.5 2h5L16 13h4"/>',
    schedule: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    approvals: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    inventory: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
    vehicles: '<path d="M2 16V7a1 1 0 0 1 1-1h11v10M14 9h4l3 4v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    documents: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    invoices: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    customers: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c2.8 0 5 2.2 5 5"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    users: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><circle cx="12" cy="10" r="2.5"/><path d="M8 16c.8-1.5 2.3-2.5 4-2.5s3.2 1 4 2.5"/>',
    audit: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    setup: '<path d="M12 2v10"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M19 12H5M11 6l-6 6 6 6"/>', chev: '<path d="m9 6 6 6-6 6"/>',
    bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    camera: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="4"/>', pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    tyre: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    cart: '<path d="M3 4h2l2.4 11h11L21 7H6"/><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/>',
    route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
    check: '<path d="m5 12 5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    pause: '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>', play: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>', logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>', filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>', download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
    swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>', doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    box: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
    stamp: '<path d="M9 3h6l-1 7h4v4H6v-4h4zM5 18h14v3H5z"/>', phone: '<rect x="7" y="2" width="10" height="20" rx="3"/><path d="M11 18h2"/>',
    expand: '<path d="m9 6 6 6-6 6"/>', lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 18 4-6"/>', home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>', print: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>'
  };
  const svg = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.more}</svg>`;
  window.BMI = { svg };

  // Menu table of PRD 2.4: [key, label, page, codes that show it, demo count]
  const NAV = [
    ['dashboard', 'Dashboard', 'dashboard/Dashboard.html', ['dashboard.view']],
    ['spk', 'Surat Perintah Kerja', 'spk/SPKList.html', ['spk.view'], 3],
    ['requests', 'Requests', 'spk/Requests.html', ['request.view'], 2],
    ['schedule', 'Schedule', 'schedule/Schedule.html', ['schedule.view', 'schedule.manage']],
    ['approvals', 'Approvals', 'approvals/Approvals.html', ['spk.approve', 'count.approve'], 4],
    ['inventory', 'Inventory', 'inventory/Inventory.html', ['inventory.manage', 'tyre.manage']],
    ['vehicles', 'Vehicles', 'fleet/Vehicles.html', ['vehicle.view', 'vehicle.manage']],
    ['documents', 'Documents', 'documents/Documents.html', ['vehicle.view', 'vehicle.manage']],
    ['invoices', 'Invoices', 'billing/Invoices.html', ['invoice.view', 'invoice.manage']],
    ['customers', 'Customers', 'billing/Customers.html', ['invoice.view', 'invoice.manage']],
    ['reports', 'Reports', 'reports/Reports.html', ['report.view']],
    ['settings', 'Settings', 'settings/Settings.html', ['registry.manage', 'parttype.manage', 'masterdata.manage', 'settings.manage']],
    ['users', 'Users and roles', 'access/UsersRoles.html', ['accounts.manage']],
    ['audit', 'Audit log', 'access/AuditLog.html', ['audit.view']],
    ['setup', 'Setup and go live', 'setup/SetupGoLive.html', ['setup.golive']]
  ];
  const ICON = { 'spk': 'spk' };
  // Default effective capabilities per role (PRD 2.2), enough to draw the menu
  const base = ['dashboard.view', 'spk.view', 'vehicle.view'];
  const CAPS = {
    'Planner': [...base, 'request.view', 'schedule.manage', 'registry.manage', 'parttype.manage'],
    'Mechanic': [...base, 'schedule.view'],
    'Warehouse Manager': [...base, 'inventory.manage', 'tyre.manage', 'schedule.view'],
    'Supervisor': [...base, 'spk.approve', 'count.approve', 'schedule.view', 'invoice.manage', 'report.view'],
    'GM': [...base, 'spk.approve', 'count.approve', 'schedule.view', 'invoice.view', 'report.view', 'audit.view'],
    'System Admin': [...base, 'request.view', 'schedule.manage', 'spk.approve', 'count.approve', 'inventory.manage', 'tyre.manage', 'invoice.manage', 'report.view', 'registry.manage', 'masterdata.manage', 'settings.manage', 'audit.view', 'setup.golive'],
    'Access Manager': ['accounts.manage', 'audit.view'],
    'Field Coordinator': [...base, 'request.view', 'schedule.view'],
    'Accounting': ['dashboard.view', 'vehicle.view', 'invoice.manage', 'report.view'],
    'Driver': ['dashboard.view', 'field.report']
  };
  const initials = (r) => r.split(' ').map((w) => w[0]).join('').slice(0, 2);
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* preview without storage */ } }
  };

  // Set before first paint so the rail and main screen do not animate on load.
  const html = document.documentElement;
  if (store.get('bmi.wide') === '1') html.classList.add('wide');

  // Review mode (?review, or ?review=0 to leave it) shows the design-review strip: role switch,
  // allowedActions and state labels. Outside it the artboard shows only product UI, as the first role.
  const q = new URLSearchParams(location.search);
  if (q.has('review')) store.set('bmi.review', q.get('review') === '0' ? '0' : '1');
  const review = store.get('bmi.review') === '1';
  if (review) html.classList.add('review');

  document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    const root = body.dataset.root || '../';

    const roles = (body.dataset.roles || '').split('|').filter(Boolean).map((s) => {
      const [name, acts] = s.split(':');
      return { name: name.trim(), acts: (acts || '').split(',').map((a) => a.trim()).filter(Boolean) };
    });
    let role = (review && roles.find((r) => r.name === store.get('bmi.role'))) || roles[0] || { name: 'System Admin', acts: [] };

    // floating circle rail
    if (body.dataset.nav !== 'none') {
      const rail = document.createElement('aside');
      rail.className = 'rail';
      rail.innerHTML = `<a class="logo" href="${root}index.html" title="BMI Stooring System"><img src="${root}_kit/bmi-logo.png" alt="BMI"><span class="brand">BMI Stooring<small>System</small></span></a><nav aria-label="Main"></nav>
        <button class="grow" type="button" aria-label="Expand menu" title="Expand menu">${svg('expand')}</button><span class="me"></span>`;
      body.prepend(rail);
      rail.querySelector('.grow').addEventListener('click', () => {
        html.classList.toggle('wide');
        store.set('bmi.wide', html.classList.contains('wide') ? '1' : '0');
      });
      body._drawNav = () => {
        const caps = CAPS[role.name] || CAPS['System Admin'];
        rail.querySelector('nav').innerHTML = NAV.filter((n) => n[3].some((c) => caps.includes(c))).map((n) =>
          `<a href="${root}${n[2]}" class="${n[0] === body.dataset.nav ? 'on' : ''}" data-tip="${n[1]}" aria-label="${n[1]}">${svg(ICON[n[0]] || n[0])}<span>${n[1]}</span>${n[4] ? `<b>${n[4]}</b>` : ''}</a>`).join('');
        const me = rail.querySelector('.me');
        me.textContent = initials(role.name);
        me.title = role.name;
      };
    } else {
      body.classList.add('bare');
    }

    document.querySelectorAll('i[data-i]').forEach((el) => { el.outerHTML = svg(el.dataset.i); });

    // review strip: who reaches this module, and its states
    const stage = document.querySelector('.stage');
    const strip = document.createElement('div');
    strip.className = 'kit';
    const variants = [...document.querySelectorAll('.variant[id]')];
    strip.innerHTML =
      (roles.length ? `<span class="grp"><b>Viewed as</b>${roles.map((r) => `<button type="button" data-role="${r.name}">${r.name}</button>`).join('')}</span><code class="acts"></code>` : '') +
      (variants.length > 1 ? `<span class="grp"><b>States</b>${variants.map((v) => `<a href="#${v.id}">${v.dataset.label || v.id}</a>`).join('')}</span>` : '');
    if (review && stage && strip.innerHTML) stage.prepend(strip);
    if (review) variants.forEach((v) => {
      const l = document.createElement('div');
      l.className = 'vlabel';
      l.innerHTML = `<code>#${v.id}</code><span>${v.dataset.label || ''}</span>${v.dataset.note ? `<span>· ${v.dataset.note}</span>` : ''}`;
      v.prepend(l);
    });

    const apply = () => {
      strip.querySelectorAll('[data-role]').forEach((b) => b.classList.toggle('on', b.dataset.role === role.name));
      const acts = strip.querySelector('.acts');
      if (acts) acts.textContent = 'allowedActions: [' + role.acts.join(', ') + ']';
      document.querySelectorAll('[data-act]').forEach((el) => {
        el.classList.toggle('off', !el.dataset.act.split(' ').some((a) => role.acts.includes(a)));
      });
      document.querySelectorAll('[data-role-only]').forEach((el) => el.classList.toggle('off', !el.dataset.roleOnly.split('|').includes(role.name)));
      // A state whose only content belongs to other roles is hidden with its label.
      variants.forEach((v) => {
        const own = [...v.querySelectorAll('[data-role-only]')];
        v.classList.toggle('off', own.length > 0 && own.every((el) => el.classList.contains('off')));
      });
      if (body._drawNav) body._drawNav();
      // Schedule cards drag only for a role whose allowedActions include "move" (REQ-SCH-002).
      const canMove = role.acts.includes('move');
      body.classList.toggle('drag-on', canMove);
      document.querySelectorAll('.spkcard').forEach((c) => { c.draggable = canMove; });
    };

    // A tab that points at a state on this page lights up when that state is shown.
    const syncTabs = () => {
      const hit = document.querySelector(`.tabs a[href="${location.hash}"]`);
      if (!hit) return;
      hit.parentElement.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a === hit));
    };
    window.addEventListener('hashchange', syncTabs);
    syncTabs();

    // Drag an SPK card between "Not on the schedule" and the days of the week.
    let dragged = null;
    document.addEventListener('dragstart', (e) => {
      dragged = e.target.closest && e.target.closest('.spkcard');
      if (!dragged) return;
      dragged.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragged.dataset.card || '');
    });
    document.addEventListener('dragend', () => {
      if (dragged) dragged.classList.remove('dragging');
      dragged = null;
      document.querySelectorAll('[data-drop].over').forEach((z) => z.classList.remove('over'));
    });
    document.addEventListener('dragover', (e) => {
      const zone = dragged && e.target.closest && e.target.closest('[data-drop]');
      if (!zone) return;
      e.preventDefault();
      document.querySelectorAll('[data-drop].over').forEach((z) => z !== zone && z.classList.remove('over'));
      zone.classList.add('over');
    });
    document.addEventListener('drop', (e) => {
      const zone = dragged && e.target.closest && e.target.closest('[data-drop]');
      if (!zone) return;
      e.preventDefault();
      zone.classList.remove('over');
      const hint = zone.querySelector('.drop-hint');
      zone.insertBefore(dragged, hint || null);
      // Each view (week, month) has its own tray; refresh the count of the one this drop belongs to.
      const sched = zone.closest('.sched');
      const tray = sched && sched.querySelector('.tray');
      const count = tray && tray.querySelector('[data-count]');
      if (count) count.textContent = tray.querySelectorAll('.spkcard').length;
    });
    strip.addEventListener('click', (e) => {
      const b = e.target.closest('[data-role]');
      if (!b) return;
      role = roles.find((r) => r.name === b.dataset.role);
      store.set('bmi.role', role.name);
      apply();
    });
    apply();
  });
})();
