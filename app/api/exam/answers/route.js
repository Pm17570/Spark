import { json, fail, readJson } from '@/lib/auth';
import { participantContext } from '@/lib/session-exam';
import { partMap, cleanAnswer } from '@/lib/exam';
import { saveAnswers } from '@/lib/repo';

export async function PUT(req) {
  const c = await participantContext();
  if (c.err) return c.err;
  if (!c.attempt) return fail('ยังไม่ได้เริ่มสอบ', 409);
  if (c.attempt.submittedAt) return fail('ส่งข้อสอบแล้ว แก้ไขไม่ได้', 409, { code: 'submitted' });
  if (c.deadline !== null && c.t > c.deadline + 5000) return fail('หมดเวลาแล้ว', 409, { code: 'submitted' });
  const body = await readJson(req, 3_000_000);
  const pm = partMap(c.exam);
  const clean = {};
  for (const [id, v] of Object.entries(body?.answers || {})) {
    const p = pm.get(id);
    if (!p) continue;
    const a = cleanAnswer(p, v);
    if (a !== undefined) clean[id] = a;
  }
  saveAnswers(c.p.id, clean);
  return json({ saved: Object.keys(clean).length });
}
