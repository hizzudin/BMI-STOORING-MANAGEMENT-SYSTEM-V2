'use client';

import { useMemo } from 'react';
import { documentTypesApi } from '../../lib/document-types-api';
import { DocumentTypes } from './DocumentTypes';

/** Document types wired to the API of the browser. */
export function DocumentTypesPage() {
  const api = useMemo(() => documentTypesApi(), []);
  return <DocumentTypes api={api} />;
}
