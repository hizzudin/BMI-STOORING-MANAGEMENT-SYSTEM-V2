/** DEC-135: signed upload and download links expire after 15 minutes (NFR-13). */
export const STORAGE_LINK_SECONDS = 900;

const SAFE_PART = /^[A-Za-z0-9_-]+$/;

function part(value: string): string {
  if (!SAFE_PART.test(value)) throw new Error(`Invalid storage key part: ${value}`);
  return value;
}

/** §9.12: the object key of a stored file, `{env}/{yyyy}/{mm}/{entity}/{id}.{ext}` by the UTC month. */
export function storageKey(input: {
  env: string;
  at: Date;
  entity: string;
  id: string;
  ext: 'jpg' | 'pdf' | 'csv';
}): string {
  const year = String(input.at.getUTCFullYear());
  const month = String(input.at.getUTCMonth() + 1).padStart(2, '0');
  return `${part(input.env)}/${year}/${month}/${part(input.entity)}/${part(input.id)}.${input.ext}`;
}
