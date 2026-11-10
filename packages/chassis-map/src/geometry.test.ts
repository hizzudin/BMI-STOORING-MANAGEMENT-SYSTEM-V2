import { generatePositions, type ChassisDefinition } from '@bmi/shared';
import { describe, expect, it } from 'vitest';
import { LAUNCH_LAYOUTS, generatedLayouts } from './fixtures.js';
import { AXLE_GAP, chassisGeometry, type TyreShape } from './geometry.js';

const every = [
  ...Object.entries(LAUNCH_LAYOUTS).map(([name, definition]) => ({ name, definition })),
  ...generatedLayouts(),
];

/** The box a tyre takes on the map. */
function box(shape: TyreShape) {
  return shape.kind === 'Wheel'
    ? { left: shape.x, top: shape.y, right: shape.x + shape.width, bottom: shape.y + shape.height }
    : {
        left: shape.cx - shape.r,
        top: shape.cy - shape.r,
        right: shape.cx + shape.r,
        bottom: shape.cy + shape.r,
      };
}

/** The item at an index; a missing one fails the test instead of passing silently. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no item at ${index}`);
  return item;
}

const overlaps = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe('chassis map layout geometry (REQ-PLC-008, DEC-73, DEC-119)', () => {
  it('DEC-73 covers the six launch layouts and 108 generated ones (1 to 6 axles, every role, single or dual, 0 to 2 spares)', () => {
    expect(Object.keys(LAUNCH_LAYOUTS)).toEqual(
      expect.arrayContaining([
        'tractor-head',
        'trailer-tail-2-axles',
        'trailer-tail-3-axles',
        'wingbox-rigid',
        'pickup-patrol-hilux',
        'van',
      ]),
    );
    expect(generatedLayouts()).toHaveLength(3 * 2 * 6 * 3);
  });

  it('REQ-PLC-008 every layout draws exactly one shape per generated position, in order', () => {
    for (const { name, definition } of every) {
      const drawn = chassisGeometry(definition).tyres.map((t) => t.code);
      expect(drawn, name).toEqual(generatePositions(definition).map((p) => p.code));
    }
  });

  it('REQ-PLC-008 no two tyres overlap, and every tyre lies inside the drawing', () => {
    for (const { name, definition } of every) {
      const map = chassisGeometry(definition);
      const boxes = map.tyres.map(box);
      boxes.forEach((a, i) => {
        expect(a.left, name).toBeGreaterThanOrEqual(0);
        expect(a.right, name).toBeLessThanOrEqual(map.width);
        expect(a.top, name).toBeGreaterThan(24);
        expect(a.bottom, name).toBeLessThan(map.height);
        boxes.slice(i + 1).forEach((b) => expect(overlaps(a, b), name).toBe(false));
      });
    }
  });

  it('DEC-119 a Close axle sits 66 below the one before, a Wide one 150', () => {
    const ys = chassisGeometry(LAUNCH_LAYOUTS['tractor-head'] as ChassisDefinition).axles.map(
      (a) => a.y,
    );
    expect([at(ys, 1) - at(ys, 0), at(ys, 2) - at(ys, 1)]).toEqual([AXLE_GAP.Wide, AXLE_GAP.Close]);
  });

  it('REQ-PLC-017 the front drawing: a kingpin for a trailer, a fifth wheel over the drive axles of a head, else a bumper', () => {
    const trailer = chassisGeometry(LAUNCH_LAYOUTS['trailer-tail-3-axles'] as ChassisDefinition);
    expect(trailer.front.kind).toBe('Kingpin');
    expect(trailer.fifthWheel).toBeNull();
    const head = chassisGeometry(LAUNCH_LAYOUTS['tractor-head'] as ChassisDefinition);
    expect(head.front.kind).toBe('Bumper');
    const drives = head.axles.filter((a) => a.role === 'Drive').map((a) => a.y);
    expect(head.fifthWheel?.cy).toBe((at(drives, 0) + at(drives, 1)) / 2);
    const rigid = chassisGeometry(LAUNCH_LAYOUTS['wingbox-rigid'] as ChassisDefinition);
    expect(rigid.front.kind).toBe('Bumper');
    expect(rigid.fifthWheel).toBeNull();
  });

  it('AC-PLC-009 REQ-PLC-019 a layout with 0 spares draws no spare slot; spares sit in the first gap they fit', () => {
    const rigid = chassisGeometry(LAUNCH_LAYOUTS['wingbox-rigid'] as ChassisDefinition);
    expect(rigid.tyres.filter((t) => t.kind === 'Spare')).toEqual([]);
    const head = chassisGeometry(LAUNCH_LAYOUTS['tractor-head'] as ChassisDefinition);
    const spare = head.tyres.find((t) => t.kind === 'Spare');
    expect(spare).toMatchObject({
      code: 'SP1',
      cx: 150,
      cy: (at(head.axles, 0).y + at(head.axles, 1).y) / 2,
    });
  });

  it('REQ-PLC-019 spares that fit in no gap go behind the last axle, three to a row', () => {
    const map = chassisGeometry({
      frontDrawing: 'None',
      spareCount: 4,
      axles: [{ role: 'Steer', tyresPerSide: 1 }],
    });
    const spares = map.tyres.filter((t) => t.kind === 'Spare');
    expect(spares).toHaveLength(4);
    const lastAxle = at(map.axles, 0).y;
    for (const spare of spares) expect(spare.kind === 'Spare' && spare.cy > lastAxle).toBe(true);
    expect(new Set(spares.map((s) => (s.kind === 'Spare' ? s.cy : 0))).size).toBe(2);
  });

  it('a fifth wheel on a head without drive axles sits over the axles behind the first', () => {
    const map = chassisGeometry({
      frontDrawing: 'Fifth_wheel',
      spareCount: 0,
      axles: [
        { role: 'Steer', tyresPerSide: 1 },
        { role: 'Trailer', tyresPerSide: 2, spacing: 'Wide' },
      ],
    });
    expect(map.fifthWheel?.cy).toBe(at(map.axles, 1).y);
    const single = chassisGeometry({
      frontDrawing: 'Fifth_wheel',
      spareCount: 0,
      axles: [{ role: 'Steer', tyresPerSide: 1 }],
    });
    expect(single.fifthWheel?.cy).toBe(at(single.axles, 0).y);
  });
});
