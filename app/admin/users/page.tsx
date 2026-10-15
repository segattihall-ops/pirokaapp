import { UsersBrowser } from '@/components/admin/users-browser';

export const dynamic = 'force-dynamic';

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h2 sm:text-h1">Users</h1>
      <UsersBrowser />
    </div>
  );
}
