import { FlagsTable } from '@/components/admin/flags-table';

export const dynamic = 'force-dynamic';

export default function FlagsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h2 sm:text-h1">Feature flags</h1>
      <FlagsTable />
    </div>
  );
}
