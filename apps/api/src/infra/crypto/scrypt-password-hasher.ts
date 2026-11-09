import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import type { PasswordHasher } from '../../ports/iam.js';

const KEY_LENGTH = 64;
const SALT_BYTES = 16;
/** OWASP minimum for scrypt: N=2^17, r=8, p=1. */
export const PRODUCTION_COST = 2 ** 17;
const BLOCK_SIZE = 8;
const PARALLEL = 1;

function scrypt(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

const optionsFor = (cost: number, blockSize: number, parallel: number): ScryptOptions => ({
  N: cost,
  r: blockSize,
  p: parallel,
  maxmem: 256 * cost * blockSize + 1024 * 1024,
});

/** NFR-05: `scrypt$N$r$p$salt$hash`; the parameters travel with the hash so the cost can grow later. */
export class ScryptPasswordHasher implements PasswordHasher {
  constructor(private readonly cost: number = PRODUCTION_COST) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await scrypt(password, salt, optionsFor(this.cost, BLOCK_SIZE, PARALLEL));
    return [
      'scrypt',
      this.cost,
      BLOCK_SIZE,
      PARALLEL,
      salt.toString('base64'),
      key.toString('base64'),
    ].join('$');
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    const [scheme, cost, blockSize, parallel, salt, key] = passwordHash.split('$');
    if (scheme !== 'scrypt' || !salt || !key) {
      // Spend the same time as a real check, so a missing account is not faster to answer.
      await scrypt(password, randomBytes(SALT_BYTES), optionsFor(this.cost, BLOCK_SIZE, PARALLEL));
      return false;
    }
    const expected = Buffer.from(key, 'base64');
    const actual = await scrypt(
      password,
      Buffer.from(salt, 'base64'),
      optionsFor(Number(cost), Number(blockSize), Number(parallel)),
    );
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
