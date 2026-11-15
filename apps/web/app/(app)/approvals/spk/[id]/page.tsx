import { ApprovalReviewPage } from '../../../../../components/approvals/ApprovalPages';

// REQ-APR-004, C-24, C-25: ApprovalReview of SPK creation.
export default async function ApprovalReviewRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApprovalReviewPage id={Number(id)} />;
}
