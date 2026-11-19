import { json, fail, isAdmin, noAdmin } from '@/lib/auth';
import { computeResults } from '@/lib/results';

export const dynamic = 'force-dynamic';

export async function GET(_r, { params }) {
  if (!(await isAdmin())) return noAdmin();
  const r = computeResults((await params).id);
  if (!r) return fail('ไม่พบข้อสอบ', 404);
  const { exam, ...rest } = r;
  return json({ ...rest, exam: { id: exam.id, title: exam.title, subjects: exam.subjects.map((s) => ({ id: s.id, title: s.title })) } });
}
