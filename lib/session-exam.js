// ตัวช่วยร่วมของ API ฝั่งผู้เข้าสอบ
import { getSession, fail } from './auth';
import { loadExam, finalizeExpired, getAttempt, phaseOf, deadlineOf, touchParticipant } from './repo';

export async function participantContext() {
  const s = await getSession();
  if (!s) return { err: fail('กรุณาเข้าสู่ระบบ', 401, { code: 'auth' }) };
  if (s.role === 'replaced') return { err: fail('รหัสนี้ถูกเปิดใช้งานจากอุปกรณ์อื่นแล้ว', 401, { code: 'replaced' }) };
  if (s.role !== 'participant') return { err: fail('กรุณาเข้าสู่ระบบ', 401, { code: 'auth' }) };
  const p = s.p;
  const exam = loadExam(p.exam_id);
  if (!exam) return { err: fail('ไม่พบข้อสอบ', 404) };
  const t = Date.now();
  finalizeExpired(exam, t);
  touchParticipant(p.id);
  const attempt = getAttempt(p.id);
  return { p, exam, attempt, t, phase: phaseOf(exam, t), deadline: attempt ? deadlineOf(exam, attempt) : null };
}
