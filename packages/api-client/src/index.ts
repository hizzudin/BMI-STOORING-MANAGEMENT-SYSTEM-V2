import createClient, { type Client, type ClientOptions } from 'openapi-fetch';
import type { paths } from './schema.gen.js';

export type ApiClient = Client<paths>;
export type { components, paths } from './schema.gen.js';

/** The one way web and mobile reach the API (DEC-66); screens build on this through TanStack Query. */
export function createApiClient(baseUrl: string, options: ClientOptions = {}): ApiClient {
  return createClient<paths>({ ...options, baseUrl });
}
