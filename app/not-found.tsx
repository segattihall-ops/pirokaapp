import Link from 'next/link';
import { LogoTile } from '@/components/logo';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <LogoTile size={56} />
      <h1 className="text-h2">Nothing here.</h1>
      <p className="text-[14px] text-fg-3">That page doesn’t exist or moved.</p>
      <Link href="/" className="btn-secondary mt-2">
        Back to πroka
      </Link>
    </div>
  );
}
