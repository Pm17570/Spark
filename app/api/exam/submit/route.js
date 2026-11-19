import { json, fail } from '@/lib/auth';
import { participantContext } from '@/lib/session-exam';
import { submitAttempt } from '@/lib/repo';

export async function POST() {
  const c = await participantContext();
  if (c.err) return c.err;
  if (!c.attempt) return fail('ยังไม่ได้เริ่มสอบ', 409);
  submitAttempt(c.p.id, false);
  return json({ ok: true });
}
