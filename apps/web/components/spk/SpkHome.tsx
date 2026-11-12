'use client';

import { useEffect, useState } from 'react';
import type { SpksApi } from '../../lib/spks-api';
import { Icon } from '../kit/Icon';
import { PageHead } from '../shell/AppShell';

/**
 * The Surat Perintah Kerja page before SPKList (TASK-125, DEC-126): its header with Create SPK for
 * the users who may create one; the list and its tabs come with TASK-125.
 */
export function SpkHome({ api }: { api: SpksApi }) {
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    void api.options().then((outcome) => {
      setCanCreate(outcome.ok && outcome.data.allowedActions.includes('create'));
    });
  }, [api]);

  return (
    <PageHead
      title="Surat Perintah Kerja"
      actions={
        canCreate && (
          <a className="btn btn-primary" href="/spk/new">
            <Icon name="plus" size={16} />
            Create SPK
          </a>
        )
      }
    />
  );
}
