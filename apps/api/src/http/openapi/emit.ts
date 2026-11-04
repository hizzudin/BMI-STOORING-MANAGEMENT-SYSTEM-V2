import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildOpenApiDocument } from './document.js';

const target = join(import.meta.dirname, '../../../../../packages/api-client/openapi.json');

await writeFile(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
console.log(`Wrote ${target}`);
