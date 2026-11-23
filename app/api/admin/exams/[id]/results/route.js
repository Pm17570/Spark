import { json, fail, getStaff, noStaff } from '@/lib/auth';
import { computeResults } from '@/lib/results';

export const dynamic = 'force-dynamic';

export async function GET(_r, { params }) {
  const st = await getStaff();
  if (!st) return noStaff();
  const r = computeResults((await params).id);
  if (!r) return fail('ไม่พบข้อสอบ', 404);
  const { exam, ...rest } = r;
  if (st.role !== 'admin') rest.rows = rest.rows.map((x) => ({ ...x, code: '' }));
  return json({ ...rest, exam: { id: exam.id, title: exam.title, subjects: exam.subjects.map((s) => ({ id: s.id, title: s.title })) } });
}
