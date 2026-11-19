import { json, readJson, isAdmin, noAdmin } from '@/lib/auth';
import { listExams, createExam } from '@/lib/repo';
import { createSampleExam } from '@/lib/seed';
import { boot } from '@/lib/boot';

export const dynamic = 'force-dynamic';

export async function GET() {
  boot();
  if (!(await isAdmin())) return noAdmin();
  return json({ exams: listExams() });
}
export async function POST(req) {
  if (!(await isAdmin())) return noAdmin();
  const b = await readJson(req, 5000);
  if (b?.sample) return json({ id: createSampleExam().examId });
  return json({ id: createExam(b?.title || 'ข้อสอบใหม่') });
}
