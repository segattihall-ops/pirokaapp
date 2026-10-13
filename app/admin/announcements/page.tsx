import { AnnouncementsEditor } from '@/components/admin/announcements-editor';

export const dynamic = 'force-dynamic';

export default function AnnouncementsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-h2 sm:text-h1">Announcements</h1>
        <p className="mt-1 text-[12px] text-fg-4">
          Shown as a dismissible banner inside the app. Gated by the <code>announcements</code> flag.
        </p>
      </div>
      <AnnouncementsEditor />
    </div>
  );
}
