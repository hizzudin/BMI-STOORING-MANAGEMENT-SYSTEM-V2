import { STORAGE_LINK_SECONDS } from '@bmi/shared';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  StorageOverwriteError,
  type SignedDownload,
  type SignedUpload,
  type StoragePort,
  type StoredObject,
} from '../../ports/storage.js';

export interface S3StorageSettings {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** R2 takes 'auto'; an S3 emulator needs a real AWS region name. */
  region?: string;
}

const statusOf = (error: unknown) =>
  (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;

/**
 * NFR-13, DEC-32, DEC-135: Cloudflare R2 (or any S3-compatible store) through the AWS SDK v3. Links
 * are presigned for 15 minutes; a put carries If-None-Match: * so an existing key is never overwritten.
 */
export class S3StorageAdapter implements StoragePort {
  private readonly client: S3Client;

  constructor(private readonly settings: S3StorageSettings) {
    this.client = new S3Client({
      endpoint: settings.endpoint,
      region: settings.region ?? 'auto',
      forcePathStyle: true,
      credentials: {
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey,
      },
    });
  }

  async signUpload(
    key: string,
    file: { contentType: string; bytes: number },
  ): Promise<SignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.settings.bucket,
      Key: key,
      ContentType: file.contentType,
      ContentLength: file.bytes,
      IfNoneMatch: '*',
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: STORAGE_LINK_SECONDS,
      // Signed, so another type, another size or an existing key is refused by the store.
      signableHeaders: new Set(['content-type', 'content-length', 'if-none-match']),
    });
    return {
      url,
      method: 'PUT',
      headers: { 'content-type': file.contentType, 'if-none-match': '*' },
      expiresAt: this.expiry(),
    };
  }

  async signDownload(key: string): Promise<SignedDownload> {
    const command = new GetObjectCommand({ Bucket: this.settings.bucket, Key: key });
    const url = await getSignedUrl(this.client, command, { expiresIn: STORAGE_LINK_SECONDS });
    return { url, expiresAt: this.expiry() };
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const answer = await this.client.send(
        new HeadObjectCommand({ Bucket: this.settings.bucket, Key: key }),
      );
      return {
        bytes: answer.ContentLength ?? 0,
        contentType: answer.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  }

  async read(key: string): Promise<Uint8Array> {
    const answer = await this.client.send(
      new GetObjectCommand({ Bucket: this.settings.bucket, Key: key }),
    );
    if (!answer.Body) throw new Error(`No body for ${key}`);
    return answer.Body.transformToByteArray();
  }

  async write(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.settings.bucket,
          Key: key,
          Body: bytes,
          ContentType: contentType,
          IfNoneMatch: '*',
        }),
      );
    } catch (error) {
      if (statusOf(error) === 412) throw new StorageOverwriteError();
      throw error;
    }
  }

  /** S3 answers a delete of a missing key with success. */
  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: key }));
  }

  async totalBytes(): Promise<number> {
    let total = 0;
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.settings.bucket, ContinuationToken: token }),
      );
      for (const item of page.Contents ?? []) total += item.Size ?? 0;
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return total;
  }

  /** Tests and first setup: the bucket exists before anything is stored. */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.settings.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.settings.bucket }));
    }
  }

  private expiry(): Date {
    return new Date(Date.now() + STORAGE_LINK_SECONDS * 1000);
  }
}
