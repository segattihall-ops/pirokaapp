import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server';
import { EditProfile } from '@/components/me/edit-profile';

export const metadata: Metadata = { title: 'Edit profile' };
export const dynamic = 'force-dynamic';

export default async function EditProfilePage() {
  const session = await getSession();
  if (!session) redirect('/');
  return (
    <section className="mx-auto flex w-full max-w-[560px] animate-in flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <span className="eyebrow">Me</span>
      <h1 className="text-h2 sm:text-h1">Edit profile</h1>
      <EditProfile />
    </section>
  );
}
