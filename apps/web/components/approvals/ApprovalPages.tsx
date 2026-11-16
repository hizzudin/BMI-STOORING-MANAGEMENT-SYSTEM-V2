'use client';

import { useMemo } from 'react';
import { approvalsApi } from '../../lib/approvals-api';
import { ApprovalReview } from './ApprovalReview';
import { ApprovalsHistory } from './ApprovalsHistory';
import { ApprovalsInbox } from './ApprovalsInbox';

const useApi = () => useMemo(() => approvalsApi(), []);

/** The Approvals pages wired to the API of the browser. */
export function ApprovalsInboxPage() {
  return <ApprovalsInbox api={useApi()} />;
}

export function ApprovalsHistoryPage() {
  return <ApprovalsHistory api={useApi()} />;
}

export function ApprovalReviewPage({ id }: { id: number }) {
  return <ApprovalReview api={useApi()} id={id} />;
}
