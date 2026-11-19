// คำนวณผลการแข่งขันทั้งหมด (ตรวจอัตโนมัติสดจากเฉลยล่าสุด + คะแนนที่กรรมการให้เอง)
import { loadExam, listParticipants, answersOfExam, gradesOfExam, finalizeExpired } from './repo';
import { gradeAttempt } from './grade';
import { allParts } from './model';

export function computeResults(examId) {
  const exam = loadExam(examId);
  if (!exam) return null;
  const now = Date.now();
  finalizeExpired(exam, now);
  const plist = listParticipants(examId);
  const answers = answersOfExam(examId);
  const grades = gradesOfExam(examId);
  const parts = allParts(exam);

  const stat = {};
  for (const { p } of parts) stat[p.id] = { n: 0, sum: 0, full: 0, blank: 0, pending: 0 };
  const subjStat = {};
  for (const s of exam.subjects) subjStat[s.id] = { n: 0, sum: 0, max: 0 };

  const rows = plist.map((p) => {
    const base = { id: p.id, code: p.code, name: p.name, school: p.school, lastSeen: p.lastSeen, answered: p.answered, attempt: p.attempt, score: 0, max: 0, pending: 0, subjects: {}, used: null };
    if (!p.attempt) return base;
    const g = gradeAttempt(exam, answers.get(p.id) || {}, grades.get(p.id) || {});
    Object.assign(base, { score: g.score, max: g.max, pending: g.pending, subjects: g.subjects });
    base.used = (p.attempt.submittedAt || now) - p.attempt.startedAt;
    for (const [pid, r] of Object.entries(g.parts)) {
      const s = stat[pid];
      if (!s) continue;
      s.n++;
      s.sum += r.score;
      if (r.status === 'correct') s.full++;
      if (r.status === 'blank') s.blank++;
      if (r.needsManual) s.pending++;
    }
    if (p.attempt.submittedAt) {
      for (const [sid, r] of Object.entries(g.subjects)) {
        const t = subjStat[sid];
        if (!t) continue;
        t.n++;
        t.sum += r.score;
        t.max = r.max;
      }
    }
    return base;
  });

  // จัดอันดับ: คะแนนมากสุดก่อน เท่ากันดูเวลาที่ใช้น้อยกว่า
  const started = rows.filter((r) => r.attempt).sort((a, b) => b.score - a.score || a.used - b.used || a.name.localeCompare(b.name, 'th'));
  let rank = 0;
  started.forEach((r, i) => {
    const prev = started[i - 1];
    if (!prev || prev.score !== r.score || prev.used !== r.used) rank = i + 1;
    r.rank = rank;
  });

  const partStats = parts.map(({ p, q, s, full }) => {
    const t = stat[p.id];
    return {
      id: p.id,
      full,
      subjectId: s.id,
      type: p.type,
      text: p.text || q.title || '',
      points: p.points,
      n: t.n,
      avgPct: t.n && p.points ? (t.sum / t.n / p.points) * 100 : 0,
      fullCount: t.full,
      blank: t.blank,
      pending: t.pending,
    };
  });
  const subjectStats = exam.subjects.map((s) => {
    const t = subjStat[s.id];
    return { id: s.id, title: s.title, n: t.n, avg: t.n ? Math.round((t.sum / t.n) * 100) / 100 : 0, max: t.max };
  });
  return { exam, serverNow: now, rows, partStats, subjectStats };
}
