import { describe, expect, it } from 'vitest';
import { classLockOf, VEHICLE_MESSAGES } from './vehicle-service.js';

describe('REQ-VEH-003 REQ-VEH-004 DEC-17 the vehicle refusals', () => {
  it('names what locks the class: mounted tyres, open SPKs, both or nothing', () => {
    expect(classLockOf({ mountedTyres: 0, openSpks: [] })).toBeNull();
    expect(classLockOf({ mountedTyres: 1, openSpks: [] })).toBe(
      'Class is locked: 1 tyre is mounted.',
    );
    expect(classLockOf({ mountedTyres: 0, openSpks: ['SPK-1', 'SPK-2', 'SPK-3'] })).toBe(
      'Class is locked: SPK-1, SPK-2 and SPK-3 are open.',
    );
    expect(classLockOf({ mountedTyres: 10, openSpks: ['SPK-2611040139'] })).toBe(
      'Class is locked: 10 tyres are mounted and SPK-2611040139 is open.',
    );
  });

  it('a deactivation names the open SPKs', () => {
    expect(VEHICLE_MESSAGES.openSpk(['SPK-1'])).toBe(
      'SPK-1 is open: close it before deactivating the vehicle.',
    );
    expect(VEHICLE_MESSAGES.openSpk(['SPK-1', 'SPK-2'])).toBe(
      'SPK-1 and SPK-2 are open: close them before deactivating the vehicle.',
    );
  });
});
