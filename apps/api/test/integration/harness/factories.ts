export interface Factory<T> {
  build(overrides?: Partial<T>): T;
}

// Every test builds its own data; the sequence keeps unique columns unique within a file.
export function defineFactory<T>(defaults: (sequence: number) => T): Factory<T> {
  let sequence = 0;
  return {
    build(overrides = {}) {
      sequence += 1;
      return { ...defaults(sequence), ...overrides };
    },
  };
}
