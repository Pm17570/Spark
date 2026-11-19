import { json, fail } from '@/lib/auth';
import { participantContext } from '@/lib/session-exam';
import { startAttempt } from '@/lib/repo';

export async function POST() {
  const c = await participantContext();
  if (c.err) return c.err;
  if (c.attempt) return json({ ok: true });
  if (c.phase !== 'open') return fail('ยังไม่เปิดให้เริ่มสอบ', 403);
  startAttempt(c.p.id, c.exam.id);
  return json({ ok: true });
}
