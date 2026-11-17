import { STORAGE_LINK_SECONDS } from '@bmi/shared';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { ClockPort } from '../../ports/clock.js';
import {
  StorageLinkError,
  StorageMismatchError,
  StorageMissingError,
  StorageOverwriteError,
  type SignedLinkServer,
  type SignedDownload,
  type SignedUpload,
  type StoragePort,
  type StoredObject,
} from '../../ports/storage.js';

const SAFE_KEY = /^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.[a-z0-9]+$/;
const TYPES: Readonly<Record<string, string>> = { jpg: 'image/jpeg', pdf: 'application/pdf' };

interface Claim {
  k: string;
  o: 'get' | 'put';
  e: number;
  t?: string;
  b?: number;
}

const encode = (claim: Claim) => Buffer.from(JSON.stringify(claim)).toString('base64url');

/**
 * D-03, DEC-135: files under a local folder for development and tests. Its signed links are API URLs
 * (`/storage/fs/{token}`) with an HMAC token that expires after 15 minutes on the injected clock.
 */
export class FsStorageAdapter implements StoragePort, SignedLinkServer {
  private readonly root: string;

  constructor(
    private readonly options: {
      root: string;
      secret: string;
      clock: ClockPort;
      baseUrl: () => string;
    },
  ) {
    this.root = resolve(options.root);
  }

  signUpload(key: string, file: { contentType: string; bytes: number }): Promise<SignedUpload> {
    const expiresAt = this.expiry();
    const token = this.sign({
      k: this.check(key),
      o: 'put',
      e: expiresAt.getTime(),
      t: file.contentType,
      b: file.bytes,
    });
    return Promise.resolve({
      url: this.url(token),
      method: 'PUT',
      headers: { 'content-type': file.contentType },
      expiresAt,
    });
  }

  signDownload(key: string): Promise<SignedDownload> {
    const expiresAt = this.expiry();
    const token = this.sign({ k: this.check(key), o: 'get', e: expiresAt.getTime() });
    return Promise.resolve({ url: this.url(token), expiresAt });
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const info = await stat(this.path(key));
      return { bytes: info.size, contentType: this.typeOf(key) };
    } catch {
      return null;
    }
  }

  async read(key: string): Promise<Uint8Array> {
    try {
      return new Uint8Array(await readFile(this.path(key)));
    } catch {
      throw new StorageMissingError();
    }
  }

  async write(key: string, bytes: Uint8Array, _contentType: string): Promise<void> {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    try {
      // 'wx' fails when the file exists, so nothing is ever overwritten (REQ-FUP-008).
      await writeFile(path, bytes, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new StorageOverwriteError();
      throw error;
    }
  }

  async totalBytes(): Promise<number> {
    const walk = async (dir: string): Promise<number> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return 0;
      }
      let sum = 0;
      for (const entry of entries) {
        const path = join(dir, entry.name);
        sum += entry.isDirectory() ? await walk(path) : (await stat(path)).size;
      }
      return sum;
    };
    return walk(this.root);
  }

  /** The PUT of a signed upload link: exactly the signed type and size, never over a stored file. */
  async acceptUpload(token: string, contentType: string, body: Uint8Array): Promise<void> {
    const claim = this.verify(token, 'put');
    if (contentType.split(';')[0]?.trim() !== claim.t || body.byteLength !== claim.b) {
      throw new StorageMismatchError();
    }
    await this.write(claim.k, body, contentType);
  }

  /** The GET of a signed download link. */
  async openDownload(token: string): Promise<{ body: Uint8Array; contentType: string }> {
    const claim = this.verify(token, 'get');
    return { body: await this.read(claim.k), contentType: this.typeOf(claim.k) };
  }

  private expiry(): Date {
    return new Date(this.options.clock.now().getTime() + STORAGE_LINK_SECONDS * 1000);
  }

  private url(token: string): string {
    return `${this.options.baseUrl()}/storage/fs/${token}`;
  }

  private sign(claim: Claim): string {
    const body = encode(claim);
    return `${body}.${this.mac(body)}`;
  }

  private mac(body: string): string {
    return createHmac('sha256', this.options.secret).update(body).digest('base64url');
  }

  private verify(token: string, operation: Claim['o']): Claim {
    const [body = '', mac = ''] = token.split('.');
    const expected = Buffer.from(this.mac(body));
    const given = Buffer.from(mac);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new StorageLinkError();
    }
    const claim = JSON.parse(Buffer.from(body, 'base64url').toString()) as Claim;
    if (claim.o !== operation || claim.e <= this.options.clock.now().getTime()) {
      throw new StorageLinkError();
    }
    return claim;
  }

  private check(key: string): string {
    if (!SAFE_KEY.test(key)) throw new Error(`Invalid storage key: ${key}`);
    return key;
  }

  private path(key: string): string {
    const path = resolve(this.root, this.check(key));
    if (!path.startsWith(this.root + sep)) throw new Error(`Invalid storage key: ${key}`);
    return path;
  }

  private typeOf(key: string): string {
    return TYPES[key.slice(key.lastIndexOf('.') + 1)] ?? 'application/octet-stream';
  }
}
