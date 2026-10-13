import { FeedbackInbox } from '@/components/admin/feedback-inbox';

export const dynamic = 'force-dynamic';

export default function FeedbackPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h2 sm:text-h1">Feedback</h1>
      <FeedbackInbox />
    </div>
  );
}
