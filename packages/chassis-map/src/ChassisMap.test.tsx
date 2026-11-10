import type { ChassisDefinition } from '@bmi/shared';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChassisMap } from './ChassisMap.js';
import { LAUNCH_LAYOUTS } from './fixtures.js';

afterEach(cleanup);

const head = LAUNCH_LAYOUTS['tractor-head'] as ChassisDefinition;

describe('ChassisMap layout component (REQ-PLC-008, REQ-PLC-010, DEC-119)', () => {
  it('REQ-PLC-010 read only: an image whose tyres carry code, label and status in their title', () => {
    render(<ChassisMap definition={head} statuses={{ A2_LO: 'ActNow', SP1: 'Normal' }} />);
    const map = screen.getByRole('img', { name: 'Chassis map, 3 axles' });
    expect(within(map).queryAllByRole('button')).toEqual([]);
    const titles = [...map.querySelectorAll('g.m-tyre > title')].map((t) => t.textContent);
    expect(titles).toContain('A2_LO, Axle 2 left outer, Act now');
    expect(titles).toContain('SP1, Spare 1, Normal');
    // A position without a status is Empty.
    expect(titles).toContain('A1_L, Axle 1 left, Empty');
    expect(map.querySelectorAll('g.m-tyre')).toHaveLength(11);
  });

  it('REQ-PLC-008 DEC-119 the guide under the map tells what each colour means', () => {
    render(<ChassisMap definition={head} />);
    const guide = screen.getByRole('list', { name: 'Tyre colours' });
    expect(
      within(guide)
        .getAllByRole('listitem')
        .map((i) => i.textContent),
    ).toEqual([
      'NormalFitted and within its life',
      'Due soonNear its replacement limit',
      'Act nowAt or past its limit: replace or check it',
      'EmptyNo tyre fitted',
      'MissingNo baseline recorded for this position',
    ]);
    const swatches = guide.querySelectorAll('.chassis-swatch');
    expect([...swatches].map((s) => s.className)).toEqual([
      'chassis-swatch t-ok',
      'chassis-swatch t-due',
      'chassis-swatch t-act',
      'chassis-swatch t-empty',
      'chassis-swatch t-miss',
    ]);
  });

  it('DEC-119 a tyre holds only its shape and its code: no "?", tread marks or hub ring', () => {
    render(
      <ChassisMap
        definition={head}
        statuses={{ A3_LI: 'Missing', SP1: 'Missing' }}
        guide={false}
      />,
    );
    expect(document.querySelectorAll('g.t-miss')).toHaveLength(2);
    for (const tyre of document.querySelectorAll('g.m-tyre')) {
      const parts = [...tyre.children].map((c) => c.tagName.toLowerCase());
      expect(parts.sort()).toEqual(
        [tyre.querySelector('rect') ? 'rect' : 'circle', 'text', 'title'].sort(),
      );
      expect(tyre.querySelector('text')?.textContent).toBe(tyre.getAttribute('data-code'));
    }
    expect(document.body.textContent).not.toContain('?');
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('REQ-PLC-010 in the step each position is a button: click, Enter and Space choose it', () => {
    const onSelect = vi.fn();
    render(
      <ChassisMap
        definition={head}
        statuses={{ A2_RO: 'Normal' }}
        selected="A2_RO"
        onSelect={onSelect}
        title="Chassis map, B 9012 KX"
      />,
    );
    const map = screen.getByRole('group', { name: 'Chassis map, B 9012 KX' });
    const selected = within(map).getByRole('button', { name: 'A2_RO, Axle 2 right outer, Normal' });
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(selected.getAttribute('class')).toContain('t-sel');
    fireEvent.click(within(map).getByRole('button', { name: /^A1_L,/ }));
    fireEvent.keyDown(within(map).getByRole('button', { name: /^SP1,/ }), { key: 'Enter' });
    fireEvent.keyDown(within(map).getByRole('button', { name: /^A3_LO,/ }), { key: ' ' });
    fireEvent.keyDown(within(map).getByRole('button', { name: /^A3_RO,/ }), { key: 'Tab' });
    expect(onSelect.mock.calls).toEqual([['A1_L'], ['SP1'], ['A3_LO']]);
  });

  it('REQ-PLC-017 a trailer shows its kingpin, a head its fifth wheel; one axle reads "1 axle"', () => {
    const { unmount } = render(
      <ChassisMap definition={LAUNCH_LAYOUTS['trailer-tail-2-axles'] as ChassisDefinition} />,
    );
    expect(document.querySelector('.m-pin title')?.textContent).toBe('Kingpin');
    unmount();
    render(<ChassisMap definition={head} />);
    expect(document.querySelector('.m-fifth title')?.textContent).toBe('Fifth wheel');
    cleanup();
    render(
      <ChassisMap
        definition={{
          frontDrawing: 'None',
          spareCount: 0,
          axles: [{ role: 'Steer', tyresPerSide: 1 }],
        }}
      />,
    );
    expect(screen.getByRole('img', { name: 'Chassis map, 1 axle' })).toBeTruthy();
  });
});
