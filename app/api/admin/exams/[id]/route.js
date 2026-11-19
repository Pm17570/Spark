import { json, fail, readJson, isAdmin, noAdmin } from '@/lib/auth';
import { loadExam, saveExamContent, deleteExam } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET(_r, { params }) {
  if (!(await isAdmin())) return noAdmin();
  const exam = loadExam((await params).id);
  return exam ? json({ exam }) : fail('ไม่พบข้อสอบ', 404);
}
export async function PUT(req, { params }) {
  if (!(await isAdmin())) return noAdmin();
  const id = (await params).id;
  if (!loadExam(id)) return fail('ไม่พบข้อสอบ', 404);
  const b = await readJson(req, 8_000_000);
  if (!b || !Array.isArray(b.subjects) || !b.subjects.length) return fail('ข้อมูลไม่ถูกต้อง');
  return json({ exam: saveExamContent(id, b) });
}
export async function DELETE(_r, { params }) {
  if (!(await isAdmin())) return noAdmin();
  deleteExam((await params).id);
  return json({ ok: true });
}
