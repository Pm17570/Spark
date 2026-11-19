import { json, readJson } from '@/lib/auth';
import { participantContext } from '@/lib/session-exam';
import { addBlur } from '@/lib/repo';

export async function POST(req) {
  const c = await participantContext();
  if (c.err) return c.err;
  const b = await readJson(req, 1000);
  if (b?.type === 'blur' && c.attempt && !c.attempt.submittedAt) addBlur(c.p.id);
  return json({ ok: true });
}
