import { json } from '@/lib/auth';
import { participantContext } from '@/lib/session-exam';
import { studentPaper } from '@/lib/exam';
import { getAnswers, gradesOf } from '@/lib/repo';
import { gradeAttempt } from '@/lib/grade';
import { examCounts } from '@/lib/model';
import { participantChatMeta } from '@/lib/chat';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const c = await participantContext();
  if (c.err) return c.err;
  const { p, exam, attempt, t, phase, deadline } = c;
  const full = new URL(req.url).searchParams.get('full') === '1';
  const out = {
    serverNow: t,
    me: { name: p.name, school: p.school },
    exam: { title: exam.title, description: exam.description, durationMin: exam.durationMin + exam.extraMin, phase, openAt: exam.openAt, closeAt: exam.closeAt, counts: examCounts(exam) },
    chat: participantChatMeta(p.id),
    attempt: attempt ? { startedAt: attempt.startedAt, submittedAt: attempt.submittedAt, auto: attempt.auto, deadline } : null,
  };
  if (attempt && !attempt.submittedAt && full) {
    out.paper = studentPaper(exam, p.id);
    out.answers = getAnswers(p.id);
  }
  if (attempt?.submittedAt) {
    if (exam.showResult) {
      const g = gradeAttempt(exam, getAnswers(p.id), gradesOf(p.id));
      out.result = { score: g.score, max: g.max, pending: g.pending, subjects: exam.subjects.map((s) => ({ title: s.title, ...g.subjects[s.id] })) };
    } else out.result = null;
  }
  return json(out);
}
