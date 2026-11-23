import { json, readJson, isAdmin, noAdmin, getStaff, noStaff } from '@/lib/auth';
import { listExams, createExam } from '@/lib/repo';
import { createSampleExam } from '@/lib/seed';
import { boot } from '@/lib/boot';

export const dynamic = 'force-dynamic';

export async function GET() {
  boot();
  const st = await getStaff();
  if (!st) return noStaff();
  return json({ exams: listExams(), role: st.role });
}
export async function POST(req) {
  if (!(await isAdmin())) return noAdmin();
  const b = await readJson(req, 5000);
  if (b?.sample) return json({ id: createSampleExam().examId });
  return json({ id: createExam(b?.title || 'ข้อสอบใหม่') });
}
