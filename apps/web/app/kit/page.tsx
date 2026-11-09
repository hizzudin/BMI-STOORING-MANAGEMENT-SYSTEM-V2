import { notFound } from 'next/navigation';
import { KitPreview } from '../../components/dev/KitPreview';

// Development-only gallery of the shell and kit (TASK-126 qa); never served in production.
export default function KitPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <KitPreview />;
}
