/** NFR-03: a save used a version that is no longer current. HTTP maps it to 409. */
export class ConcurrentUpdateError extends Error {
  constructor() {
    super('Someone else saved this record first. Reload it and try again.');
    this.name = 'ConcurrentUpdateError';
  }
}
