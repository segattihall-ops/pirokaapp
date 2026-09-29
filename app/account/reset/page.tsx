import type { Metadata } from 'next';
import { AccountFlow } from '@/components/account/account-flow';

export const metadata: Metadata = { title: 'Reset password' };

export default function Page() {
  return <AccountFlow initial="reset" />;
}
