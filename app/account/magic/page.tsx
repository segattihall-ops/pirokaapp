import type { Metadata } from 'next';
import { AccountFlow } from '@/components/account/account-flow';

export const metadata: Metadata = { title: 'Magic link' };

export default function Page() {
  return <AccountFlow initial="magic" />;
}
