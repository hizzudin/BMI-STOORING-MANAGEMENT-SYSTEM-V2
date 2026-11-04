import { createApiClient } from '@bmi/api-client';

const LOCAL_API_URL = 'http://localhost:3001';

export const api = createApiClient(process.env.NEXT_PUBLIC_API_URL ?? LOCAL_API_URL);
