import { formatNumber } from '@bmi/shared';

const KB = 1024;
const MB = KB * KB;

/** A file size as the detail panel shows it: "412 KB", "4,2 MB" (NFR-09). */
export function formatFileSize(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / KB))} KB`;
  return `${formatNumber(bytes / MB, { decimals: 1 })} MB`;
}
