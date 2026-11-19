import { json, fail, isAdmin, noAdmin } from '@/lib/auth';
import { loadExam, listParticipants, finalizeExpired, phaseOf, deadlineOf } from '@/lib/repo';
import { examCounts } from '@/lib/model';

export const dynamic = 'force-dynamic';

export async function GET(_r, { params }) {
  if (!(await isAdmin())) return noAdmin();
  const exam = loadExam((await params).id);
  if (!exam) return fail('ไม่พบข้อสอบ', 404);
  const t = Date.now();
  finalizeExpired(exam, t);
  const list = listParticipants(exam.id).map((p) => ({ ...p, online: !!p.lastSeen && t - p.lastSeen < 25000, deadline: p.attempt ? deadlineOf(exam, p.attempt) : null }));
  const { subjects, ...ex } = exam;
  return json({ serverNow: t, phase: phaseOf(exam, t), exam: { ...ex, ...examCounts(exam) }, participants: list });
}
