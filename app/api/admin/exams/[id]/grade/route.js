import { json, fail, readJson, getStaff, noStaff } from '@/lib/auth';
import { loadExam, rowsForPart, setGrade, participantById, getAnswers, gradesOf, answersOfExam, gradesOfExam, listParticipants } from '@/lib/repo';
import { allParts } from '@/lib/model';
import { gradeAttempt, autoGradePart } from '@/lib/grade';

export const dynamic = 'force-dynamic';

// GET ?partId&only=pending|all&offset&limit → ตรวจทีละข้อ
// GET ?participantId → ตรวจทีละคน
// GET (ไม่มีพารามิเตอร์) → { pending: { partId: จำนวนที่รอตรวจ } }
export async function GET(req, { params }) {
  const st = await getStaff();
  if (!st) return noStaff();
  const id = (await params).id;
  const exam = loadExam(id);
  if (!exam) return fail('ไม่พบข้อสอบ', 404);
  const u = new URL(req.url).searchParams;
  const parts = allParts(exam);
  const partId = u.get('partId');
  const pid = u.get('participantId');

  if (partId) {
    const x = parts.find((y) => y.p.id === partId);
    if (!x) return fail('ไม่พบข้อ', 404);
    const only = u.get('only') || 'pending';
    const offset = Math.max(0, Number(u.get('offset')) || 0);
    const limit = Math.min(100, Math.max(1, Number(u.get('limit')) || 30));
    const all = rowsForPart(id, partId)
      .filter((r) => r.submittedAt)
      .map((r) => {
        const value = r.value;
        const a = autoGradePart(x.p, value);
        const manual = typeof r.manual === 'number' ? r.manual : null;
        return { participantId: r.id, name: r.name, code: st.role === 'admin' ? r.code : '', school: r.school, value, auto: a.score, max: a.max, needsManual: manual === null && a.needsManual, manual, score: manual ?? a.score };
      });
    const filtered = only === 'pending' ? all.filter((r) => r.needsManual) : all;
    return json({ part: { ...x.p, full: x.full }, total: filtered.length, rows: filtered.slice(offset, offset + limit) });
  }

  if (pid) {
    const p = participantById(pid);
    if (!p || p.exam_id !== id) return fail('ไม่พบผู้เข้าสอบ', 404);
    const ans = getAnswers(pid);
    const g = gradeAttempt(exam, ans, gradesOf(pid));
    return json({
      participant: { id: p.id, name: p.name, code: st.role === 'admin' ? p.code : '' },
      score: g.score, max: g.max,
      items: parts.map((x) => ({ partId: x.p.id, full: x.full, part: x.p, value: ans[x.p.id] ?? null, ...g.parts[x.p.id] })),
    });
  }

  const answers = answersOfExam(id);
  const grades = gradesOfExam(id);
  const pending = {};
  for (const p of listParticipants(id)) {
    if (!p.attempt?.submittedAt) continue;
    const g = gradeAttempt(exam, answers.get(p.id) || {}, grades.get(p.id) || {});
    for (const [k, r] of Object.entries(g.parts)) if (r.needsManual) pending[k] = (pending[k] || 0) + 1;
  }
  return json({ pending, parts: parts.map((x) => ({ id: x.p.id, full: x.full, type: x.p.type, text: x.p.text, points: x.p.points })) });
}

export async function POST(req, { params }) {
  const st = await getStaff();
  if (!st) return noStaff();
  const id = (await params).id;
  const exam = loadExam(id);
  if (!exam) return fail('ไม่พบข้อสอบ', 404);
  const b = (await readJson(req, 3000)) || {};
  const x = allParts(exam).find((y) => y.p.id === b.partId);
  const p = participantById(b.participantId);
  if (!x || !p || p.exam_id !== id) return fail('ข้อมูลไม่ถูกต้อง', 404);
  if (b.score === null || b.score === '') setGrade(p.id, x.p.id, null);
  else {
    const n = Number(b.score);
    if (!Number.isFinite(n) || n < 0 || n > x.p.points) return fail(`คะแนนต้องอยู่ระหว่าง 0–${x.p.points}`);
    setGrade(p.id, x.p.id, Math.round(n * 100) / 100);
  }
  return json({ ok: true });
}
