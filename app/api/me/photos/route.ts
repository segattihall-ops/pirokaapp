import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireUser } from '@/lib/api/guard';
import { generateStorageKey } from '@/lib/upload/storage';

export const dynamic = 'force-dynamic';

/** Remove one photo slot: both storage variants and the row. Slots above it shift down so the album stays contiguous. */
export async function DELETE(request: Request) {
  const g = await requireUser();
  if (g.error) return g.error;
  const me = g.session.userId;
  const db = supabaseAdmin!;

  const { slot } = (await request.json().catch(() => ({}))) as { slot?: unknown };
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot > 5) {
    return NextResponse.json({ error: 'slot 0-5 required' }, { status: 400 });
  }

  const { data: rows } = await db.from('photos').select('slot, storage_key, blur_key').eq('user_id', me).order('slot');
  const target = (rows ?? []).find((p) => p.slot === slot);
  if (!target) return NextResponse.json({ ok: true });

  await db.storage.from('photos').remove([target.storage_key, target.blur_key]).catch(() => {});
  const { error } = await db.from('photos').delete().eq('user_id', me).eq('slot', slot);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Shift later slots down (storage objects are renamed by copy + remove so URLs stay slot-based).
  const later = (rows ?? []).filter((p) => p.slot > slot).sort((a, b) => a.slot - b.slot);
  for (const p of later) {
    const to = p.slot - 1;
    const newKey = generateStorageKey({ userId: me, slot: to, variant: 'original' });
    const newBlur = generateStorageKey({ userId: me, slot: to, variant: 'blur' });
    await Promise.all([db.storage.from('photos').move(p.storage_key, newKey), db.storage.from('photos').move(p.blur_key, newBlur)]).catch(() => {});
    await db.from('photos').update({ slot: to, storage_key: newKey, blur_key: newBlur }).eq('user_id', me).eq('slot', p.slot);
  }
  return NextResponse.json({ ok: true });
}
